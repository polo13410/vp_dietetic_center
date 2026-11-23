import { InvoiceRecipient, InvoiceType, PaymentMethod } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { type CsvInvoice, invoiceMismatches, invoicesCsv, invoiceStatus, summarize } from './invoice-rules';
import { formatInvoiceNumber, parisDay, parisYear } from './numbering';

const d = (iso: string) => new Date(iso);

describe('invoice numbers', () => {
  it('formats invoices and credit notes in separate series', () => {
    expect(formatInvoiceNumber(InvoiceType.INVOICE, 2026, 1)).toBe('2026-0001');
    expect(formatInvoiceNumber(InvoiceType.INVOICE, 2026, 123)).toBe('2026-0123');
    expect(formatInvoiceNumber(InvoiceType.CREDIT_NOTE, 2026, 1)).toBe('A-2026-0001');
    expect(formatInvoiceNumber(InvoiceType.INVOICE, 2027, 10000)).toBe('2027-10000');
  });

  it('reads the year and the day in Paris, not in UTC', () => {
    // 31 December, 23:30 in Paris (UTC+1) is still 2026
    expect(parisYear(d('2026-12-31T22:30:00Z'))).toBe(2026);
    // 1 January, 00:30 in Paris
    expect(parisYear(d('2026-12-31T23:30:00Z'))).toBe(2027);
    // Summer time (UTC+2)
    expect(parisDay(d('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });
});

describe('invoiceMismatches', () => {
  const invoice = {
    serviceLabel: 'Suivi',
    amountCents: 5000,
    paymentMethod: PaymentMethod.CARD,
    serviceDate: d('2026-11-20T09:00:00Z'),
    practiceAddress: null,
    practiceZipCode: null,
    practiceCity: null,
    // Issued before lot 16: no copy of the split
    priceCents: null,
    discountCents: null,
    payerCents: null,
    payerName: null,
  };
  const session = { formulaLabel: 'Suivi', priceCents: 5000, paymentMethod: PaymentMethod.CARD, date: d('2026-11-20T15:00:00Z') };

  it('is empty when the session still matches (the hour does not matter)', () => {
    expect(invoiceMismatches(invoice, session)).toEqual([]);
  });

  it('names each difference: formula, price, payment method, day', () => {
    expect(invoiceMismatches(invoice, { ...session, formulaLabel: 'Bilan' })).toEqual(['formula']);
    expect(invoiceMismatches(invoice, { ...session, priceCents: 6000 })).toEqual(['price']);
    expect(invoiceMismatches(invoice, { ...session, paymentMethod: PaymentMethod.CASH })).toEqual(['paymentMethod']);
    expect(invoiceMismatches(invoice, { ...session, date: d('2026-11-21T09:00:00Z') })).toEqual(['date']);
    expect(
      invoiceMismatches(invoice, { formulaLabel: null, priceCents: null, paymentMethod: PaymentMethod.NONE, date: d('2026-11-19T09:00:00Z') }),
    ).toEqual(['formula', 'price', 'paymentMethod', 'date']);
  });

  describe('discount and payer part (lot 16)', () => {
    // Price 60 €, discount 10 €, Mutuelle 30 €: the patient was billed 20 €
    const split = { priceCents: 6000, discountCents: 1000, payerCents: 3000, payerName: 'Mutuelle Horizon', amountCents: 2000 };
    const billed = { ...invoice, ...split };
    const now = { ...session, priceCents: 6000, discountCents: 1000, netCents: 5000, payerCents: 3000, patientCents: 2000, payerName: 'Mutuelle Horizon' };

    it('matches the same split', () => {
      expect(invoiceMismatches(billed, now)).toEqual([]);
    });

    it('sees a changed discount, payer part or payer', () => {
      expect(invoiceMismatches(billed, { ...now, discountCents: 0, netCents: 6000, patientCents: 3000 })).toEqual(['discount']);
      expect(invoiceMismatches(billed, { ...now, payerCents: 0, patientCents: 5000 })).toEqual(['payer']);
      expect(invoiceMismatches(billed, { ...now, payerName: 'Association Bien Manger' })).toEqual(['payer']);
    });

    it('an invoice issued before lot 16 matches its session migrated without discount nor payer', () => {
      expect(
        invoiceMismatches(invoice, { ...session, discountCents: 0, netCents: 5000, payerCents: 0, patientCents: 5000 }),
      ).toEqual([]);
    });
  });
});

describe('summarize', () => {
  const invoice = (over: Partial<Parameters<typeof summarize>[0][number]> = {}) => ({
    type: InvoiceType.INVOICE,
    cancelledAt: null,
    amountCents: 5000,
    paymentMethod: PaymentMethod.CARD,
    issuedAt: d('2026-11-10T10:00:00Z'),
    ...over,
  });

  it('totals the invoices in force, per payment method and per month', () => {
    const totals = summarize([
      invoice({ amountCents: 6000, paymentMethod: PaymentMethod.CHECK, issuedAt: d('2026-10-31T23:30:00Z') }), // 1 Nov in Paris
      invoice(),
      invoice({ paymentMethod: PaymentMethod.CASH, issuedAt: d('2026-10-05T10:00:00Z') }),
      invoice({ paymentMethod: PaymentMethod.NONE }),
      // Cancelled invoice and its credit note: listed, never counted
      invoice({ amountCents: 9900, cancelledAt: d('2026-11-12T10:00:00Z') }),
      invoice({ type: InvoiceType.CREDIT_NOTE, amountCents: -9900 }),
    ]);
    expect(totals).toMatchObject({
      collectedCents: 16000,
      unpaidCents: 5000,
      count: 4,
      byPaymentMethod: { CASH: 5000, CHECK: 6000, CARD: 5000, TRANSFER: 0, NONE: 5000 },
    });
    expect(totals.byMonth).toEqual([
      expect.objectContaining({ month: '2026-10', collectedCents: 5000, count: 1 }),
      expect.objectContaining({ month: '2026-11', collectedCents: 11000, unpaidCents: 5000, count: 3 }),
    ]);
  });

  it('counts patients and payers apart; a payer invoice is paid once « réglée »', () => {
    const totals = summarize([
      invoice({ amountCents: 2000, recipient: InvoiceRecipient.PATIENT }),
      invoice({ amountCents: 1500, paymentMethod: PaymentMethod.NONE, recipient: InvoiceRecipient.PATIENT }),
      invoice({ amountCents: 9000, paymentMethod: PaymentMethod.NONE, recipient: InvoiceRecipient.PAYER, paidAt: d('2026-12-01T00:00:00Z') }),
      invoice({ amountCents: 6000, paymentMethod: PaymentMethod.NONE, recipient: InvoiceRecipient.PAYER, paidAt: null }),
    ]);
    expect(totals).toMatchObject({
      collectedCents: 11000,
      unpaidCents: 7500,
      count: 4,
      // Payer invoices are not « Non réglé » by payment method
      byPaymentMethod: { CARD: 2000, NONE: 1500 },
      patients: { invoicedCents: 3500, collectedCents: 2000, unpaidCents: 1500, count: 2 },
      payers: { invoicedCents: 15000, collectedCents: 9000, unpaidCents: 6000, count: 2 },
    });
  });

  it('is zero for an empty period', () => {
    expect(summarize([])).toMatchObject({ collectedCents: 0, unpaidCents: 0, count: 0, byMonth: [] });
  });
});

describe('invoiceStatus', () => {
  it('says whether an invoice is paid, unpaid or cancelled, and names credit notes', () => {
    const base = { type: InvoiceType.INVOICE, cancelledAt: null, paymentMethod: PaymentMethod.CARD };
    expect(invoiceStatus(base)).toBe('Acquittée');
    expect(invoiceStatus({ ...base, paymentMethod: PaymentMethod.NONE })).toBe('Non réglée');
    expect(invoiceStatus({ ...base, cancelledAt: new Date() })).toBe('Annulée');
    expect(invoiceStatus({ ...base, type: InvoiceType.CREDIT_NOTE })).toBe('Avoir');
    const payer = { ...base, paymentMethod: PaymentMethod.NONE, recipient: InvoiceRecipient.PAYER };
    expect(invoiceStatus({ ...payer, paidAt: null })).toBe('En attente');
    expect(invoiceStatus({ ...payer, paidAt: new Date() })).toBe('Réglée');
  });
});

describe('invoicesCsv', () => {
  const row = (over: Partial<CsvInvoice> = {}): CsvInvoice => ({
    number: '2026-0012',
    type: InvoiceType.INVOICE,
    issuedAt: d('2026-11-20T10:00:00Z'),
    patientFirstName: 'Martine',
    patientLastName: 'Roux',
    serviceLabel: 'Suivi',
    serviceDate: d('2026-11-20T09:00:00Z'),
    amountCents: 5000,
    paymentMethod: PaymentMethod.CARD,
    cancelledAt: null,
    cancelReason: null,
    ...over,
  });

  it('writes a header and one line per document, every status included', () => {
    const csv = invoicesCsv([
      row({ cancelledAt: d('2026-11-22T10:00:00Z'), creditNote: { number: 'A-2026-0001' }, replacedBy: { number: '2026-0013' } }),
      row({ number: 'A-2026-0001', type: InvoiceType.CREDIT_NOTE, amountCents: -5000, issuedAt: d('2026-11-22T10:00:00Z'), cancels: { number: '2026-0012' } }),
      row({ number: '2026-0013', amountCents: 6050, paymentMethod: PaymentMethod.NONE, replaces: { number: '2026-0012' } }),
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      "Numéro;Type;Facturé à;Date d'émission;Patient;Organisme;Prestation;Date de la séance ou période;Prix (€);Remise (€);Part de l'organisme (€);Part du patient (€);Montant facturé (€);Moyen de paiement;Statut;Réglée le;Compté dans le total;Annulée le;Motif d'annulation;Avoir;Annule la facture;Remplacée par;Remplace",
    );
    // Invoices issued before lot 16 have no price, discount nor payer part
    expect(lines[1]).toBe('2026-0012;Facture;Patient;20/11/2026;Roux Martine;;Suivi;20/11/2026;;;;50,00;50,00;Carte;Annulée;;Non;22/11/2026;;A-2026-0001;;2026-0013;');
    expect(lines[2]).toBe('A-2026-0001;Avoir;Patient;22/11/2026;Roux Martine;;Suivi;20/11/2026;;;;-50,00;-50,00;Carte;Avoir;;Non;;;;2026-0012;;');
    expect(lines[3]).toBe('2026-0013;Facture;Patient;20/11/2026;Roux Martine;;Suivi;20/11/2026;;;;60,50;60,50;Non réglé;Non réglée;;Oui;;;;;;2026-0012');
  });

  it('splits what patients and payers pay: price, discount, payer part, patient part', () => {
    const csv = invoicesCsv([
      row({
        recipient: InvoiceRecipient.PATIENT,
        priceCents: 6000,
        discountCents: 1000,
        payerCents: 3000,
        payerName: 'Mutuelle Horizon',
        amountCents: 2000,
      }),
      row({
        number: '2026-0014',
        recipient: InvoiceRecipient.PAYER,
        patientFirstName: null,
        patientLastName: null,
        payerName: 'Mutuelle Horizon',
        serviceLabel: 'Prise en charge de séances de diététique',
        periodStart: d('2026-11-01T00:00:00Z'),
        periodEnd: d('2026-11-30T00:00:00Z'),
        amountCents: 9000,
        paymentMethod: PaymentMethod.NONE,
        paidAt: d('2026-12-15T00:00:00Z'),
      }),
    ]);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[1]).toBe('2026-0012;Facture;Patient;20/11/2026;Roux Martine;Mutuelle Horizon;Suivi;20/11/2026;60,00;10,00;30,00;20,00;20,00;Carte;Acquittée;;Oui;;;;;;');
    expect(lines[2]).toBe(
      '2026-0014;Facture;Organisme;20/11/2026;;Mutuelle Horizon;Prise en charge de séances de diététique;du 01/11/2026 au 30/11/2026;;;90,00;;90,00;;Réglée;15/12/2026;Oui;;;;;;',
    );
  });

  it('quotes cells holding a separator, a quote or a line break', () => {
    const csv = invoicesCsv([row({ cancelReason: 'Offerte; "geste"\ncommercial', cancelledAt: d('2026-11-22T10:00:00Z') })]);
    expect(csv).toContain(';"Offerte; ""geste""\ncommercial";');
  });
});
