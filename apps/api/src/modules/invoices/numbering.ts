import { InvoiceType, Prisma } from '@prisma/client';

/** The practice's time zone: the year of an invoice and the day of a session are read there. */
export const PRACTICE_TIME_ZONE = 'Europe/Paris';

const dayFormat = new Intl.DateTimeFormat('fr-CA', {
  timeZone: PRACTICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "2026-11-22": the calendar day in Paris. */
export function parisDay(date: Date): string {
  return dayFormat.format(date);
}

/** The year in Paris: an invoice issued on 31 December at 23:30 belongs to that year. */
export function parisYear(date: Date): number {
  return Number(parisDay(date).slice(0, 4));
}

/** "2026-0001" for an invoice, "A-2026-0001" for a credit note ("avoir"). */
export function formatInvoiceNumber(type: InvoiceType, year: number, sequence: number): string {
  const number = `${year}-${String(sequence).padStart(4, '0')}`;
  return type === InvoiceType.CREDIT_NOTE ? `A-${number}` : number;
}

/**
 * Reserves the next number of a series (practitioner, type, year). Must run inside the issuing
 * transaction: the advisory lock serialises concurrent issues of the same series until the
 * transaction ends, and the number is read from the invoices actually saved. A rolled-back
 * transaction leaves no number behind, so the series has no gaps. The unique index on
 * (practitioner, type, year, sequence) is the last safety net.
 */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  practitionerId: string,
  type: InvoiceType,
  issuedAt: Date,
) {
  const year = parisYear(issuedAt);
  const series = `invoice:${practitionerId}:${type}:${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${series}))`;
  const last = await tx.invoice.aggregate({
    where: { practitionerId, type, year },
    _max: { sequence: true },
  });
  const sequence = (last._max.sequence ?? 0) + 1;
  return { year, sequence, number: formatInvoiceNumber(type, year, sequence) };
}
