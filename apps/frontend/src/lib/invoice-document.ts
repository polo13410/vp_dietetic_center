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
  patient: string[];
  service: { label: string; date: string; amount: string };
  total: string;
  /** « Acquittée — réglée par chèque », for a paid invoice only */
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

export function invoiceDocumentContent(invoice: InvoiceDto): InvoiceDocumentContent {
  const creditNote = invoice.type === 'CREDIT_NOTE';
  const references: string[] = [];
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

  return {
    title: creditNote ? 'Avoir' : 'Facture',
    number: invoice.number,
    issuedOn: formatLongDay(invoice.issuedAt),
    practice: lines(invoice.practiceName, invoice.practiceAddress, cityLine(invoice.practiceZipCode, invoice.practiceCity)),
    identifiers,
    patient: lines(
      `${invoice.patientFirstName} ${invoice.patientLastName}`,
      invoice.patientAddress,
      cityLine(invoice.patientZipCode, invoice.patientCity),
    ),
    service: {
      label: invoice.serviceLabel,
      date: `Séance du ${formatLongDay(invoice.serviceDate)}`,
      amount: formatAmount(invoice.amountCents),
    },
    total: formatAmount(invoice.amountCents),
    paid:
      !creditNote && invoice.paymentMethod !== 'NONE'
        ? `Acquittée — réglée ${PAID_BY[invoice.paymentMethod]}`
        : null,
    references,
    vatMention: invoice.vatMention?.trim() || null,
    footer: invoice.invoiceFooter?.trim() || null,
  };
}
