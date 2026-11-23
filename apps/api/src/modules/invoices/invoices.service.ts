import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceType, Prisma } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultPractice } from '../me/default-practice';

import { countsInTotals, invoiceMismatches, invoicesCsv, summarize } from './invoice-rules';
import { nextInvoiceNumber, parisDay } from './numbering';

type Tx = Prisma.TransactionClient;

/** The documents an invoice is linked to, by number. */
const LINKS = {
  creditNote: { select: { id: true, number: true, issuedAt: true } },
  replacedBy: { select: { id: true, number: true, issuedAt: true } },
  cancels: { select: { id: true, number: true, issuedAt: true } },
  replaces: { select: { id: true, number: true, issuedAt: true } },
} satisfies Prisma.InvoiceInclude;

/** What an invoice copies from its session: the patient, and where it took place. */
const SESSION_FOR_INVOICE = {
  patient: {
    select: { id: true, firstName: true, lastName: true, address: true, zipCode: true, city: true },
  },
  practice: { select: { address: true, zipCode: true, city: true, siret: true } },
} satisfies Prisma.ConsultationInclude;

type SessionForInvoice = Prisma.ConsultationGetPayload<{ include: typeof SESSION_FOR_INVOICE }>;

/** What a credit note reproduces of the invoice it cancels: everything but its own identity. */
const CREDIT_NOTE_COPY = [
  'practitionerId',
  'patientId',
  'consultationId',
  'paymentMethod',
  'serviceLabel',
  'serviceDate',
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

/** Reason recorded on the invoice of a deleted session. */
export const DELETED_SESSION_REASON = 'Séance supprimée';

/**
 * Invoices and credit notes (docs/REFONTE.md lot 5). An invoice is issued only when the
 * practitioner asks for it ("Faire la facture"); once issued it never changes. Mistakes are
 * corrected by a credit note ("avoir") that cancels it, followed, for a correction, by a new
 * invoice that replaces it. All writes of a practitioner's invoices are serialised by a lock
 * held until the end of their transaction, so numbers have no gaps and a session cannot be
 * invoiced twice.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  // ─── Reading ─────────────────────────────────────────────────────────────────

  /**
   * The invoices of a period (issue date, Paris days, `to` included), with their totals.
   * Only her own: invoices outlive their patient, so ownership is checked on the invoice.
   */
  async list(user: AccessUser, from: string, to: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { practitionerId: user.id, issuedAt: periodRange(from, to) },
      orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
      include: LINKS,
    });
    return { from, to, invoices, totals: summarize(invoices) };
  }

  /** The same invoices as a CSV file for the accountant. */
  async exportCsv(user: AccessUser, from: string, to: string) {
    const { invoices } = await this.list(user, from, to);
    return invoicesCsv(invoices);
  }

  /** One invoice, to print it. */
  async findOne(user: AccessUser, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: LINKS });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    this.access.assertOwner(user, invoice.practitionerId);
    return invoice;
  }

  /** The patient's invoices (latest first) and what they paid. */
  async forPatient(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const invoices = await this.prisma.invoice.findMany({
      where: { patientId },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      include: LINKS,
    });
    return { invoices, totals: summarize(invoices) };
  }

  /**
   * A session's invoice in force, what it no longer matches in the session, and the earlier
   * (cancelled) invoices and credit notes.
   */
  async forSession(user: AccessUser, consultationId: string) {
    const session = await this.sessionOf(user, consultationId);
    const invoices = await this.prisma.invoice.findMany({
      where: { consultationId },
      orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
      include: LINKS,
    });
    const current = invoices.find(countsInTotals) ?? null;
    const practice = current ? await this.placeOf(session) : null;
    return {
      current,
      mismatches: current ? invoiceMismatches(current, { ...session, practice }) : [],
      history: invoices.filter((invoice) => invoice !== current).reverse(),
    };
  }

  /** Sessions with no invoice in force, latest first (the dashboard's « Factures à faire »). */
  async sessionsToInvoice(user: AccessUser) {
    return this.prisma.consultation.findMany({
      where: {
        patient: { ...this.access.patientScope(user), deletedAt: null },
        invoices: { none: { type: InvoiceType.INVOICE, cancelledAt: null } },
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        formulaLabel: true,
        priceCents: true,
        paymentMethod: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  // ─── Writing ─────────────────────────────────────────────────────────────────

  /** « Faire la facture »: issues the session's invoice. */
  async issue(user: AccessUser, consultationId: string, now = new Date()) {
    const { practitionerId } = await this.sessionOf(user, consultationId);
    return this.locked(practitionerId, async (tx) => {
      const session = await this.loadSession(tx, consultationId);
      const current = await this.currentInvoice(tx, consultationId);
      if (current) throw new ConflictException(`Cette séance a déjà la facture n° ${current.number}`);
      return this.createInvoice(tx, session, now);
    });
  }

  /**
   * « Corriger la facture »: after the session (or the practice, or the patient) was corrected,
   * cancels the invoice with a credit note and issues a new one from the data as it is now.
   * The three are linked. Returns the new invoice.
   */
  async correct(user: AccessUser, invoiceId: string, now = new Date()) {
    const { practitionerId } = await this.invoiceOf(user, invoiceId);
    return this.locked(practitionerId, async (tx) => {
      const invoice = await this.invoiceInForce(tx, invoiceId);
      if (!invoice.consultationId) {
        throw new BadRequestException("La séance de cette facture a été supprimée : annulez-la plutôt");
      }
      const session = await this.loadSession(tx, invoice.consultationId);
      const creditNote = await this.createCreditNote(tx, invoice, now);
      const replacement = await this.createInvoice(tx, session, now);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { cancelledAt: now, creditNoteId: creditNote.id, replacedById: replacement.id },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id: replacement.id }, include: LINKS });
    });
  }

  /**
   * « Annuler la facture » (made by mistake, session offered…): issues the credit note. The
   * session is then without invoice again. Returns the credit note.
   */
  async cancel(user: AccessUser, invoiceId: string, reason?: string, now = new Date()) {
    const { practitionerId } = await this.invoiceOf(user, invoiceId);
    return this.locked(practitionerId, (tx) => this.cancelInTx(tx, invoiceId, reason?.trim() || null, now));
  }

  /**
   * Deletes a session; if it was invoiced, the invoice is cancelled by a credit note first, in
   * the same transaction. Invoice and credit note keep their copies; their link to the session
   * becomes null. Measurements recorded in the session go with it.
   */
  async deleteSession(practitionerId: string, consultationId: string, now = new Date()) {
    return this.locked(practitionerId, async (tx) => {
      const current = await this.currentInvoice(tx, consultationId);
      const creditNote = current
        ? await this.cancelInTx(tx, current.id, DELETED_SESSION_REASON, now)
        : null;
      await tx.measurement.deleteMany({ where: { consultationId } });
      await tx.consultation.delete({ where: { id: consultationId } });
      return { creditNote };
    });
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  /** Runs `fn` in a transaction holding the practitioner's invoice lock. */
  private locked<T>(practitionerId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoices:${practitionerId}`}))`;
      return fn(tx);
    });
  }

  private async cancelInTx(tx: Tx, invoiceId: string, reason: string | null, now: Date) {
    const invoice = await this.invoiceInForce(tx, invoiceId);
    const creditNote = await this.createCreditNote(tx, invoice, now);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { cancelledAt: now, cancelReason: reason, creditNoteId: creditNote.id },
    });
    return tx.invoice.findUniqueOrThrow({ where: { id: creditNote.id }, include: LINKS });
  }

  /**
   * Issues an invoice for the session, copying the activity (name, numbers, mentions), the
   * address of the session's practice (its own SIRET when it has one, else the activity's),
   * the patient and the service. A session with no practice takes her default one.
   */
  private async createInvoice(tx: Tx, session: SessionForInvoice, now: Date) {
    if (!session.formulaLabel || session.priceCents === null) {
      throw new BadRequestException('Choisissez la formule de la séance (avec son prix) avant de faire la facture');
    }
    const [activity, practitioner, place] = await Promise.all([
      tx.practitionerProfile.findUnique({ where: { userId: session.practitionerId } }),
      tx.user.findUniqueOrThrow({
        where: { id: session.practitionerId },
        select: { firstName: true, lastName: true },
      }),
      session.practice ?? defaultPractice(tx, session.practitionerId),
    ]);
    const numbering = await nextInvoiceNumber(tx, session.practitionerId, InvoiceType.INVOICE, now);
    const { patient } = session;
    return tx.invoice.create({
      data: {
        practitionerId: session.practitionerId,
        patientId: patient.id,
        consultationId: session.id,
        type: InvoiceType.INVOICE,
        ...numbering,
        issuedAt: now,
        amountCents: session.priceCents,
        paymentMethod: session.paymentMethod,
        serviceLabel: session.formulaLabel,
        serviceDate: session.date,
        practiceName: activity?.practiceName || `${practitioner.firstName} ${practitioner.lastName}`,
        practiceAddress: place?.address ?? null,
        practiceZipCode: place?.zipCode ?? null,
        practiceCity: place?.city ?? null,
        siret: place?.siret ?? activity?.siret ?? null,
        adeliRpps: activity?.adeliRpps ?? null,
        vatMention: activity?.vatMention ?? null,
        invoiceFooter: activity?.invoiceFooter ?? null,
        patientFirstName: patient.firstName,
        patientLastName: patient.lastName,
        patientAddress: patient.address,
        patientZipCode: patient.zipCode,
        patientCity: patient.city,
      },
    });
  }

  /** The credit note of an invoice: the same document, in negative, with its own number. */
  private async createCreditNote(tx: Tx, invoice: Invoice, now: Date) {
    const numbering = await nextInvoiceNumber(tx, invoice.practitionerId, InvoiceType.CREDIT_NOTE, now);
    const copy = Object.fromEntries(CREDIT_NOTE_COPY.map((key) => [key, invoice[key]])) as Pick<
      Invoice,
      (typeof CREDIT_NOTE_COPY)[number]
    >;
    return tx.invoice.create({
      data: {
        ...copy,
        ...numbering,
        type: InvoiceType.CREDIT_NOTE,
        issuedAt: now,
        amountCents: -invoice.amountCents,
      },
    });
  }

  /** The invoice, if it can still be cancelled (an invoice that is not cancelled yet). */
  private async invoiceInForce(tx: Tx, id: string) {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    if (invoice.type !== InvoiceType.INVOICE) throw new BadRequestException("Un avoir ne s'annule pas");
    if (invoice.cancelledAt) {
      throw new ConflictException(`La facture n° ${invoice.number} est déjà annulée`);
    }
    return invoice;
  }

  private currentInvoice(tx: Tx, consultationId: string) {
    return tx.invoice.findFirst({
      where: { consultationId, type: InvoiceType.INVOICE, cancelledAt: null },
    });
  }

  private async loadSession(tx: Tx, id: string) {
    const session = await tx.consultation.findUnique({ where: { id }, include: SESSION_FOR_INVOICE });
    if (!session) throw new NotFoundException('Séance introuvable');
    return session;
  }

  /** Where the session took place (her default practice when it says nothing). */
  private placeOf(session: { practiceId: string | null; practitionerId: string }) {
    const select = { address: true, zipCode: true, city: true } as const;
    return session.practiceId
      ? this.prisma.practice.findUnique({ where: { id: session.practiceId }, select })
      : defaultPractice(this.prisma, session.practitionerId);
  }

  /** A session of one of the user's patients. */
  private async sessionOf(user: AccessUser, id: string) {
    const session = await this.prisma.consultation.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Séance introuvable');
    await this.access.assertPatient(user, session.patientId);
    return session;
  }

  /** One of the user's invoices. */
  private async invoiceOf(user: AccessUser, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    this.access.assertOwner(user, invoice.practitionerId);
    return invoice;
  }
}

/** `from` and `to` are Paris days ("2026-11-01", "2026-11-30"), both included. */
export function periodRange(from: string, to: string): Prisma.DateTimeFilter {
  const start = parisStartOfDay(from);
  const end = parisStartOfDay(nextDay(to));
  if (start >= end) throw new BadRequestException('La période est vide');
  return { gte: start, lt: end };
}

/** Midnight in Paris (UTC+1 in winter, UTC+2 in summer) as an instant. */
export function parisStartOfDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, date);
  const summer = new Date(utcMidnight - 2 * 3600_000);
  return parisDay(summer) === day ? summer : new Date(utcMidnight - 3600_000);
}

function nextDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}
