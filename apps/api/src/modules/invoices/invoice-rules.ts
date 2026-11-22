import { Invoice, InvoiceType, PaymentMethod } from '@prisma/client';

import { parisDay } from './numbering';

/** What an invoice no longer matches in its session (shown in a banner on the session). */
export type InvoiceMismatch = 'formula' | 'price' | 'paymentMethod' | 'date';

type Billed = Pick<Invoice, 'serviceLabel' | 'amountCents' | 'paymentMethod' | 'serviceDate'>;
type Session = { formulaLabel: string | null; priceCents: number | null; paymentMethod: PaymentMethod; date: Date };

/** Differences between an issued invoice and its session as it is now. */
export function invoiceMismatches(invoice: Billed, session: Session): InvoiceMismatch[] {
  const mismatches: InvoiceMismatch[] = [];
  if ((session.formulaLabel ?? '') !== invoice.serviceLabel) mismatches.push('formula');
  if (session.priceCents !== invoice.amountCents) mismatches.push('price');
  if (session.paymentMethod !== invoice.paymentMethod) mismatches.push('paymentMethod');
  if (parisDay(session.date) !== parisDay(invoice.serviceDate)) mismatches.push('date');
  return mismatches;
}

type Counted = Pick<Invoice, 'type' | 'cancelledAt' | 'amountCents' | 'paymentMethod' | 'issuedAt'>;

/**
 * Only invoices in force count: cancelled invoices and credit notes are listed (struck through)
 * but left out of the totals, so a corrected invoice is counted once.
 */
export function countsInTotals(invoice: Pick<Invoice, 'type' | 'cancelledAt'>): boolean {
  return invoice.type === InvoiceType.INVOICE && invoice.cancelledAt === null;
}

export interface InvoiceTotals {
  /** Paid by any means (« encaissé ») */
  collectedCents: number;
  /** Invoiced but « Non réglé » */
  unpaidCents: number;
  /** Invoices in force */
  count: number;
  byPaymentMethod: Record<PaymentMethod, number>;
}

function emptyTotals(): InvoiceTotals {
  return {
    collectedCents: 0,
    unpaidCents: 0,
    count: 0,
    byPaymentMethod: { CASH: 0, CHECK: 0, CARD: 0, TRANSFER: 0, NONE: 0 },
  };
}

function add(totals: InvoiceTotals, invoice: Counted) {
  totals.count += 1;
  totals.byPaymentMethod[invoice.paymentMethod] += invoice.amountCents;
  if (invoice.paymentMethod === PaymentMethod.NONE) totals.unpaidCents += invoice.amountCents;
  else totals.collectedCents += invoice.amountCents;
}

/** Totals of a period, overall and per month of issue ("2026-11"), months in order. */
export function summarize(invoices: Counted[]) {
  const total = emptyTotals();
  const months = new Map<string, InvoiceTotals>();
  for (const invoice of invoices) {
    if (!countsInTotals(invoice)) continue;
    add(total, invoice);
    const month = parisDay(invoice.issuedAt).slice(0, 7);
    if (!months.has(month)) months.set(month, emptyTotals());
    add(months.get(month)!, invoice);
  }
  const byMonth = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => ({ month, ...totals }));
  return { ...total, byMonth };
}

// ─── CSV for the accountant ───────────────────────────────────────────────────

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CHECK: 'Chèque',
  CARD: 'Carte',
  TRANSFER: 'Virement',
  NONE: 'Non réglé',
};

type Linked = { number: string } | null;

export type CsvInvoice = Pick<
  Invoice,
  | 'number'
  | 'type'
  | 'issuedAt'
  | 'patientFirstName'
  | 'patientLastName'
  | 'serviceLabel'
  | 'serviceDate'
  | 'amountCents'
  | 'paymentMethod'
  | 'cancelledAt'
  | 'cancelReason'
> & { creditNote?: Linked; replacedBy?: Linked; cancels?: Linked; replaces?: Linked };

/** « Annulée », « Acquittée », « Non réglée » for an invoice; « Avoir » for a credit note. */
export function invoiceStatus(invoice: Pick<Invoice, 'type' | 'cancelledAt' | 'paymentMethod'>): string {
  if (invoice.type === InvoiceType.CREDIT_NOTE) return 'Avoir';
  if (invoice.cancelledAt) return 'Annulée';
  return invoice.paymentMethod === PaymentMethod.NONE ? 'Non réglée' : 'Acquittée';
}

const CSV_COLUMNS: [string, (i: CsvInvoice) => string][] = [
  ['Numéro', (i) => i.number],
  ['Type', (i) => (i.type === InvoiceType.CREDIT_NOTE ? 'Avoir' : 'Facture')],
  ["Date d'émission", (i) => frenchDate(i.issuedAt)],
  ['Patient', (i) => `${i.patientLastName} ${i.patientFirstName}`],
  ['Prestation', (i) => i.serviceLabel],
  ['Date de la séance', (i) => frenchDate(i.serviceDate)],
  ['Montant (€)', (i) => euros(i.amountCents)],
  ['Moyen de paiement', (i) => PAYMENT_LABELS[i.paymentMethod]],
  ['Statut', (i) => invoiceStatus(i)],
  ["Compté dans le total", (i) => (countsInTotals(i) ? 'Oui' : 'Non')],
  ['Annulée le', (i) => (i.cancelledAt ? frenchDate(i.cancelledAt) : '')],
  ["Motif d'annulation", (i) => i.cancelReason ?? ''],
  ['Avoir', (i) => i.creditNote?.number ?? ''],
  ['Annule la facture', (i) => i.cancels?.number ?? ''],
  ['Remplacée par', (i) => i.replacedBy?.number ?? ''],
  ['Remplace', (i) => i.replaces?.number ?? ''],
];

/**
 * The invoices of a period for the accountant, every status included. French spreadsheet
 * conventions: « ; » between columns, decimal comma, a BOM so accents open correctly.
 */
export function invoicesCsv(invoices: CsvInvoice[]): string {
  const lines = [
    CSV_COLUMNS.map(([label]) => label),
    ...invoices.map((invoice) => CSV_COLUMNS.map(([, value]) => value(invoice))),
  ];
  return '﻿' + lines.map((cells) => cells.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

function csvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** "22/11/2026" in Paris. */
function frenchDate(date: Date): string {
  const [year, month, day] = parisDay(date).split('-');
  return `${day}/${month}/${year}`;
}

/** "-60,00" */
function euros(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}
