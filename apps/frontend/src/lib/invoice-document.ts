/** What an invoice or credit note says, from its copies only (it never changes once issued). */
import type { InvoiceDto } from '@vp/types';

import type { PaymentMethod } from './patient-file';

export interface InvoiceDocumentContent {
  title: 'Facture' | 'Avoir';
  number: string;
  /** « 22 novembre 2026 » */
  issuedOn: string;
  /** Name, address, zip code and city */
  practice: string[];
  /** SIRET, ADELI or RPPS */
  identifiers: string[];
  /** « Patient » or « Organisme » (a payer invoice) */
  recipientLabel: 'Patient' | 'Organisme';
  /** Name, address, zip code and city (and the contact of a payer) */
  recipient: string[];
  /** Patient invoices: the session */
  service: { label: string; date: string; amount: string };
  /**
   * Patient invoices with a discount or a payer part (lot 16): the lines between the price and
   * what the patient pays (« Remise », « Net », « dont 30,00 € pris en charge par … »)
   */
  breakdown: { label: string; amount: string }[];
  /** Payer invoices: one line per session, nothing medical */
  lines: { date: string; patient: string; label: string; coverageNumber: string; amount: string }[] | null;
  /** « Total », or « Reste à votre charge » when a payer pays a part */
  totalLabel: string;
  total: string;
  /** « Acquittée — réglée par chèque », « Réglée le 15 décembre 2026 », for a paid invoice only */
  paid: string | null;
  /** « Remplace la facture n° 2026-0012 du 20 novembre 2026 » */
  references: string[];
  /** Typed by the practitioner in « Mon activité »; never invented here */
  vatMention: string | null;
  footer: string | null;
}

/** « réglée en espèces », « réglée par chèque »… */
const PAID_BY: Record<Exclude<PaymentMethod, 'NONE'>, string> = {
  CASH: 'en espèces',
  CHECK: 'par chèque',
  CARD: 'par carte bancaire',
  TRANSFER: 'par virement',
};

const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

/** PDF standard fonts have no narrow no-break space: plain spaces instead. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

export const formatLongDay = (iso: string) => plain(longDate.format(new Date(iso)));

/** « 50,00 € », « -50,00 € » */
export function formatAmount(cents: number): string {
  return plain(
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(cents / 100),
  );
}

/** « 912 345 678 00011 » (SIREN + NIC) */
function formatSiret(siret: string): string {
  return siret.length === 14 ? `${siret.slice(0, 3)} ${siret.slice(3, 6)} ${siret.slice(6, 9)} ${siret.slice(9)}` : siret;
}

const cityLine = (zipCode: string | null, city: string | null) => [zipCode, city].filter(Boolean).join(' ');
const lines = (...values: (string | null | undefined)[]) => values.filter((v): v is string => !!v && v.trim() !== '');

/** « 1er novembre 2026 » for a day stored at midnight UTC */
function dayText(iso: string): string {
  const [year, month, date] = iso.slice(0, 10).split('-').map(Number);
  return plain(longDate.format(new Date(Date.UTC(year, month - 1, date, 12))));
}

export function invoiceDocumentContent(invoice: InvoiceDto): InvoiceDocumentContent {
  const creditNote = invoice.type === 'CREDIT_NOTE';
  const payerInvoice = invoice.recipient === 'PAYER';
  const references: string[] = [];
  if (payerInvoice && invoice.periodStart && invoice.periodEnd) {
    references.push(`Séances du ${dayText(invoice.periodStart)} au ${dayText(invoice.periodEnd)}`);
  }
  if (payerInvoice && invoice.conventionReference) references.push(`Convention : ${invoice.conventionReference}`);
  if (invoice.cancels) {
    references.push(`Annule la facture n° ${invoice.cancels.number} du ${formatLongDay(invoice.cancels.issuedAt)}`);
  }
  if (invoice.replaces) {
    references.push(`Remplace la facture n° ${invoice.replaces.number} du ${formatLongDay(invoice.replaces.issuedAt)}`);
  }

  const identifiers = lines(
    invoice.siret && `SIRET : ${formatSiret(invoice.siret)}`,
    invoice.adeliRpps && `${invoice.adeliRpps.length === 11 ? 'N° RPPS' : 'N° ADELI'} : ${invoice.adeliRpps}`,
  );

  // A patient invoice shows its price, its discount and the payer part (« dont … pris en charge »)
  const discount = invoice.discountCents ?? 0;
  const payer = invoice.payerCents ?? 0;
  const split = !payerInvoice && !creditNote && invoice.priceCents !== null && (discount > 0 || payer > 0);
  const breakdown: InvoiceDocumentContent['breakdown'] = [];
  if (split) {
    if (discount > 0) {
      breakdown.push({ label: invoice.discountReason ? `Remise (${invoice.discountReason})` : 'Remise', amount: formatAmount(-discount) });
      breakdown.push({ label: 'Net', amount: formatAmount(invoice.priceCents! - discount) });
    }
    if (payer > 0) {
      breakdown.push({
        label: `dont ${formatAmount(payer)} pris en charge par ${invoice.payerName ?? 'un organisme'}`,
        amount: formatAmount(-payer),
      });
    }
  }

  let paid: string | null = null;
  if (!creditNote && payerInvoice && invoice.paidAt) paid = `Réglée le ${dayText(invoice.paidAt)}`;
  if (!creditNote && !payerInvoice && invoice.paymentMethod !== 'NONE') {
    paid = `Acquittée — réglée ${PAID_BY[invoice.paymentMethod]}`;
  }

  return {
    title: creditNote ? 'Avoir' : 'Facture',
    number: invoice.number,
    issuedOn: formatLongDay(invoice.issuedAt),
    practice: lines(invoice.practiceName, invoice.practiceAddress, cityLine(invoice.practiceZipCode, invoice.practiceCity)),
    identifiers,
    recipientLabel: payerInvoice ? 'Organisme' : 'Patient',
    recipient: payerInvoice
      ? lines(
          invoice.payerName,
          invoice.payerAddress,
          cityLine(invoice.payerZipCode, invoice.payerCity),
          invoice.payerContact && `À l’attention de : ${invoice.payerContact}`,
        )
      : lines(
          [invoice.patientFirstName, invoice.patientLastName].filter(Boolean).join(' '),
          invoice.patientAddress,
          cityLine(invoice.patientZipCode, invoice.patientCity),
        ),
    service: {
      label: invoice.serviceLabel,
      date: `Séance du ${formatLongDay(invoice.serviceDate)}`,
      amount: formatAmount(split ? invoice.priceCents! : invoice.amountCents),
    },
    breakdown,
    lines: payerInvoice
      ? (invoice.lines ?? []).map((line) => ({
          date: formatLongDay(line.serviceDate),
          patient: `${line.patientFirstName} ${line.patientLastName}`,
          label: line.serviceLabel,
          coverageNumber: line.coverageNumber ?? '',
          amount: formatAmount(line.amountCents),
        }))
      : null,
    totalLabel: split && payer > 0 ? 'Reste à votre charge' : 'Total',
    total: formatAmount(invoice.amountCents),
    paid,
    references,
    vatMention: invoice.vatMention?.trim() || null,
    footer: invoice.invoiceFooter?.trim() || null,
  };
}
