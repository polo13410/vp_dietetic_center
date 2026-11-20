import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, ConsultationStatus, GoalStatus } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateConsultationDto, ReviewGoalDto, UpdateConsultationDto } from './dto/consultation.dto';
import { goalStatusChange, PatientFileService } from './patient-file.service';

/** Everything recorded during a session, shown on the session screen. */
const SESSION_CONTENT = {
  appointment: { select: { id: true, startAt: true, duration: true, type: true, reason: true } },
  patient: { select: { id: true, firstName: true, lastName: true } },
  measurements: { orderBy: { type: 'asc' as const } },
  topicNotes: { orderBy: { createdAt: 'asc' as const } },
  lifeEvents: { orderBy: { date: 'asc' as const } },
  goals: { orderBy: { createdAt: 'asc' as const } },
  goalReviews: {
    orderBy: { createdAt: 'asc' as const },
    include: { goal: { select: { id: true, title: true } } },
  },
};

/**
 * A session ("séance") with a patient. It starts as a draft, usually from an appointment,
 * collects what is recorded during it, and is finalized at the end: it is then locked and
 * the appointment is marked as done.
 */
@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
    private readonly file: PatientFileService,
  ) {}

  async list(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.consultation.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
      include: {
        appointment: { select: { id: true, startAt: true, type: true } },
        _count: {
          select: { measurements: true, topicNotes: true, lifeEvents: true, goals: true },
        },
      },
    });
  }

  async findOne(user: AccessUser, id: string) {
    const session = await this.prisma.consultation.findUnique({
      where: { id },
      include: SESSION_CONTENT,
    });
    if (!session) throw new NotFoundException('Séance introuvable');
    await this.access.assertPatient(user, session.patientId);
    return {
      ...session,
      measurements: session.measurements.map((m) => ({ ...m, value: Number(m.value) })),
    };
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

    return this.prisma.consultation.create({
      data: { patientId, practitionerId, appointmentId: dto.appointmentId, date },
    });
  }

  async update(user: AccessUser, id: string, dto: UpdateConsultationDto) {
    await this.draft(user, id);
    return this.prisma.consultation.update({
      where: { id },
      data: {
        summary: dto.summary,
        advice: dto.advice,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  /** Locks the session and marks its appointment as done. */
  async finalize(user: AccessUser, id: string) {
    const session = await this.draft(user, id);
    const [finalized] = await this.prisma.$transaction([
      this.prisma.consultation.update({
        where: { id },
        data: { status: ConsultationStatus.FINALIZED, finalizedAt: new Date() },
      }),
      ...(session.appointmentId
        ? [
            this.prisma.appointment.update({
              where: { id: session.appointmentId },
              data: { status: AppointmentStatus.COMPLETED },
            }),
          ]
        : []),
    ]);
    return finalized;
  }

  /**
   * Discards a draft session and everything recorded during it. Goals reviewed in it go back
   * to the status of their previous review (or "in progress" if there was none).
   */
  async remove(user: AccessUser, id: string) {
    await this.draft(user, id);
    const where = { consultationId: id };
    await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.goalReview.findMany({ where, select: { goalId: true } });
      for (const { goalId } of reviewed) {
        const previous = await tx.goalReview.findFirst({
          where: { goalId, consultationId: { not: id } },
          orderBy: { createdAt: 'desc' },
          select: { status: true },
        });
        await tx.goal.update({
          where: { id: goalId },
          data: goalStatusChange(previous?.status ?? GoalStatus.IN_PROGRESS),
        });
      }
      await tx.measurement.deleteMany({ where });
      await tx.topicNote.deleteMany({ where });
      await tx.lifeEvent.deleteMany({ where });
      await tx.goal.deleteMany({ where });
      await tx.consultation.delete({ where: { id } }); // its goal reviews go with it
    });
  }

  /** Records how a goal stands at this session, and moves the goal to that status. */
  async reviewGoal(user: AccessUser, id: string, goalId: string, dto: ReviewGoalDto) {
    const session = await this.draft(user, id);
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.patientId !== session.patientId) {
      throw new NotFoundException('Objectif introuvable');
    }
    const [review] = await this.prisma.$transaction([
      this.prisma.goalReview.upsert({
        where: { goalId_consultationId: { goalId, consultationId: id } },
        create: { goalId, consultationId: id, status: dto.status, comment: dto.comment },
        update: { status: dto.status, comment: dto.comment },
      }),
      this.prisma.goal.update({ where: { id: goalId }, data: goalStatusChange(dto.status) }),
    ]);
    return review;
  }

  /** A session of the user's patient that can still be changed. */
  private async draft(user: AccessUser, id: string) {
    const session = await this.prisma.consultation.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Séance introuvable');
    await this.access.assertPatient(user, session.patientId);
    await this.file.assertDraftSession(session.patientId, id);
    return session;
  }
}
