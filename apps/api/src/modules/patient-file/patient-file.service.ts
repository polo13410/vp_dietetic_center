import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ConsultationStatus,
  GoalStatus,
  MetricType,
  PatientTopic,
  Prisma,
  TaskStatus,
} from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import { Bmi, computeBmi } from './bmi';
import {
  CreateGoalDto,
  CreateLifeEventDto,
  CreateMeasurementDto,
  CreateTopicNoteDto,
  UpdateGoalDto,
  UpdateLifeEventDto,
  UpdateMeasurementDto,
  UpdateTopicNoteDto,
} from './dto/entries.dto';

/** Plausible range of each measurement, to catch typos (72 kg typed as 720). */
const METRIC_RANGES: Record<MetricType, [number, number]> = {
  WEIGHT: [1, 500],
  HEIGHT: [30, 250],
  WAIST: [20, 300],
  HIP: [20, 300],
  BODY_FAT: [1, 80],
  MUSCLE_MASS: [1, 200],
  ENERGY: [1, 10],
  SLEEP_QUALITY: [1, 10],
  STRESS: [1, 10],
  HUNGER: [1, 10],
};

const CLOSED_GOAL_STATUSES: GoalStatus[] = [GoalStatus.ACHIEVED, GoalStatus.ABANDONED];

type MeasurementRow = { type: MetricType; value: Prisma.Decimal; measuredAt: Date };
type Point = { value: number; measuredAt: Date };

/**
 * The patient's file: measurements, topic notes, life events and goals, plus the summary
 * shown before a session. Everything is the practitioner's own patients only ("full" access).
 * Entries recorded during a session are locked once that session is finalized.
 */
