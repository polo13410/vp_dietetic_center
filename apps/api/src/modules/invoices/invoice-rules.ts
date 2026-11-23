import { Invoice, InvoiceRecipient, InvoiceType, PaymentMethod } from '@prisma/client';

import { parisDay } from './numbering';
import { splitOf } from './session-split';

/** What an invoice no longer matches in its session (shown in a banner on the session). */
export type InvoiceMismatch = 'formula' | 'price' | 'discount' | 'payer' | 'paymentMethod' | 'date' | 'practice';

type Billed = Pick<
  Invoice,
  | 'serviceLabel'
  | 'amountCents'
  | 'paymentMethod'
  | 'serviceDate'
  | 'practiceAddress'
  | 'practiceZipCode'
  | 'practiceCity'
  | 'priceCents'
  | 'discountCents'
  | 'payerCents'
  | 'payerName'
>;
type Place = { address: string | null; zipCode: string | null; city: string | null };
type Session = {
  formulaLabel: string | null;
  priceCents: number | null;
  discountCents?: number | null;
  netCents?: number | null;
  payerCents?: number | null;
  patientCents?: number | null;
  /** Name of the session's payer now */
  payerName?: string | null;
  paymentMethod: PaymentMethod;
  date: Date;
  /** Where it took place now; left out, the address is not compared */
  practice?: Place | null;
};

/** Differences between an issued patient invoice and its session as it is now. */
export function invoiceMismatches(invoice: Billed, session: Session): InvoiceMismatch[] {
  const mismatches: InvoiceMismatch[] = [];
  const split = splitOf(session);
  if ((session.formulaLabel ?? '') !== invoice.serviceLabel) mismatches.push('formula');
  // Invoices issued before lot 16 billed the price, without discount nor payer part
  if (session.priceCents !== (invoice.priceCents ?? invoice.amountCents)) mismatches.push('price');
  if ((split?.discountCents ?? 0) !== (invoice.discountCents ?? 0)) mismatches.push('discount');
  const payerCents = split?.payerCents ?? 0;
  if (
    payerCents !== (invoice.payerCents ?? 0) ||
    (payerCents > 0 && session.payerName !== undefined && (session.payerName ?? null) !== invoice.payerName)
  ) {
    mismatches.push('payer');
  }
  if (session.paymentMethod !== invoice.paymentMethod) mismatches.push('paymentMethod');
  if (parisDay(session.date) !== parisDay(invoice.serviceDate)) mismatches.push('date');
  if (session.practice !== undefined) {
    const place = session.practice;
    const billed = [invoice.practiceAddress, invoice.practiceZipCode, invoice.practiceCity];
    const now = [place?.address ?? null, place?.zipCode ?? null, place?.city ?? null];
    if (billed.some((value, i) => value !== now[i])) mismatches.push('practice');
  }
  return mismatches;
}

type Counted = Pick<Invoice, 'type' | 'cancelledAt' | 'amountCents' | 'paymentMethod' | 'issuedAt'> &
  Partial<Pick<Invoice, 'recipient' | 'paidAt'>>;

/**
 * Only invoices in force count: cancelled invoices and credit notes are listed (struck through)
 * but left out of the totals, so a corrected invoice is counted once.
 */
export function countsInTotals(invoice: Pick<Invoice, 'type' | 'cancelledAt'>): boolean {
  return invoice.type === InvoiceType.INVOICE && invoice.cancelledAt === null;
}

const isPayerInvoice = (invoice: Partial<Pick<Invoice, 'recipient'>>) => invoice.recipient === InvoiceRecipient.PAYER;

/** Invoiced to one kind of recipient: what was paid and what is still due. */
export interface RecipientTotals {
  invoicedCents: number;
  /** Patients: paid by any means. Payers: « réglée ». */
  collectedCents: number;
  /** Patients: « Non réglé ». Payers: « en attente ». */
  unpaidCents: number;
  count: number;
}

export interface InvoiceTotals {
  /** Paid, by patients and by payers (« encaissé ») */
  collectedCents: number;
  /** Not paid yet: patients' « Non réglé » and payers' « en attente » */
  unpaidCents: number;
  /** Invoices in force */
  count: number;
  /** Patient invoices only (payer invoices are followed with their payment day) */
  byPaymentMethod: Record<PaymentMethod, number>;
  patients: RecipientTotals;
  payers: RecipientTotals;
}

const emptyRecipient = (): RecipientTotals => ({ invoicedCents: 0, collectedCents: 0, unpaidCents: 0, count: 0 });

function emptyTotals(): InvoiceTotals {
  return {
    collectedCents: 0,
    unpaidCents: 0,
    count: 0,
    byPaymentMethod: { CASH: 0, CHECK: 0, CARD: 0, TRANSFER: 0, NONE: 0 },
    patients: emptyRecipient(),
    payers: emptyRecipient(),
  };
}

