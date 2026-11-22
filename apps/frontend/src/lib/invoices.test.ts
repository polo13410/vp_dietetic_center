import { describe, expect, it } from 'vitest';

import { bilanInvoice, cancelledInvoice, creditNote, replacement } from '../test/invoice-fixtures';

import { invoiceDocumentContent } from './invoice-document';
import {
  countsInTotals,
  currentPeriod,
  invoiceFilename,
  invoiceStatus,
  linksText,
  mismatchText,
  monthLabel,
  periodLabel,
  periodRange,
  shiftPeriod,
} from './invoices';

describe('invoice statuses', () => {
  it('names each document and counts only invoices in force', () => {
    expect(invoiceStatus(bilanInvoice)).toEqual({ label: 'Acquittée', tone: 'success' });
    expect(invoiceStatus({ ...bilanInvoice, paymentMethod: 'NONE' as never })).toEqual({ label: 'Non réglée', tone: 'warning' });
    expect(invoiceStatus(cancelledInvoice)).toEqual({ label: 'Annulée', tone: 'danger' });
    expect(invoiceStatus(creditNote)).toEqual({ label: 'Avoir', tone: 'neutral' });
    expect([bilanInvoice, cancelledInvoice, creditNote, replacement].map(countsInTotals)).toEqual([true, false, false, true]);
  });

  it('gives the links between a cancelled invoice, its credit note and its replacement', () => {
    expect(linksText(cancelledInvoice)).toEqual(['Annulée par l’avoir A-2026-0001', 'Remplacée par la 2026-0014']);
    expect(linksText(creditNote)).toEqual(['Annule la 2026-0010']);
    expect(linksText(replacement)).toEqual(['Remplace la 2026-0010']);
    expect(linksText({ ...cancelledInvoice, cancelReason: 'Séance offerte', replacedBy: null })).toContain('Motif : Séance offerte');
  });

  it('says what no longer matches the session', () => {
    expect(mismatchText(['price'])).toBe('le prix');
    expect(mismatchText(['price', 'paymentMethod'])).toBe('le prix et le moyen de paiement');
    expect(mismatchText(['formula', 'price', 'date'])).toBe('la formule, le prix et la date');
  });

  it('names the PDF files', () => {
    expect(invoiceFilename(bilanInvoice)).toBe('facture-2026-0006.pdf');
    expect(invoiceFilename(creditNote)).toBe('avoir-A-2026-0001.pdf');
  });
});

describe('periods', () => {
  const now = new Date(2026, 10, 22);

  it('starts on the current month, quarter or year', () => {
    expect(currentPeriod('month', now)).toEqual({ kind: 'month', year: 2026, index: 10 });
    expect(currentPeriod('quarter', now)).toEqual({ kind: 'quarter', year: 2026, index: 3 });
    expect(currentPeriod('year', now)).toEqual({ kind: 'year', year: 2026, index: 0 });
  });

  it('gives first and last days, leap years included', () => {
    expect(periodRange({ kind: 'month', year: 2026, index: 10 })).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange({ kind: 'month', year: 2028, index: 1 })).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(periodRange({ kind: 'quarter', year: 2026, index: 3 })).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(periodRange({ kind: 'year', year: 2026, index: 0 })).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('moves across years', () => {
    expect(shiftPeriod({ kind: 'month', year: 2026, index: 11 }, 1)).toEqual({ kind: 'month', year: 2027, index: 0 });
    expect(shiftPeriod({ kind: 'quarter', year: 2026, index: 0 }, -1)).toEqual({ kind: 'quarter', year: 2025, index: 3 });
    expect(shiftPeriod({ kind: 'year', year: 2026, index: 0 }, -1)).toEqual({ kind: 'year', year: 2025, index: 0 });
  });

  it('labels periods in her words', () => {
    expect(periodLabel({ kind: 'month', year: 2026, index: 10 })).toBe('novembre 2026');
    expect(periodLabel({ kind: 'quarter', year: 2026, index: 3 })).toBe('4e trimestre 2026');
    expect(periodLabel({ kind: 'year', year: 2026, index: 0 })).toBe('2026');
    expect(monthLabel('2026-02')).toBe('février 2026');
  });
});

describe('invoiceDocumentContent (the test patient of § 3.1)', () => {
  it('prints the mentions of the practice, the patient, the service and « Acquittée »', () => {
    const c = invoiceDocumentContent(bilanInvoice);
    expect(c.title).toBe('Facture');
    expect(c.number).toBe('2026-0006');
    expect(c.issuedOn).toBe('23 septembre 2026');
    expect(c.practice).toEqual(['Valérie Perrot, diététicienne nutritionniste', '12 rue des Oliviers', '13100 Aix-en-Provence']);
    expect(c.identifiers).toEqual(['SIRET : 912 345 678 00011', 'N° ADELI : 139512345']);
    expect(c.patient).toEqual(['Martine Roux', '12 rue des Lilas', '34000 Montpellier']);
    expect(c.service).toEqual({ label: 'Bilan', date: 'Séance du 23 septembre 2026', amount: '60,00 €' });
    expect(c.paid).toBe('Acquittée — réglée par chèque');
    expect(c.vatMention).toBe('TVA non applicable, article 261-4-1° du CGI');
    expect(c.footer).toBe('Règlement à réception. Merci de votre confiance.');
  });

  it('never invents a VAT mention, and says nothing of payment when unpaid', () => {
    const c = invoiceDocumentContent({ ...bilanInvoice, vatMention: null, paymentMethod: 'NONE' as never });
    expect(c.vatMention).toBeNull();
    expect(c.paid).toBeNull();
  });

  it('names an RPPS number by its length', () => {
    expect(invoiceDocumentContent({ ...bilanInvoice, adeliRpps: '10101010101' }).identifiers).toContain('N° RPPS : 10101010101');
  });

  it('prints a credit note in negative, with the invoice it cancels', () => {
    const c = invoiceDocumentContent(creditNote);
    expect(c.title).toBe('Avoir');
    expect(c.total).toBe('-50,00 €');
    expect(c.paid).toBeNull();
    expect(c.references).toEqual(['Annule la facture n° 2026-0010 du 23 octobre 2026']);
    expect(invoiceDocumentContent(replacement).references).toEqual(['Remplace la facture n° 2026-0010 du 23 octobre 2026']);
  });

  it('uses plain spaces, which the PDF fonts can print', () => {
    expect(invoiceDocumentContent({ ...bilanInvoice, amountCents: 140030 }).total).toBe('1 400,30 €');
  });
});
