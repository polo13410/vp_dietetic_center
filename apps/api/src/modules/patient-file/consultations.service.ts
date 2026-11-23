import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, MetricType, PaymentMethod, Prisma, ShareKind } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { splitColumns } from '../invoices/session-split';
import { defaultPractice } from '../me/default-practice';

import { SessionInSeries, sessionSeries } from './calculations';
import { CreateConsultationDto, UpdateConsultationDto } from './dto/consultation.dto';

/** Everything recorded during a session, shown on the session screen. */
const SESSION_CONTENT = {
  appointment: {
    select: {
      id: true,
      startAt: true,
      duration: true,
      type: true,
      reason: true,
      formula: { select: { id: true, label: true } },
    },
  },
  practice: { select: { id: true, name: true } },
  payer: { select: { id: true, name: true } },
  coverage: { select: { id: true, maxSessions: true, startDate: true, endDate: true, payer: { select: { name: true } } } },
  patient: { select: { id: true, firstName: true, lastName: true } },
  measurements: { orderBy: { type: 'asc' as const } },
  fileEntries: { orderBy: { createdAt: 'asc' as const } },
  lifeEvents: { orderBy: { date: 'asc' as const } },
} satisfies Prisma.ConsultationInclude;

/** The session's weight: the latest WEIGHT measurement recorded in it. */
const SESSION_WEIGHT = {
  where: { type: MetricType.WEIGHT },
  orderBy: { createdAt: 'desc' as const },
  take: 1,
  select: { value: true },
} satisfies Prisma.Consultation$measurementsArgs;

/**
 * A session ("séance") with a patient: one row of her follow-up sheet. It is never locked:
 * a past session is corrected like today's. Starting one from an appointment marks the
 * appointment as done. Responses carry the computed figures (weight, BMI, BMR), the change
 * in weight and the advice of the previous session.
 */