function add(totals: InvoiceTotals, invoice: Counted) {
  const payer = isPayerInvoice(invoice);
  const paid = payer ? !!invoice.paidAt : invoice.paymentMethod !== PaymentMethod.NONE;
  const side = payer ? totals.payers : totals.patients;
  totals.count += 1;
  side.count += 1;
  side.invoicedCents += invoice.amountCents;
  if (!payer) totals.byPaymentMethod[invoice.paymentMethod] += invoice.amountCents;
  if (paid) {
    totals.collectedCents += invoice.amountCents;
    side.collectedCents += invoice.amountCents;
  } else {
    totals.unpaidCents += invoice.amountCents;
    side.unpaidCents += invoice.amountCents;
  }
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
> &
  Partial<
    Pick<
      Invoice,
      'recipient' | 'priceCents' | 'discountCents' | 'payerCents' | 'payerName' | 'periodStart' | 'periodEnd' | 'paidAt'
    >
  > & { creditNote?: Linked; replacedBy?: Linked; cancels?: Linked; replaces?: Linked };

/**
 * « Annulée », « Acquittée », « Non réglée » for a patient invoice; « Réglée » or « En
 * attente » for a payer invoice; « Avoir » for a credit note.
 */
export function invoiceStatus(
  invoice: Pick<Invoice, 'type' | 'cancelledAt' | 'paymentMethod'> & Partial<Pick<Invoice, 'recipient' | 'paidAt'>>,
): string {
  if (invoice.type === InvoiceType.CREDIT_NOTE) return 'Avoir';
  if (invoice.cancelledAt) return 'Annulée';
  if (isPayerInvoice(invoice)) return invoice.paidAt ? 'Réglée' : 'En attente';
  return invoice.paymentMethod === PaymentMethod.NONE ? 'Non réglée' : 'Acquittée';
}

const optionalEuros = (cents: number | null | undefined) => (cents === null || cents === undefined ? '' : euros(cents));
const patientName = (i: CsvInvoice) => [i.patientLastName, i.patientFirstName].filter(Boolean).join(' ');

const CSV_COLUMNS: [string, (i: CsvInvoice) => string][] = [
  ['Numéro', (i) => i.number],
  ['Type', (i) => (i.type === InvoiceType.CREDIT_NOTE ? 'Avoir' : 'Facture')],
  ['Facturé à', (i) => (isPayerInvoice(i) ? 'Organisme' : 'Patient')],
  ["Date d'émission", (i) => frenchDate(i.issuedAt)],
  ['Patient', (i) => patientName(i)],
  ['Organisme', (i) => i.payerName ?? ''],
  ['Prestation', (i) => i.serviceLabel],
  [
    'Date de la séance ou période',
    (i) =>
      isPayerInvoice(i) && i.periodStart && i.periodEnd
        ? `du ${frenchDay(i.periodStart)} au ${frenchDay(i.periodEnd)}`
        : frenchDate(i.serviceDate),
  ],
  ['Prix (€)', (i) => optionalEuros(i.priceCents)],
  ['Remise (€)', (i) => optionalEuros(i.discountCents)],
  // A patient invoice: what the payer pays on top (billed to it apart); a payer invoice: its amount
  ["Part de l'organisme (€)", (i) => (isPayerInvoice(i) ? euros(i.amountCents) : optionalEuros(i.payerCents))],
  ['Part du patient (€)', (i) => (isPayerInvoice(i) ? '' : euros(i.amountCents))],
  ['Montant facturé (€)', (i) => euros(i.amountCents)],
  ['Moyen de paiement', (i) => (isPayerInvoice(i) ? '' : PAYMENT_LABELS[i.paymentMethod])],
  ['Statut', (i) => invoiceStatus(i)],
  ['Réglée le', (i) => (i.paidAt ? frenchDay(i.paidAt) : '')],
  ['Compté dans le total', (i) => (countsInTotals(i) ? 'Oui' : 'Non')],
  ['Annulée le', (i) => (i.cancelledAt ? frenchDate(i.cancelledAt) : '')],
  ["Motif d'annulation", (i) => i.cancelReason ?? ''],
  ['Avoir', (i) => i.creditNote?.number ?? ''],
  ['Annule la facture', (i) => i.cancels?.number ?? ''],
  ['Remplacée par', (i) => i.replacedBy?.number ?? ''],
  ['Remplace', (i) => i.replaces?.number ?? ''],
];

/**
 * The invoices of a period for the accountant, every status included, patients' and payers'
 * apart (« Facturé à »). French spreadsheet conventions: « ; » between columns, decimal comma,
 * a BOM so accents open correctly.
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

/** "22/11/2026" for a day stored as a date (midnight UTC). */
function frenchDay(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** "-60,00" */
function euros(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}
