import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, MetricType, Prisma } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import { SessionInSeries, sessionSeries } from './calculations';
import { CreateConsultationDto, UpdateConsultationDto } from './dto/consultation.dto';

/** Everything recorded during a session, shown on the session screen. */
const SESSION_CONTENT = {
  appointment: { select: { id: true, startAt: true, duration: true, type: true, reason: true } },
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
  ) {}

  /** The follow-up sheet, latest session first. */
  async list(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const sessions = await this.prisma.consultation.findMany({
      where: { patientId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        appointment: { select: { id: true, startAt: true, type: true } },
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

  /** Starts a session. Starting it again from the same appointment returns the existing one. */
  async create(user: AccessUser, patientId: string, dto: CreateConsultationDto) {
    const { practitionerId } = await this.access.assertPatient(user, patientId);

    let date = dto.date ? new Date(dto.date) : new Date();
    if (dto.appointmentId) {
      await this.access.assertAppointment(user, dto.appointmentId, patientId);
      const existing = await this.prisma.consultation.findUnique({
        where: { appointmentId: dto.appointmentId },
      });
      if (existing) return existing;
      const appointment = await this.prisma.appointment.findUniqueOrThrow({
        where: { id: dto.appointmentId },
        select: { startAt: true, status: true },
      });
      if (appointment.status === AppointmentStatus.CANCELLED) {
        throw new BadRequestException('Ce rendez-vous est annulé');
      }
      if (!dto.date) date = appointment.startAt;
    }

    const data = {
      patientId,
      practitionerId,
      appointmentId: dto.appointmentId,
      date,
      paymentMethod: dto.paymentMethod,
      ...(dto.formulaId ? await this.formulaCopy(practitionerId, dto.formulaId) : {}),
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

  async update(user: AccessUser, id: string, dto: UpdateConsultationDto) {
    const session = await this.ofUser(user, id);
    const { formulaId, date, ...texts } = dto;
    let formula = {};
    if (formulaId === null) formula = { formulaId: null, formulaLabel: null, priceCents: null };
    // Choosing the same formula again keeps the price copied at the time
    else if (formulaId && formulaId !== session.formulaId) {
      formula = await this.formulaCopy(session.practitionerId, formulaId);
    }
    return this.prisma.consultation.update({
      where: { id },
      data: { ...texts, ...formula, date: date ? new Date(date) : undefined },
    });
  }

  /**
   * Deletes a session and its measurements (its weight is part of the row). Medical file
   * versions and life events written during it stay in the file, no longer linked to it.
   */
  async remove(user: AccessUser, id: string) {
    const { patientId } = await this.ofUser(user, id);
    await this.prisma.$transaction([
      this.prisma.measurement.deleteMany({ where: { consultationId: id } }),
      this.prisma.consultation.delete({ where: { id } }),
    ]);
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
    const [patient, height] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: { sex: true, dateOfBirth: true },
      }),
      // "Taille = dernière taille connue"
      this.prisma.measurement.findFirst({
        where: { patientId, type: MetricType.HEIGHT },
        orderBy: [{ measuredAt: 'desc' }, { createdAt: 'desc' }],
        select: { value: true },
      }),
    ]);
    return sessionSeries(
      { ...patient, heightCm: height ? Number(height.value) : null },
      sessions.map((s) => ({
        id: s.id,
        date: s.date,
        advice: s.advice,
        weightKg: s.measurements[0] ? Number(s.measurements[0].value) : null,
      })),
    );
  }

  /** The formula's label and price, copied so later price changes leave the session as it was. */
  private async formulaCopy(practitionerId: string, formulaId: string) {
    const formula = await this.prisma.formula.findUnique({ where: { id: formulaId } });
    if (!formula || formula.practitionerId !== practitionerId) {
      throw new BadRequestException('Formule introuvable');
    }
    if (formula.archivedAt) throw new BadRequestException("Cette formule n'est plus proposée");
    return { formulaId, formulaLabel: formula.label, priceCents: formula.priceCents };
  }

  /** A session of one of the user's patients. */
  private async ofUser(user: AccessUser, id: string) {
    const session = await this.prisma.consultation.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Séance introuvable');
    await this.access.assertPatient(user, session.patientId);
    return session;
  }
}
