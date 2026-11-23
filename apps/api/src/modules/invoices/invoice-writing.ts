import { Invoice, InvoiceType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { nextInvoiceNumber } from './numbering';

export type Tx = Prisma.TransactionClient;

/** The documents an invoice is linked to, by number. */
export const LINKS = {
  creditNote: { select: { id: true, number: true, issuedAt: true } },
  replacedBy: { select: { id: true, number: true, issuedAt: true } },
  cancels: { select: { id: true, number: true, issuedAt: true } },
  replaces: { select: { id: true, number: true, issuedAt: true } },
} satisfies Prisma.InvoiceInclude;

/** A payer invoice to print: its links and its sessions. */
export const WITH_LINES = {
  ...LINKS,
  lines: { orderBy: { position: 'asc' } },
} satisfies Prisma.InvoiceInclude;

/**
 * Runs `fn` in a transaction holding the practitioner's invoice lock: every write of her
 * invoices (patient and payer ones share one series) is serialised, so numbers have no gaps and
 * a session cannot be invoiced twice.
 */
export function withInvoiceLock<T>(prisma: PrismaService, practitionerId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoices:${practitionerId}`}))`;
    return fn(tx);
  });
}

type Place = { address: string | null; zipCode: string | null; city: string | null; siret?: string | null } | null;

/**
 * What every invoice copies of its issuer: the activity (name, numbers, mentions) and the
 * address of the practice (with its own SIRET when it has one, else the activity's).
 */
export async function issuerCopy(tx: Tx, practitionerId: string, place: Place) {
  const [activity, practitioner] = await Promise.all([
    tx.practitionerProfile.findUnique({ where: { userId: practitionerId } }),
    tx.user.findUniqueOrThrow({ where: { id: practitionerId }, select: { firstName: true, lastName: true } }),
  ]);
  return {
    practiceName: activity?.practiceName || `${practitioner.firstName} ${practitioner.lastName}`,
    practiceAddress: place?.address ?? null,
    practiceZipCode: place?.zipCode ?? null,
    practiceCity: place?.city ?? null,
    siret: place?.siret ?? activity?.siret ?? null,
    adeliRpps: activity?.adeliRpps ?? null,
    vatMention: activity?.vatMention ?? null,
    invoiceFooter: activity?.invoiceFooter ?? null,
  };
}

/** What a credit note reproduces of the invoice it cancels: everything but its own identity. */
const CREDIT_NOTE_COPY = [
  'practitionerId',
  'patientId',
  'consultationId',
  'recipient',
  'payerId',
  'paymentMethod',
  'serviceLabel',
  'serviceDate',
  'discountReason',
  'payerName',
  'payerAddress',
  'payerZipCode',
  'payerCity',
  'payerContact',
  'conventionReference',
  'periodStart',
  'periodEnd',
  'practiceName',
  'practiceAddress',
  'practiceZipCode',
  'practiceCity',
  'siret',
  'adeliRpps',
  'vatMention',
  'invoiceFooter',
  'patientFirstName',
  'patientLastName',
  'patientAddress',
  'patientZipCode',
  'patientCity',
] as const satisfies readonly (keyof Invoice)[];

const negative = (cents: number | null) => (cents === null ? null : -cents);

/**
 * The credit note of an invoice: the same document, in negative (amounts and, for a payer
 * invoice, each of its sessions), with its own number.
 */
export async function createCreditNote(tx: Tx, invoice: Invoice, now: Date) {
  const numbering = await nextInvoiceNumber(tx, invoice.practitionerId, InvoiceType.CREDIT_NOTE, now);
  const copy = Object.fromEntries(CREDIT_NOTE_COPY.map((key) => [key, invoice[key]])) as Pick<
    Invoice,
    (typeof CREDIT_NOTE_COPY)[number]
  >;
  const lines = await tx.invoiceLine.findMany({ where: { invoiceId: invoice.id }, orderBy: { position: 'asc' } });
  return tx.invoice.create({
    data: {
      ...copy,
      ...numbering,
      type: InvoiceType.CREDIT_NOTE,
      issuedAt: now,
      amountCents: -invoice.amountCents,
      priceCents: negative(invoice.priceCents),
      discountCents: negative(invoice.discountCents),
      payerCents: negative(invoice.payerCents),
      ...(lines.length > 0 && {
        lines: {
          create: lines.map(({ id: _id, invoiceId: _invoice, amountCents, ...line }) => ({
            ...line,
            amountCents: -amountCents,
          })),
        },
      }),
    },
  });
}

/** Cancels an invoice in force with its credit note; returns the credit note with its links. */
export async function cancelWithCreditNote(tx: Tx, invoice: Invoice, reason: string | null, now: Date) {
  const creditNote = await createCreditNote(tx, invoice, now);
  await tx.invoice.update({
    where: { id: invoice.id },
    data: { cancelledAt: now, cancelReason: reason, creditNoteId: creditNote.id },
  });
  return tx.invoice.findUniqueOrThrow({ where: { id: creditNote.id }, include: LINKS });
}
