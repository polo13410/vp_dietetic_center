import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceRecipient, InvoiceType, PaymentMethod, Prisma } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultPractice } from '../me/default-practice';

import { countsInTotals } from './invoice-rules';
import { createCreditNote, issuerCopy, LINKS, type Tx, WITH_LINES, withInvoiceLock } from './invoice-writing';
import { nextInvoiceNumber, parisDay, parisStartOfDay } from './numbering';
import { addDays, nextPeriod } from './payer-periods';
import { isoDay } from './split';

/** A payer invoice in force older than this, still « en attente », is shown on the dashboard. */
export const PAYER_INVOICE_OVERDUE_DAYS = 60;
const DAY = 24 * 3600 * 1000;

/** What a payer invoice shows of a session: nothing medical. */
const SESSION_FOR_PAYER = {
  id: true,
  date: true,
  formulaLabel: true,
  payerCents: true,
  patient: { select: { id: true, firstName: true, lastName: true } },
  coverage: { select: { coverageNumber: true } },
} satisfies Prisma.ConsultationSelect;

type Db = PrismaService | Tx;

/** What no longer matches between a payer invoice and its sessions. */
export interface PayerInvoiceMismatches {
  /** Sessions deleted since */
  deleted: number;
  /** Sessions whose payer part (or payer) changed */
  changed: number;
  /** Sessions of the period not billed yet (added or covered since) */
  added: number;
}

/**
 * Payer invoices (docs/REFONTE.md lot 16): one invoice groups the sessions of a period paid in
 * part by a payer. Same series, same rules as patient invoices: issued once, never changed,
 * corrected by a credit note and a new invoice. A session is in one payer invoice in force at
 * most; cancelling the invoice releases its sessions. Its payment is followed apart: « en
 * attente » until « réglée le … ». Only the practitioner's own patients are billed.
 */
