import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingRhythm, InvoiceRecipient, InvoiceType, Prisma, ShareKind } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { CreateCoverageDto, CreatePayerDto, UpdateCoverageDto, UpdatePayerDto } from './dto/payer.dto';
import { withInvoiceLock } from './invoice-writing';
import { parisDay, parisStartOfDay } from './numbering';
import { splitColumns } from './session-split';
import { isoDay } from './split';

const PAYER_OF_COVERAGE = { select: { id: true, name: true, archivedAt: true } } as const;

/**
 * Payers (« Organismes », docs/REFONTE.md lot 16) and what they cover for each patient. A payer
 * is archived, never deleted: its invoices and its sessions keep pointing to it.
 */
@Injectable()
export class PayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  // ─── Payers ──────────────────────────────────────────────────────────────────

  create(user: AccessUser, dto: CreatePayerDto) {
    return this.prisma.payer.create({ data: { ...dto, ...rhythm(dto), practitionerId: user.id } });
  }

  /** Edits a payer, archives it (`archived: true`) or offers it again (`archived: false`). */
  async update(user: AccessUser, id: string, dto: UpdatePayerDto) {
    const payer = await this.payerOf(user, id);
    const { archived, ...fields } = dto;
    const data: Prisma.PayerUpdateInput = { ...fields };
    if (fields.billingRhythm !== undefined || fields.rhythmMonths !== undefined) {
      Object.assign(data, rhythm({ billingRhythm: fields.billingRhythm ?? payer.billingRhythm, rhythmMonths: fields.rhythmMonths ?? payer.rhythmMonths }));
    }
    if (archived === true && !payer.archivedAt) data.archivedAt = new Date();
    if (archived === false) data.archivedAt = null;
    return this.prisma.payer.update({ where: { id }, data });
  }

  // ─── Coverages ───────────────────────────────────────────────────────────────

  /** The patient's coverages, latest first, with how many sessions each one already paid. */
  async coverages(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const coverages = await this.prisma.patientCoverage.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { payer: PAYER_OF_COVERAGE },
    });
    return Promise.all(
      coverages.map(async (coverage) => ({
        ...coverage,
        coveredSessions: await this.prisma.consultation.count({
          where: { coverageId: coverage.id, payerCents: { gt: 0 } },
        }),
      })),
    );
  }

  async createCoverage(user: AccessUser, patientId: string, dto: CreateCoverageDto) {
    const { practitionerId } = await this.access.assertPatient(user, patientId);
    return withInvoiceLock(this.prisma, practitionerId, async (tx) => {
      await this.activePayer(tx, practitionerId, dto.payerId);
      checkCoverage(dto);
      const coverage = await tx.patientCoverage.create({
        data: { ...dto, ...days(dto), patientId },
        include: { payer: PAYER_OF_COVERAGE },
      });
      await this.refreshOpenSessions(tx, patientId);
      return coverage;
    });
  }

  async updateCoverage(user: AccessUser, patientId: string, id: string, dto: UpdateCoverageDto) {
    const { practitionerId } = await this.access.assertPatient(user, patientId);
    return withInvoiceLock(this.prisma, practitionerId, async (tx) => {
      const coverage = await this.coverageOf(tx, patientId, id);
      if (dto.payerId && dto.payerId !== coverage.payerId) await this.activePayer(tx, practitionerId, dto.payerId);
      checkCoverage({
        kind: dto.kind ?? coverage.kind,
        value: dto.value ?? coverage.value,
        startDate: dto.startDate !== undefined ? dto.startDate : coverage.startDate && isoDay(coverage.startDate),
        endDate: dto.endDate !== undefined ? dto.endDate : coverage.endDate && isoDay(coverage.endDate),
      });
      const updated = await tx.patientCoverage.update({
        where: { id },
        data: { ...dto, ...days(dto) },
        include: { payer: PAYER_OF_COVERAGE },
      });
      await this.refreshOpenSessions(tx, patientId, updated.payerId !== coverage.payerId ? id : undefined);
      return updated;
    });
  }

  /** Past sessions keep the split they had; the patient's open sessions lose it. */
  async removeCoverage(user: AccessUser, patientId: string, id: string) {
    const { practitionerId } = await this.access.assertPatient(user, patientId);
    return withInvoiceLock(this.prisma, practitionerId, async (tx) => {
      await this.coverageOf(tx, patientId, id);
      await tx.patientCoverage.delete({ where: { id } });
      await this.refreshOpenSessions(tx, patientId);
      return { id };
    });
  }

  /**
   * A coverage changed: the patient's sessions from today on that are not billed yet (no
   * patient invoice in force, in no payer invoice) take it. Earlier sessions keep their split
   * (docs/REFONTE.md lot 16: a later change of coverage leaves past sessions alone).
   */
  private async refreshOpenSessions(tx: Prisma.TransactionClient, patientId: string, changedPayerCoverageId?: string) {
    const sessions = await tx.consultation.findMany({
      where: {
        patientId,
        priceCents: { not: null },
        date: { gte: parisStartOfDay(parisDay(new Date())) },
        invoices: { none: { type: InvoiceType.INVOICE, recipient: InvoiceRecipient.PATIENT, cancelledAt: null } },
        invoiceLines: { none: { invoice: { type: InvoiceType.INVOICE, cancelledAt: null } } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, patientId: true, date: true, priceCents: true, discountKind: true, discountValue: true,
        coverageId: true, payerId: true, payerOverrideCents: true },
    });
    // One after the other: each one counts the sessions covered before it
    for (const session of sessions) {
      await tx.consultation.update({
        where: { id: session.id },
        data: await splitColumns(tx, {
          ...session,
          payerOverrideCents: session.coverageId === changedPayerCoverageId ? null : session.payerOverrideCents,
        }),
      });
    }
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  private async payerOf(user: AccessUser, id: string) {
    const payer = await this.prisma.payer.findUnique({ where: { id } });
    if (!payer) throw new NotFoundException('Organisme introuvable');
    this.access.assertOwner(user, payer.practitionerId);
    return payer;
  }

  /** One of the patient's practitioner's payers, still offered. */
  private async activePayer(tx: Prisma.TransactionClient, practitionerId: string, payerId: string) {
    const payer = await tx.payer.findUnique({ where: { id: payerId } });
    if (!payer || payer.practitionerId !== practitionerId) throw new BadRequestException('Organisme introuvable');
    if (payer.archivedAt) throw new BadRequestException("Cet organisme est archivé");
    return payer;
  }

  private async coverageOf(tx: Prisma.TransactionClient, patientId: string, id: string) {
    const coverage = await tx.patientCoverage.findUnique({ where: { id } });
    if (!coverage || coverage.patientId !== patientId) throw new NotFoundException('Prise en charge introuvable');
    return coverage;
  }
}

/** Every N months needs its N; the other rhythms have none. */
function rhythm(dto: { billingRhythm?: BillingRhythm; rhythmMonths?: number | null }) {
  if (dto.billingRhythm === BillingRhythm.EVERY_N_MONTHS) {
    if (!dto.rhythmMonths) throw new BadRequestException('Indiquez tous les combien de mois facturer cet organisme.');
    return { billingRhythm: dto.billingRhythm, rhythmMonths: dto.rhythmMonths };
  }
  return dto.billingRhythm === undefined ? { rhythmMonths: null } : { billingRhythm: dto.billingRhythm, rhythmMonths: null };
}

function checkCoverage(c: { kind?: ShareKind; value?: number; startDate?: string | null; endDate?: string | null }) {
  if (c.kind === ShareKind.PERCENT && c.value !== undefined && c.value > 100) {
    throw new BadRequestException('Un pourcentage va de 1 à 100 %.');
  }
  if (c.startDate && c.endDate && c.startDate > c.endDate) {
    throw new BadRequestException('La fin de la prise en charge est avant son début.');
  }
}

/** Days as stored in @db.Date columns. */
function days(dto: { startDate?: string | null; endDate?: string | null }) {
  const toDate = (day: string | null | undefined) => (day ? new Date(`${day}T00:00:00Z`) : day);
  return {
    ...(dto.startDate !== undefined && { startDate: toDate(dto.startDate) }),
    ...(dto.endDate !== undefined && { endDate: toDate(dto.endDate) }),
  };
}
