import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceRecipient, InvoiceType, Prisma } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultPractice } from '../me/default-practice';

import { countsInTotals, invoiceMismatches, invoicesCsv, summarize } from './invoice-rules';
import {
  cancelWithCreditNote,
  createCreditNote,
  issuerCopy,
  LINKS,
  type Tx,
  WITH_LINES,
  withInvoiceLock,
} from './invoice-writing';
import { nextInvoiceNumber, parisStartOfDay } from './numbering';
import { PayerInvoicesService } from './payer-invoices.service';
import { splitOf } from './session-split';

/** What an invoice copies from its session: the patient, where it took place, its payer. */
const SESSION_FOR_INVOICE = {
  patient: {
    select: { id: true, firstName: true, lastName: true, address: true, zipCode: true, city: true },
  },
  practice: { select: { address: true, zipCode: true, city: true, siret: true } },
  payer: { select: { name: true } },
} satisfies Prisma.ConsultationInclude;

type SessionForInvoice = Prisma.ConsultationGetPayload<{ include: typeof SESSION_FOR_INVOICE }>;

/** Reason recorded on the invoice of a deleted session. */
export const DELETED_SESSION_REASON = 'Séance supprimée';

/**
 * Invoices and credit notes (docs/REFONTE.md lots 5 and 16). A patient invoice is issued only
 * when the practitioner asks for it (« Faire la facture »); once issued it never changes.
 * Mistakes are corrected by a credit note (« avoir ») that cancels it, followed, for a
 * correction, by a new invoice that replaces it. Payer invoices (PayerInvoicesService) share the
 * same series and rules. All writes of a practitioner's invoices are serialised by a lock held
 * until the end of their transaction, so numbers have no gaps and a session cannot be invoiced
 * twice.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
    private readonly payerInvoices: PayerInvoicesService,
  ) {}

  // ─── Reading ─────────────────────────────────────────────────────────────────

  /**
   * The invoices of a period (issue date, Paris days, `to` included), patients' and payers',
   * with their totals. Only her own: invoices outlive their patient, so ownership is checked on
   * the invoice.
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

  /** One invoice, to print it (with its sessions for a payer invoice). */
  async findOne(user: AccessUser, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: WITH_LINES });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    this.access.assertOwner(user, invoice.practitionerId);
    return invoice;
  }

  /** The patient's invoices (latest first) and what they paid. */
  async forPatient(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const invoices = await this.prisma.invoice.findMany({
      where: { patientId, recipient: InvoiceRecipient.PATIENT },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      include: LINKS,
    });
    return { invoices, totals: summarize(invoices) };
  }

  /**
   * A session's invoice in force, what it no longer matches in the session, the earlier
   * (cancelled) invoices and credit notes, and the payer invoice that includes it.
   */
  async forSession(user: AccessUser, consultationId: string) {
    const session = await this.sessionOf(user, consultationId);
    const [invoices, payerInvoice] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { consultationId, recipient: InvoiceRecipient.PATIENT },
        orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
        include: LINKS,
      }),
      this.payerInvoices.invoiceOfSession(consultationId),
    ]);
    const current = invoices.find(countsInTotals) ?? null;
    const [practice, payerName] = current
      ? await Promise.all([this.placeOf(session), this.payerNameOf(session.payerId)])
      : [null, null];
    return {
      current,
      mismatches: current ? invoiceMismatches(current, { ...session, practice, payerName }) : [],
      history: invoices.filter((invoice) => invoice !== current).reverse(),
      payerInvoice,
    };
  }

  /**
   * Sessions with no invoice in force, latest first (the dashboard's « Factures à faire »). A
   * free session (100 % discount) or one paid in full by a payer needs no patient invoice.
   */
  async sessionsToInvoice(user: AccessUser) {
    return this.prisma.consultation.findMany({
      where: {
        patient: { ...this.access.patientScope(user), deletedAt: null },
        invoices: { none: { type: InvoiceType.INVOICE, recipient: InvoiceRecipient.PATIENT, cancelledAt: null } },
        OR: [{ patientCents: null }, { patientCents: { gt: 0 } }],
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        formulaLabel: true,
        priceCents: true,
        patientCents: true,
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
   * The three are linked. Returns the new invoice. A payer invoice is redone over its period.
   */
  async correct(user: AccessUser, invoiceId: string, now = new Date()) {
    const { practitionerId, recipient } = await this.invoiceOf(user, invoiceId);
    if (recipient === InvoiceRecipient.PAYER) return this.payerInvoices.correct(user, invoiceId, now);
    return this.locked(practitionerId, async (tx) => {
      const invoice = await this.invoiceInForce(tx, invoiceId);
      if (!invoice.consultationId) {
        throw new BadRequestException("La séance de cette facture a été supprimée : annulez-la plutôt");
      }
      const session = await this.loadSession(tx, invoice.consultationId);
      const creditNote = await createCreditNote(tx, invoice, now);
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
   * session is then without invoice again; the sessions of a payer invoice can be billed again.
   * Returns the credit note.
   */
  async cancel(user: AccessUser, invoiceId: string, reason?: string, now = new Date()) {
    const { practitionerId } = await this.invoiceOf(user, invoiceId);
    return this.locked(practitionerId, (tx) => this.cancelInTx(tx, invoiceId, reason?.trim() || null, now));
  }

  /**
   * Deletes a session; if it was invoiced, the invoice is cancelled by a credit note first, in
   * the same transaction. Invoice and credit note keep their copies; their link to the session
   * becomes null. Measurements recorded in the session go with it. A payer invoice that includes
   * it keeps its line (a copy) and then says it no longer matches its sessions.
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
    return withInvoiceLock(this.prisma, practitionerId, fn);
  }

  private async cancelInTx(tx: Tx, invoiceId: string, reason: string | null, now: Date) {
    return cancelWithCreditNote(tx, await this.invoiceInForce(tx, invoiceId), reason, now);
  }

  /**
   * Issues an invoice for the session, copying the activity (name, numbers, mentions), the
   * address of the session's practice (its own SIRET when it has one, else the activity's),
   * the patient and the service. A session with no practice takes her default one. The patient
   * is billed their part only; the price, the discount and the payer part are copied too
   * (« dont 30,00 € pris en charge par … »). A free session, or one paid in full by a payer,
   * has no patient invoice.
   */
  private async createInvoice(tx: Tx, session: SessionForInvoice, now: Date) {
    const split = splitOf(session);
    if (!session.formulaLabel || !split) {
      throw new BadRequestException('Choisissez la formule de la séance (avec son prix) avant de faire la facture');
    }
    if (split.netCents === 0) throw new BadRequestException('Séance offerte : pas de facture à faire');
    if (split.patientCents === 0) {
      const by = session.payer ? ` par ${session.payer.name}` : '';
      throw new BadRequestException(`Séance prise en charge en totalité${by} : pas de facture au patient`);
    }
    const place = session.practice ?? (await defaultPractice(tx, session.practitionerId));
    const issuer = await issuerCopy(tx, session.practitionerId, place);
    const numbering = await nextInvoiceNumber(tx, session.practitionerId, InvoiceType.INVOICE, now);
    const { patient } = session;
    const covered = split.payerCents > 0;
    return tx.invoice.create({
      data: {
        practitionerId: session.practitionerId,
        patientId: patient.id,
        consultationId: session.id,
        type: InvoiceType.INVOICE,
        recipient: InvoiceRecipient.PATIENT,
        ...numbering,
        issuedAt: now,
        amountCents: split.patientCents,
        paymentMethod: session.paymentMethod,
        serviceLabel: session.formulaLabel,
        serviceDate: session.date,
        priceCents: split.priceCents,
        discountCents: split.discountCents,
        discountReason: split.discountCents > 0 ? session.discountReason?.trim() || null : null,
        payerCents: split.payerCents,
        payerName: covered ? (session.payer?.name ?? null) : null,
        ...issuer,
        patientFirstName: patient.firstName,
        patientLastName: patient.lastName,
        patientAddress: patient.address,
        patientZipCode: patient.zipCode,
        patientCity: patient.city,
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

  /** The session's patient invoice in force. */
  private currentInvoice(tx: Tx, consultationId: string) {
    return tx.invoice.findFirst({
      where: { consultationId, type: InvoiceType.INVOICE, recipient: InvoiceRecipient.PATIENT, cancelledAt: null },
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

  private async payerNameOf(payerId: string | null | undefined) {
    if (!payerId) return null;
    const payer = await this.prisma.payer.findUnique({ where: { id: payerId }, select: { name: true } });
    return payer?.name ?? null;
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

export { parisStartOfDay };

export function nextDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}