@Injectable()
export class PatientFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  // ─── Summary before a session ────────────────────────────────────────────────

  async getBrief(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    const now = new Date();

    const [
      patient,
      consultations,
      nextAppointment,
      measurements,
      topicNotes,
      recentEvents,
      openGoals,
      openTasks,
    ] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          status: true,
          consultationReason: true,
          allergies: true,
          dietaryRestrictions: true,
          privateNote: true,
          createdAt: true,
        },
      }),
      this.prisma.consultation.findMany({
        where: { patientId, status: ConsultationStatus.FINALIZED },
        orderBy: { date: 'desc' },
        select: { id: true, date: true, summary: true, advice: true },
      }),
      this.prisma.appointment.findFirst({
        where: { patientId, startAt: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        orderBy: { startAt: 'asc' },
        select: { id: true, startAt: true, duration: true, type: true, reason: true },
      }),
      this.prisma.measurement.findMany({
        where: { patientId },
        orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }],
        select: { type: true, value: true, measuredAt: true },
      }),
      this.latestTopicNotes(patientId),
      this.prisma.lifeEvent.findMany({
        where: { patientId },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.goal.findMany({
        where: { patientId, status: { notIn: CLOSED_GOAL_STATUSES } },
        orderBy: { createdAt: 'asc' },
        include: {
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { consultation: { select: { date: true } } },
          },
        },
      }),
      this.prisma.task.findMany({
        where: { patientId, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        take: 5,
        select: { id: true, title: true, priority: true, dueAt: true },
      }),
    ]);

    const lastConsultation = consultations[0] ?? null;
    const metrics = this.summarizeMetrics(measurements);
    const weight = metrics.find((m) => m.type === MetricType.WEIGHT);
    const height = metrics.find((m) => m.type === MetricType.HEIGHT)?.latest.value;

    return {
      patient,
      consultationCount: consultations.length,
      firstConsultationAt: consultations.at(-1)?.date ?? null,
      lastConsultation,
      nextAppointment,
      metrics,
      bmi: {
        current: computeBmi(weight?.latest.value, height),
        atStart: computeBmi(weight?.first.value, height),
      },
      topics: topicNotes,
      recentEvents,
      // Events since the last session are the ones to ask about
      newEventsSinceLastConsultation: lastConsultation
        ? recentEvents.filter((e) => e.date > lastConsultation.date).length
        : recentEvents.length,
      openGoals,
      openTasks,
    };
  }

  /** For each measured type: first, previous and latest value (to show the change). */
  private summarizeMetrics(rows: MeasurementRow[]) {
    const byType = new Map<MetricType, Point[]>();
    for (const row of rows) {
      const points = byType.get(row.type) ?? [];
      points.push({ value: Number(row.value), measuredAt: row.measuredAt });
      byType.set(row.type, points);
    }
    return [...byType.entries()].map(([type, points]) => ({
      type,
      count: points.length,
      first: points[0],
      previous: points.length > 1 ? points[points.length - 2] : null,
      latest: points[points.length - 1],
    }));
  }

  /** Latest BMI of each patient (latest weight with latest height), for lists and headers. */
  async bmiFor(patientIds: string[]): Promise<Map<string, Bmi>> {
    if (patientIds.length === 0) return new Map();
    const latest = await this.prisma.measurement.findMany({
      where: {
        patientId: { in: patientIds },
        type: { in: [MetricType.WEIGHT, MetricType.HEIGHT] },
      },
      distinct: ['patientId', 'type'],
      orderBy: [{ patientId: 'asc' }, { type: 'asc' }, { measuredAt: 'desc' }, { createdAt: 'desc' }],
      select: { patientId: true, type: true, value: true },
    });
    const values = new Map<string, { weight?: number; height?: number }>();
    for (const m of latest) {
      const v = values.get(m.patientId) ?? {};
      if (m.type === MetricType.WEIGHT) v.weight = Number(m.value);
      else v.height = Number(m.value);
      values.set(m.patientId, v);
    }
    const result = new Map<string, Bmi>();
    for (const [id, v] of values) {
      const bmi = computeBmi(v.weight, v.height);
      if (bmi) result.set(id, bmi);
    }
    return result;
  }

  // ─── Measurements ────────────────────────────────────────────────────────────

  async listMeasurements(user: AccessUser, patientId: string, type?: MetricType) {
    await this.access.assertPatient(user, patientId);
    const rows = await this.prisma.measurement.findMany({
      where: { patientId, ...(type ? { type } : {}) },
      orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toNumberValue);
  }

  async createMeasurement(user: AccessUser, patientId: string, dto: CreateMeasurementDto) {
    await this.assertCanWrite(user, patientId, dto.consultationId);
    assertInRange(dto.type, dto.value);
    const row = await this.prisma.measurement.create({
      data: {
        patientId,
        consultationId: dto.consultationId,
        type: dto.type,
        value: dto.value,
        measuredAt: await this.entryDate(dto.measuredAt, dto.consultationId),
        note: dto.note,
      },
    });
    return toNumberValue(row);
  }

  async updateMeasurement(
    user: AccessUser,
    patientId: string,
    id: string,
    dto: UpdateMeasurementDto,
  ) {
    await this.access.assertPatient(user, patientId);
    const existing = await this.editable(
      this.prisma.measurement.findUnique({ where: { id }, include: { consultation: true } }),
      patientId,
    );
    if (dto.value !== undefined) assertInRange(existing.type, dto.value);
    const row = await this.prisma.measurement.update({
      where: { id },
      data: {
        value: dto.value,
        measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : undefined,
        note: dto.note,
      },
    });
    return toNumberValue(row);
  }

  async removeMeasurement(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await this.editable(
      this.prisma.measurement.findUnique({ where: { id }, include: { consultation: true } }),
      patientId,
    );
    await this.prisma.measurement.delete({ where: { id } });
  }

  // ─── Topic notes ─────────────────────────────────────────────────────────────

  async listTopicNotes(user: AccessUser, patientId: string, topic?: PatientTopic) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.topicNote.findMany({
      where: { patientId, ...(topic ? { topic } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { consultation: { select: { id: true, date: true } } },
    });
  }

  async createTopicNote(user: AccessUser, patientId: string, dto: CreateTopicNoteDto) {
    await this.assertCanWrite(user, patientId, dto.consultationId);
    return this.prisma.topicNote.create({
      data: {
        patientId,
        consultationId: dto.consultationId,
        topic: dto.topic,
        content: dto.content.trim(),
      },
    });
  }

  async updateTopicNote(user: AccessUser, patientId: string, id: string, dto: UpdateTopicNoteDto) {
    await this.access.assertPatient(user, patientId);
    await this.editable(
      this.prisma.topicNote.findUnique({ where: { id }, include: { consultation: true } }),
      patientId,
    );
    return this.prisma.topicNote.update({ where: { id }, data: { content: dto.content.trim() } });
  }

  async removeTopicNote(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await this.editable(
      this.prisma.topicNote.findUnique({ where: { id }, include: { consultation: true } }),
      patientId,
    );
    await this.prisma.topicNote.delete({ where: { id } });
  }

  /** The current state of each topic: its most recent note. */
  private async latestTopicNotes(patientId: string) {
    const notes = await this.prisma.topicNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, topic: true, content: true, createdAt: true },
    });
    const latest = new Map<PatientTopic, (typeof notes)[number]>();
    for (const note of notes) if (!latest.has(note.topic)) latest.set(note.topic, note);
    return [...latest.values()];
  }

  // ─── Life events ─────────────────────────────────────────────────────────────

  async listLifeEvents(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.lifeEvent.findMany({ where: { patientId }, orderBy: { date: 'desc' } });
  }

  async createLifeEvent(user: AccessUser, patientId: string, dto: CreateLifeEventDto) {
    await this.assertCanWrite(user, patientId, dto.consultationId);
    return this.prisma.lifeEvent.create({
      data: {
        patientId,
        consultationId: dto.consultationId,
        date: new Date(dto.date),
        title: dto.title.trim(),
        description: dto.description,
        category: dto.category,
      },
    });
  }

  async updateLifeEvent(user: AccessUser, patientId: string, id: string, dto: UpdateLifeEventDto) {
    await this.access.assertPatient(user, patientId);
    await this.editable(
      this.prisma.lifeEvent.findUnique({ where: { id }, include: { consultation: true } }),
      patientId,
    );
    return this.prisma.lifeEvent.update({
      where: { id },
      data: {
        ...dto,
        title: dto.title?.trim(),
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async removeLifeEvent(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await this.editable(
      this.prisma.lifeEvent.findUnique({ where: { id }, include: { consultation: true } }),
      patientId,
    );
    await this.prisma.lifeEvent.delete({ where: { id } });
  }

  // ─── Goals ───────────────────────────────────────────────────────────────────

  async listGoals(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.goal.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        consultation: { select: { id: true, date: true } },
        reviews: {
          orderBy: { createdAt: 'asc' },
          include: { consultation: { select: { id: true, date: true } } },
        },
      },
    });
  }

  async createGoal(user: AccessUser, patientId: string, dto: CreateGoalDto) {
    await this.assertCanWrite(user, patientId, dto.consultationId);
    return this.prisma.goal.create({
      data: {
        patientId,
        consultationId: dto.consultationId,
        title: dto.title.trim(),
        details: dto.details,
      },
    });
  }

  /** Goals stay editable after their session: their status follows the patient's progress. */
  async updateGoal(user: AccessUser, patientId: string, id: string, dto: UpdateGoalDto) {
    await this.access.assertPatient(user, patientId);
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal || goal.patientId !== patientId) throw new NotFoundException('Objectif introuvable');
    return this.prisma.goal.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        details: dto.details,
        ...(dto.status ? goalStatusChange(dto.status) : {}),
      },
    });
  }

  async removeGoal(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await this.editable(
      this.prisma.goal.findUnique({ where: { id }, include: { consultation: true } }),
      patientId,
    );
    await this.prisma.goal.delete({ where: { id } });
  }

  // ─── Shared rules ────────────────────────────────────────────────────────────

  /** The patient is the user's, and the session (if any) is theirs and still a draft. */
  private async assertCanWrite(user: AccessUser, patientId: string, consultationId?: string) {
    await this.access.assertPatient(user, patientId);
    if (consultationId) await this.assertDraftSession(patientId, consultationId);
  }

  async assertDraftSession(patientId: string, consultationId: string) {
    const session = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { patientId: true, status: true },
    });
    if (!session || session.patientId !== patientId) {
      throw new BadRequestException("Cette séance n'appartient pas à ce patient");
    }
    if (session.status === ConsultationStatus.FINALIZED) {
      throw new BadRequestException('Cette séance est finalisée : elle ne peut plus être modifiée');
    }
  }

  /** An existing entry of this patient that is not locked by a finalized session. */
  private async editable<
    T extends { patientId: string; consultation: { status: ConsultationStatus } | null },
  >(query: Promise<T | null>, patientId: string): Promise<T> {
    const entry = await query;
    if (!entry || entry.patientId !== patientId) throw new NotFoundException('Élément introuvable');
    if (entry.consultation?.status === ConsultationStatus.FINALIZED) {
      throw new BadRequestException(
        'Cet élément fait partie d’une séance finalisée : il ne peut plus être modifié',
      );
    }
    return entry;
  }

  /** Date of an entry: the given one, else the session's date, else today. */
  private async entryDate(date: string | undefined, consultationId?: string): Promise<Date> {
    if (date) return new Date(date);
    if (consultationId) {
      const session = await this.prisma.consultation.findUnique({
        where: { id: consultationId },
        select: { date: true },
      });
      if (session) return session.date;
    }
    return new Date();
  }
}

function assertInRange(type: MetricType, value: number) {
  const [min, max] = METRIC_RANGES[type];
  if (value < min || value > max) {
    throw new BadRequestException(`Valeur hors limites pour ${type} (entre ${min} et ${max})`);
  }
}

function toNumberValue<T extends { value: Prisma.Decimal }>(row: T) {
  return { ...row, value: Number(row.value) };
}

/** A goal reaching a final status gets a closing date; reopening it clears that date. */
export function goalStatusChange(status: GoalStatus) {
  return { status, closedAt: CLOSED_GOAL_STATUSES.includes(status) ? new Date() : null };
}
