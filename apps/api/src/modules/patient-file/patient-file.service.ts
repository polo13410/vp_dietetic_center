import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FileField, GpReportStatus, MetricType, Prisma, TaskStatus } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import { Bmi, computeBmi, sessionFigures } from './calculations';
import {
  CreateLifeEventDto,
  CreateMeasurementDto,
  SaveFileFieldDto,
  UpdateFileEntryDto,
  UpdateLifeEventDto,
  UpdateMeasurementDto,
} from './dto/entries.dto';

/** Plausible range of each measurement, to catch typos (72 kg typed as 720). */
const METRIC_RANGES: Record<MetricType, [number, number]> = {
  WEIGHT: [1, 500],
  HEIGHT: [30, 250],
  WAIST: [20, 300],
  HIP: [20, 300],
  BODY_FAT: [1, 80],
  MUSCLE_MASS: [1, 200],
};

/** Sections of the medical file, in the practitioner's order. */
export const FILE_FIELDS = Object.values(FileField);

type MeasurementRow = { type: MetricType; value: Prisma.Decimal; measuredAt: Date };
type Point = { value: number; measuredAt: Date };

/**
 * The patient's file: medical file sections with their history, measurements and life events,
 * plus the summary shown before a session. The practitioner's own patients only ("full"
 * access). Nothing is ever locked: the access log keeps track of changes.
 */