@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
    private readonly invoices: InvoicesService,
  ) {}

  /** The follow-up sheet, latest session first. */
  async list(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const sessions = await this.prisma.consultation.findMany({
      where: { patientId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        appointment: { select: { id: true, startAt: true, type: true } },
        practice: { select: { id: true, name: true } },
        payer: { select: { id: true, name: true } },
        measurements: SESSION_WEIGHT,
        _count: { select: { measurements: true, fileEntries: true, lifeEvents: true } },
      },
    });
    const series = await this.series(patientId, sessions);
    return sessions
      .map(({ measurements: _weight, ...session }) => ({ ...session, ...series.get(session.id)! }))
      .reverse();
  }

  async findOne(user: AccessUser, id: string) {
    const session = await this.prisma.consultation.findUnique({
      where: { id },
      include: SESSION_CONTENT,
    });
    if (!session) throw new NotFoundException('Séance introuvable');
    await this.access.assertPatient(user, session.patientId);
    return this.withFigures(session);
  }

  /**
   * Starts a session. Starting it again from the same appointment returns the existing one.
   * From an appointment, it takes the appointment's type (formula, with its price now) and
   * practice. Otherwise, unless given, the formula is « Bilan » for the first session and
   * « Suivi » after (her formulas with those names), and the practice her default one. The
   * payment method is the patient's last one, the discount the one of their previous session
   * (lot 16: not typed again). The split of the price follows from the patient's coverage.
   */
  async create(user: AccessUser, patientId: string, dto: CreateConsultationDto) {
    const { practitionerId } = await this.access.assertPatient(user, patientId);

    let date = dto.date ? new Date(dto.date) : new Date();
    let booked: { formulaId: string | null; practiceId: string | null } | null = null;
    if (dto.appointmentId) {
      await this.access.assertAppointment(user, dto.appointmentId, patientId);
      const existing = await this.prisma.consultation.findUnique({
        where: { appointmentId: dto.appointmentId },
      });
      if (existing) return existing;
      const appointment = await this.prisma.appointment.findUniqueOrThrow({
        where: { id: dto.appointmentId },
        select: { startAt: true, status: true, formulaId: true, practiceId: true },
      });
      if (appointment.status === AppointmentStatus.CANCELLED) {
        throw new BadRequestException('Ce rendez-vous est annulé');
      }
      if (!dto.date) date = appointment.startAt;
      booked = appointment;
    }

    // The appointment's type was chosen at booking: kept even if no longer offered since
    const inherited = !dto.formulaId && !!booked?.formulaId;
    const formulaId =
      dto.formulaId ?? booked?.formulaId ?? (await this.defaultFormulaId(practitionerId, patientId));
    const practiceId = dto.practiceId
      ? await this.ownPractice(practitionerId, dto.practiceId)
      : (booked?.practiceId ?? (await defaultPractice(this.prisma, practitionerId))?.id ?? null);
    const formula = formulaId ? await this.formulaCopy(practitionerId, formulaId, inherited) : null;
    const discount = await this.previousDiscount(patientId);
    const data = {
      patientId,
      practitionerId,
      appointmentId: dto.appointmentId,
      date,
      practiceId,
      paymentMethod: dto.paymentMethod ?? (await this.lastPaymentMethod(patientId)),
      ...formula,
      ...discount,
      ...(await splitColumns(this.prisma, {
        patientId,
        date,
        priceCents: formula?.priceCents ?? null,
        discountKind: discount.discountKind,
        discountValue: discount.discountValue,
      })),
    };
    if (!dto.appointmentId) return this.prisma.consultation.create({ data });
    const [session] = await this.prisma.$transaction([
      this.prisma.consultation.create({ data }),
      this.prisma.appointment.update({
        where: { id: dto.appointmentId },
        data: { status: AppointmentStatus.COMPLETED },
      }),
    ]);
    return session;
  }

  /**
   * Changing the formula (so the price), the date or the discount computes the split again,
   * from the patient's coverage on the session's date.
   */
  async update(user: AccessUser, id: string, dto: UpdateConsultationDto) {
    const session = await this.ofUser(user, id);
    const { formulaId, date, practiceId, discountKind, discountValue, discountReason, ...texts } = dto;
    let formula: { formulaId: string | null; formulaLabel: string | null; priceCents: number | null } | null = null;
    if (formulaId === null) formula = { formulaId: null, formulaLabel: null, priceCents: null };
    // Choosing the same formula again keeps the price copied at the time
    else if (formulaId && formulaId !== session.formulaId) {
      formula = await this.formulaCopy(session.practitionerId, formulaId);
    }
    const place =
      practiceId && practiceId !== session.practiceId
        ? { practiceId: await this.ownPractice(session.practitionerId, practiceId) }
        : {};
    const discount = discountChange(session, { discountKind, discountValue, discountReason });
    const newDate = date ? new Date(date) : undefined;
    const moved = !!newDate && newDate.getTime() !== new Date(session.date).getTime();
    const split =
      formula || discount || moved
        ? await splitColumns(this.prisma, {
            id,
            patientId: session.patientId,
            date: newDate ?? session.date,
            priceCents: formula ? formula.priceCents : session.priceCents,
            discountKind: discount ? discount.discountKind : session.discountKind,
            discountValue: discount ? discount.discountValue : session.discountValue,
          })
        : {};
    return this.prisma.consultation.update({
      where: { id },
      data: { ...texts, ...formula, ...place, ...discount, ...split, date: newDate },
    });
  }

  /**
   * Deletes a session and its measurements (its weight is part of the row). Medical file
   * versions and life events written during it stay in the file, no longer linked to it.
   * An invoiced session has its invoice cancelled by a credit note first; both stay in the
   * invoices with their copies.
   */
  async remove(user: AccessUser, id: string) {
    const { patientId, practitionerId } = await this.ofUser(user, id);
    await this.invoices.deleteSession(practitionerId, id);
    return { patientId };
  }

  /** Adds the session's place in the follow-up and its figures. */
  private async withFigures<T extends { id: string; patientId: string }>(session: T) {
    const sessions = await this.prisma.consultation.findMany({
      where: { patientId: session.patientId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, date: true, advice: true, measurements: SESSION_WEIGHT },
    });
    const series = await this.series(session.patientId, sessions);
    return { ...session, ...series.get(session.id)! };
  }

  /** Figures of the patient's sessions, given in chronological order with their weight. */
  private async series(
    patientId: string,
    sessions: { id: string; date: Date; advice: string | null; measurements: { value: Prisma.Decimal }[] }[],
  ): Promise<Map<string, SessionInSeries>> {
    const [patient, heights] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: { sex: true, dateOfBirth: true },
      }),
      // « Taille = dernière taille connue à la date de la séance » (§ 3.1)
      this.prisma.measurement.findMany({
        where: { patientId, type: MetricType.HEIGHT },
        select: { value: true, measuredAt: true },
      }),
    ]);
    return sessionSeries(
      { ...patient, heights: heights.map((h) => ({ value: Number(h.value), measuredAt: h.measuredAt })) },
      sessions.map((s) => ({
        id: s.id,
        date: s.date,
        advice: s.advice,
        weightKg: s.measurements[0] ? Number(s.measurements[0].value) : null,
      })),
    );
  }

  /** Her « Bilan » formula for the first session, « Suivi » after; none if she has no such name. */
  private async defaultFormulaId(practitionerId: string, patientId: string) {
    const [done, formulas] = await Promise.all([
      this.prisma.consultation.count({ where: { patientId } }),
      this.prisma.formula.findMany({
        where: { practitionerId, archivedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true, label: true },
      }),
    ]);
    const name = done ? 'suivi' : 'bilan';
    return (formulas ?? []).find((f) => plain(f.label).startsWith(name))?.id;
  }

  /** The discount of the patient's previous session, to prefill the new one. */
  private async previousDiscount(patientId: string) {
    const previous = await this.prisma.consultation.findFirst({
      where: { patientId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { discountKind: true, discountValue: true, discountReason: true },
    });
    const kind = previous?.discountKind ?? null;
    return {
      discountKind: kind,
      discountValue: kind ? (previous?.discountValue ?? 0) : null,
      discountReason: kind ? (previous?.discountReason ?? null) : null,
    };
  }

  /** The patient's last payment method (« Non réglé » does not count as one). */
  private async lastPaymentMethod(patientId: string) {
    const last = await this.prisma.consultation.findFirst({
      where: { patientId, paymentMethod: { not: PaymentMethod.NONE } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { paymentMethod: true },
    });
    return last?.paymentMethod;
  }

  /**
   * The formula's label and price, copied so later price changes leave the session as it was.
   * An archived formula is refused, unless it comes from the appointment (`fromAppointment`).
   */
  private async formulaCopy(practitionerId: string, formulaId: string, fromAppointment = false) {
    const formula = await this.prisma.formula.findUnique({ where: { id: formulaId } });
    if (!formula || formula.practitionerId !== practitionerId) {
      throw new BadRequestException('Formule introuvable');
    }
    if (formula.archivedAt && !fromAppointment) {
      throw new BadRequestException("Cette formule n'est plus proposée");
    }
    return { formulaId, formulaLabel: formula.label, priceCents: formula.priceCents };
  }

  /** One of her active practices. */
  private async ownPractice(practitionerId: string, practiceId: string) {
    const practice = await this.prisma.practice.findUnique({ where: { id: practiceId } });
    if (!practice || practice.practitionerId !== practitionerId) {
      throw new BadRequestException('Cabinet introuvable');
    }
    if (practice.archivedAt) throw new BadRequestException("Ce cabinet n'est plus proposé");
    return practiceId;
  }

  /** A session of one of the user's patients. */
  private async ofUser(user: AccessUser, id: string) {
    const session = await this.prisma.consultation.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Séance introuvable');
    await this.access.assertPatient(user, session.patientId);
    return session;
  }
}

type Discount = { discountKind: ShareKind | null; discountValue: number | null; discountReason: string | null };

/**
 * The discount after a change, or null when the change leaves it as it was. No kind means no
 * discount: the value and the reason go with it.
 */
export function discountChange(
  current: Partial<Discount>,
  change: { discountKind?: ShareKind | null; discountValue?: number | null; discountReason?: string | null },
): Discount | null {
  if (change.discountKind === undefined && change.discountValue === undefined && change.discountReason === undefined) {
    return null;
  }
  const kind = change.discountKind !== undefined ? change.discountKind : (current.discountKind ?? null);
  const value = change.discountValue !== undefined ? change.discountValue : (current.discountValue ?? null);
  const reason = change.discountReason !== undefined ? change.discountReason : (current.discountReason ?? null);
  if (kind === ShareKind.PERCENT && value !== null && value > 100) {
    throw new BadRequestException('Une remise en % va de 0 à 100 %.');
  }
  if (!kind) return { discountKind: null, discountValue: null, discountReason: null };
  return { discountKind: kind, discountValue: value ?? 0, discountReason: reason };
}

/** « Bilan », « bilan » and « BILAN » alike, accents ignored. */
const plain = (label: string) =>
  label.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