@Injectable()
export class PayerInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  // ─── Reading ─────────────────────────────────────────────────────────────────

  /**
   * The sessions of a period that the payer pays in part and that no payer invoice in force
   * includes yet, earliest first: what « Préparer la facture » shows.
   */
  async preview(user: AccessUser, payerId: string, from: string, to: string) {
    const payer = await this.payerOf(user, payerId);
    const sessions = await this.billable(this.prisma, user, payer.id, from, to);
    return { from, to, sessions, totalCents: total(sessions) };
  }

  /** Her payer invoices and their credit notes, latest first, with what no longer matches. */
  async list(user: AccessUser) {
    const invoices = await this.prisma.invoice.findMany({
      where: { practitionerId: user.id, recipient: InvoiceRecipient.PAYER },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      include: { ...LINKS, _count: { select: { lines: true } } },
    });
    return Promise.all(
      invoices.map(async (invoice) => ({
        ...invoice,
        mismatches: countsInTotals(invoice) ? await this.mismatches(user, invoice) : null,
      })),
    );
  }

  /** The payer invoice in force that includes the session, if any. */
  async invoiceOfSession(consultationId: string) {
    const line = await this.prisma.invoiceLine.findFirst({
      where: { consultationId, invoice: { type: InvoiceType.INVOICE, cancelledAt: null } },
      select: { invoice: { select: { id: true, number: true, payerName: true, issuedAt: true } } },
    });
    return line?.invoice ?? null;
  }

  /**
   * Her payers with the next period to bill (from their rhythm), what it holds, and their
   * invoices still « en attente ». `today` is a Paris day.
   */
  async overview(user: AccessUser, today = parisDay(new Date())) {
    const payers = await this.prisma.payer.findMany({
      where: { practitionerId: user.id },
      orderBy: [{ archivedAt: { sort: 'desc', nulls: 'first' } }, { name: 'asc' }],
      include: { _count: { select: { coverages: true } } },
    });
    return Promise.all(payers.map((payer) => this.withNextPeriod(user, payer, today)));
  }

  /**
   * The dashboard's reminders: payer periods ended and not billed, and payer invoices « en
   * attente » for more than 60 days.
   */
  async reminders(user: AccessUser, now = new Date()) {
    const today = parisDay(now);
    const payers = await this.prisma.payer.findMany({
      where: { practitionerId: user.id, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    const periods = await Promise.all(payers.map((payer) => this.withNextPeriod(user, payer, today)));
    const overdue = await this.prisma.invoice.findMany({
      where: {
        practitionerId: user.id,
        recipient: InvoiceRecipient.PAYER,
        type: InvoiceType.INVOICE,
        cancelledAt: null,
        paidAt: null,
        issuedAt: { lt: new Date(now.getTime() - PAYER_INVOICE_OVERDUE_DAYS * DAY) },
      },
      orderBy: { issuedAt: 'asc' },
      select: { id: true, number: true, payerId: true, payerName: true, issuedAt: true, amountCents: true },
    });
    return {
      periodsToBill: periods
        .filter((p) => p.nextPeriod.ended && p.nextPeriod.sessionCount > 0)
        .map(({ id, name, nextPeriod }) => ({ payer: { id, name }, ...nextPeriod })),
      overdueInvoices: overdue.map((invoice) => ({
        ...invoice,
        days: Math.floor((now.getTime() - invoice.issuedAt.getTime()) / DAY),
      })),
    };
  }

  // ─── Writing ─────────────────────────────────────────────────────────────────

  /** « Émettre la facture »: the payer invoice of its sessions over the period. */
  async issue(user: AccessUser, payerId: string, from: string, to: string, now = new Date()) {
    const payer = await this.payerOf(user, payerId);
    return withInvoiceLock(this.prisma, payer.practitionerId, async (tx) => {
      const invoice = await this.createInvoice(tx, user, payer.id, from, to, now);
      return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: WITH_LINES });
    });
  }

  /**
   * « Corriger la facture »: a credit note cancels it, which releases its sessions, and a new
   * invoice is issued over the same period from the sessions as they are now. Returns it.
   */
  async correct(user: AccessUser, invoiceId: string, now = new Date()) {
    const { practitionerId } = await this.invoiceOf(user, invoiceId);
    return withInvoiceLock(this.prisma, practitionerId, async (tx) => {
      const invoice = await this.inForce(tx, invoiceId);
      if (!invoice.payerId || !invoice.periodStart || !invoice.periodEnd) {
        throw new BadRequestException("L'organisme de cette facture a été supprimé : annulez-la plutôt");
      }
      const creditNote = await createCreditNote(tx, invoice, now);
      await tx.invoice.update({ where: { id: invoice.id }, data: { cancelledAt: now, creditNoteId: creditNote.id } });
      // Its sessions are free again: the new invoice takes them as they are now
      const replacement = await this.createInvoice(
        tx,
        user,
        invoice.payerId,
        isoDay(invoice.periodStart),
        isoDay(invoice.periodEnd),
        now,
      );
      await tx.invoice.update({ where: { id: invoice.id }, data: { replacedById: replacement.id } });
      return tx.invoice.findUniqueOrThrow({ where: { id: replacement.id }, include: WITH_LINES });
    });
  }

  /** « Réglée le … » (or back to « en attente » with null). */
  async setPaid(user: AccessUser, invoiceId: string, paidOn: string | null) {
    const invoice = await this.invoiceOf(user, invoiceId);
    if (invoice.type !== InvoiceType.INVOICE) throw new BadRequestException("Un avoir ne se règle pas");
    if (invoice.cancelledAt) throw new ConflictException(`La facture n° ${invoice.number} est annulée`);
    if (paidOn && paidOn < parisDay(invoice.issuedAt)) {
      throw new BadRequestException('La date de règlement est avant la facture');
    }
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { paidAt: paidOn ? new Date(`${paidOn}T00:00:00Z`) : null },
      include: LINKS,
    });
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  /**
   * Issues the payer invoice of the period from its billable sessions, copying the activity
   * (with her default practice's address), the payer and each session (date, patient, service,
   * payer part). Takes the next number of her one series.
   */
  private async createInvoice(tx: Tx, user: AccessUser, payerId: string, from: string, to: string, now: Date) {
    const payer = await tx.payer.findUniqueOrThrow({ where: { id: payerId } });
    const sessions = await this.billable(tx, user, payerId, from, to);
    if (sessions.length === 0) throw new BadRequestException('Aucune séance à facturer à cet organisme sur cette période');
    const issuer = await issuerCopy(tx, payer.practitionerId, await defaultPractice(tx, payer.practitionerId));
    const numbering = await nextInvoiceNumber(tx, payer.practitionerId, InvoiceType.INVOICE, now);
    const periodEnd = new Date(`${to}T00:00:00Z`);
    return tx.invoice.create({
      data: {
        practitionerId: payer.practitionerId,
        type: InvoiceType.INVOICE,
        recipient: InvoiceRecipient.PAYER,
        payerId: payer.id,
        ...numbering,
        issuedAt: now,
        amountCents: total(sessions),
        paymentMethod: PaymentMethod.NONE,
        serviceLabel: 'Prise en charge de séances de diététique',
        serviceDate: periodEnd,
        payerName: payer.name,
        payerAddress: payer.address,
        payerZipCode: payer.zipCode,
        payerCity: payer.city,
        payerContact: payer.contact,
        conventionReference: payer.conventionReference,
        periodStart: new Date(`${from}T00:00:00Z`),
        periodEnd,
        ...issuer,
        lines: {
          create: sessions.map((s, position) => ({
            consultationId: s.id,
            position,
            serviceDate: s.date,
            serviceLabel: s.formulaLabel ?? 'Séance',
            patientFirstName: s.patient.firstName,
            patientLastName: s.patient.lastName,
            coverageNumber: s.coverage?.coverageNumber ?? null,
            amountCents: s.payerCents ?? 0,
          })),
        },
      },
    });
  }

  /**
   * The payer's sessions of the period (Paris days, both included) with a payer part, of her
   * own patients, not in a payer invoice in force: the cancelled ones release their sessions.
   */
  private billable(db: Db, user: AccessUser, payerId: string, from: string, to: string) {
    if (from > to) throw new BadRequestException('La période est vide');
    return db.consultation.findMany({
      where: {
        payerId,
        payerCents: { gt: 0 },
        date: { gte: parisStartOfDay(from), lt: parisStartOfDay(addDays(to, 1)) },
        patient: { ...this.access.patientScope(user), deletedAt: null },
        invoiceLines: { none: { invoice: { type: InvoiceType.INVOICE, cancelledAt: null } } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: SESSION_FOR_PAYER,
    });
  }

  /** What no longer matches between a payer invoice in force and its sessions now. */
  private async mismatches(user: AccessUser, invoice: Invoice): Promise<PayerInvoiceMismatches | null> {
    const lines = await this.prisma.invoiceLine.findMany({
      where: { invoiceId: invoice.id },
      select: { amountCents: true, consultation: { select: { payerId: true, payerCents: true } } },
    });
    const added =
      invoice.payerId && invoice.periodStart && invoice.periodEnd
        ? (await this.billable(this.prisma, user, invoice.payerId, isoDay(invoice.periodStart), isoDay(invoice.periodEnd)))
            .length
        : 0;
    const result = {
      deleted: lines.filter((l) => !l.consultation).length,
      changed: lines.filter(
        (l) => l.consultation && (l.consultation.payerId !== invoice.payerId || l.consultation.payerCents !== l.amountCents),
      ).length,
      added,
    };
    return result.deleted + result.changed + result.added > 0 ? result : null;
  }

  private async withNextPeriod(
    user: AccessUser,
    payer: Prisma.PayerGetPayload<object> & { _count?: { coverages: number } },
    today: string,
  ) {
    const [last, earliest, pending] = await Promise.all([
      this.prisma.invoice.findFirst({
        where: { payerId: payer.id, type: InvoiceType.INVOICE, cancelledAt: null },
        orderBy: { periodEnd: 'desc' },
        select: { periodEnd: true },
      }),
      this.prisma.consultation.findFirst({
        where: {
          payerId: payer.id,
          payerCents: { gt: 0 },
          patient: { ...this.access.patientScope(user), deletedAt: null },
          invoiceLines: { none: { invoice: { type: InvoiceType.INVOICE, cancelledAt: null } } },
        },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
      this.prisma.invoice.aggregate({
        where: { payerId: payer.id, type: InvoiceType.INVOICE, cancelledAt: null, paidAt: null },
        _count: true,
        _sum: { amountCents: true },
      }),
    ]);
    const period = nextPeriod(payer, {
      lastEnd: last?.periodEnd ? isoDay(last.periodEnd) : null,
      earliestUnbilled: earliest ? parisDay(earliest.date) : null,
      today,
    });
    const sessions = await this.billable(this.prisma, user, payer.id, period.from, period.to);
    return {
      ...payer,
      nextPeriod: { ...period, sessionCount: sessions.length, totalCents: total(sessions) },
      pending: { count: pending._count, totalCents: pending._sum.amountCents ?? 0 },
    };
  }

  private async inForce(tx: Tx, id: string) {
    const invoice = await tx.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Facture introuvable');
    if (invoice.type !== InvoiceType.INVOICE) throw new BadRequestException("Un avoir ne s'annule pas");
    if (invoice.cancelledAt) throw new ConflictException(`La facture n° ${invoice.number} est déjà annulée`);
    return invoice;
  }

  /** One of her payers. */
  private async payerOf(user: AccessUser, id: string) {
    const payer = await this.prisma.payer.findUnique({ where: { id } });
    if (!payer) throw new NotFoundException('Organisme introuvable');
    this.access.assertOwner(user, payer.practitionerId);
    return payer;
  }

  /** One of her payer invoices. */
  private async invoiceOf(user: AccessUser, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.recipient !== InvoiceRecipient.PAYER) throw new NotFoundException('Facture introuvable');
    this.access.assertOwner(user, invoice.practitionerId);
    return invoice;
  }
}

const total = (sessions: { payerCents: number | null }[]) => sessions.reduce((sum, s) => sum + (s.payerCents ?? 0), 0);