@Injectable()
export class PatientFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  // ─── Summary before a session ────────────────────────────────────────────────

  /**
   * With `beforeSessionId`, the summary as it was before that session (the « Rappel » beside it):
   * that session and later ones are left out, with the measurements taken in them, so its own
   * weight and texts are not shown as « the last session ».
   */
  async getBrief(user: AccessUser, patientId: string, beforeSessionId?: string) {
    await this.access.assertPatient(user, patientId);
    const now = new Date();

    const [
      patient,
      allConsultations,
      nextAppointment,
      allMeasurements,
      file,
      recentEvents,
      openTasks,
      latestGpReport,
    ] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          sex: true,
          dateOfBirth: true,
          birthDateEstimated: true,
          phone: true,
          email: true,
          familySituation: true,
          profession: true,
          gpName: true,
          consultationReason: true,
          referralSource: true,
          createdAt: true,
        },
      }),
      this.prisma.consultation.findMany({
        where: { patientId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, date: true, habits: true, sessionWork: true, advice: true },
      }),
      this.prisma.appointment.findFirst({
        where: { patientId, startAt: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        orderBy: { startAt: 'asc' },
        select: { id: true, startAt: true, duration: true, type: true, reason: true },
      }),
      this.prisma.measurement.findMany({
        where: { patientId },
        orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }],
        select: { type: true, value: true, measuredAt: true, consultationId: true },
      }),
      this.currentFile(patientId),
      this.prisma.lifeEvent.findMany({
        where: { patientId },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.task.findMany({
        where: { patientId, status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] } },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        take: 5,
        select: { id: true, title: true, priority: true, dueAt: true },
      }),
      // A draft first (« à faire »), else the latest one sent; DRAFT comes before SENT in the enum
      this.prisma.gpReport.findFirst({
        where: { patientId },
        orderBy: [{ status: 'asc' }, { date: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, date: true, status: true, sentAt: true },
      }),
    ]);

    let consultations = allConsultations;
    let measurements = allMeasurements;
    if (beforeSessionId) {
      // Latest first: the session, then the earlier ones
      const index = allConsultations.findIndex((c) => c.id === beforeSessionId);
      if (index === -1) throw new NotFoundException('Séance introuvable');
      const leftOut = new Set(allConsultations.slice(0, index + 1).map((c) => c.id));
      consultations = allConsultations.slice(index + 1);
      measurements = allMeasurements.filter((m) => !m.consultationId || !leftOut.has(m.consultationId));
    }

    const lastConsultation = consultations[0] ?? null;
    const metrics = this.summarizeMetrics(measurements);
    const weight = metrics.find((m) => m.type === MetricType.WEIGHT);
    const height = metrics.find((m) => m.type === MetricType.HEIGHT)?.latest.value;
    const current = sessionFigures({
      sex: patient.sex,
      dateOfBirth: patient.dateOfBirth,
      heightCm: height,
      weightKg: weight?.latest.value,
      date: now,
    });

    return {
      patient: { ...patient, age: current.age },
      consultationCount: consultations.length,
      firstConsultationAt: consultations.at(-1)?.date ?? null,
      lastConsultation,
      nextAppointment,
      metrics,
      bmi: {
        current: current.bmi,
        atStart: computeBmi(weight?.first.value, height),
      },
      bmr: current.bmr,
      /** What is missing to compute BMI and BMR now */
      missing: current.missing,
      file,
      recentEvents,
      // Events since the last session are the ones to ask about
      newEventsSinceLastConsultation: lastConsultation
        ? recentEvents.filter((e) => e.date > lastConsultation.date).length
        : recentEvents.length,
      openTasks,
      latestGpReport,
      gpReportToDo: latestGpReport?.status === GpReportStatus.DRAFT,
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
    const existing = await owned(this.prisma.measurement.findUnique({ where: { id } }), patientId);
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
    await owned(this.prisma.measurement.findUnique({ where: { id } }), patientId);
    await this.prisma.measurement.delete({ where: { id } });
  }

  // ─── Medical file ────────────────────────────────────────────────────────────

  /** Each section in her order, with its current value (latest entry) and how many versions. */
  async getFile(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    return this.currentFile(patientId);
  }

  /** Versions of the file, latest first; one section only if `field` is given. */
  async listFileEntries(user: AccessUser, patientId: string, field?: FileField) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.fileEntry.findMany({
      where: { patientId, ...(field ? { field } : {}) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { consultation: { select: { id: true, date: true } } },
    });
  }

  /**
   * Saves the text of a section as she types it. The same day (or within the same session) it
   * updates that entry; another day it adds a new version, so the history follows the changes
   * without asking anything of her. An unchanged text adds nothing.
   */
  async saveFileField(user: AccessUser, patientId: string, field: FileField, dto: SaveFileFieldDto) {
    await this.assertCanWrite(user, patientId, dto.consultationId);
    const content = dto.content.trim();
    const day = dayOf(await this.entryDate(undefined, dto.consultationId));

    const sessionEntry = dto.consultationId
      ? await this.prisma.fileEntry.findFirst({
          where: { patientId, field, consultationId: dto.consultationId },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const latest =
      sessionEntry ??
      (await this.prisma.fileEntry.findFirst({
        where: { patientId, field },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }));

    if (latest && (sessionEntry || sameDay(latest.date, day))) {
      return this.prisma.fileEntry.update({
        where: { id: latest.id },
        data: { content, consultationId: latest.consultationId ?? dto.consultationId },
      });
    }
    if (latest && latest.content === content) return latest;
    return this.prisma.fileEntry.create({
      data: { patientId, field, content, date: day, consultationId: dto.consultationId },
    });
  }

  /** Corrects a version of the history. */
  async updateFileEntry(user: AccessUser, patientId: string, id: string, dto: UpdateFileEntryDto) {
    await this.access.assertPatient(user, patientId);
    await owned(this.prisma.fileEntry.findUnique({ where: { id } }), patientId);
    return this.prisma.fileEntry.update({
      where: { id },
      data: {
        content: dto.content?.trim(),
        date: dto.date ? dayOf(new Date(dto.date)) : undefined,
      },
    });
  }

  async removeFileEntry(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await owned(this.prisma.fileEntry.findUnique({ where: { id } }), patientId);
    await this.prisma.fileEntry.delete({ where: { id } });
  }

  private async currentFile(patientId: string) {
    const entries = await this.prisma.fileEntry.findMany({
      where: { patientId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, field: true, content: true, date: true, updatedAt: true, consultationId: true },
    });
    return FILE_FIELDS.map((field) => {
      const versions = entries.filter((e) => e.field === field);
      return { field, current: versions[0] ?? null, versionCount: versions.length };
    });
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
        category: dto.category,
      },
    });
  }

  async updateLifeEvent(user: AccessUser, patientId: string, id: string, dto: UpdateLifeEventDto) {
    await this.access.assertPatient(user, patientId);
    await owned(this.prisma.lifeEvent.findUnique({ where: { id } }), patientId);
    return this.prisma.lifeEvent.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        category: dto.category,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async removeLifeEvent(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await owned(this.prisma.lifeEvent.findUnique({ where: { id } }), patientId);
    await this.prisma.lifeEvent.delete({ where: { id } });
  }

  // ─── Shared rules ────────────────────────────────────────────────────────────

  /** The patient is the user's, and the session (if any) is one of the patient's. */
  private async assertCanWrite(user: AccessUser, patientId: string, consultationId?: string) {
    await this.access.assertPatient(user, patientId);
    if (consultationId) await this.assertSessionOfPatient(patientId, consultationId);
  }

  async assertSessionOfPatient(patientId: string, consultationId: string) {
    const session = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { patientId: true },
    });
    if (!session || session.patientId !== patientId) {
      throw new BadRequestException("Cette séance n'appartient pas à ce patient");
    }
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

/** An existing entry of this patient. */
async function owned<T extends { patientId: string }>(
  query: Promise<T | null>,
  patientId: string,
): Promise<T> {
  const entry = await query;
  if (!entry || entry.patientId !== patientId) throw new NotFoundException('Élément introuvable');
  return entry;
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

/** The calendar day of a date, as stored in a date-only column. */
export function dayOf(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function sameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
