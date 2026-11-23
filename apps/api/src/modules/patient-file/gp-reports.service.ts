import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GpReportStatus, MetricType } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateGpReportDto, UpdateGpReportDto } from './dto/entries.dto';
import { buildGpReportDraft, letterhead } from './gp-report-draft';
import { dayOf, FILE_FIELDS } from './patient-file.service';

/**
 * Reports to the patient's general practitioner (docs/REFONTE.md lot 10). A file can have several
 * over time; each is a draft until marked as sent. A new report is pre-filled from the file.
 */
@Injectable()
export class GpReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  async list(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.gpReport.findMany({
      where: { patientId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /** The report with the practice's letterhead and the patient's name, as it will be printed. */
  async findOne(user: AccessUser, patientId: string, id: string) {
    const { practitionerId } = await this.access.assertPatient(user, patientId);
    const report = await this.owned(patientId, id);
    const [patient, practitioner] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: { firstName: true, lastName: true, gpName: true },
      }),
      this.practitioner(practitionerId),
    ]);
    return { ...report, patient, letterhead: letterhead(practitioner.practice, practitioner) };
  }

  /** Without a text, the report is pre-filled from the file (« Rédiger un compte rendu »). */
  async create(user: AccessUser, patientId: string, dto: CreateGpReportDto) {
    await this.access.assertPatient(user, patientId);
    const date = dayOf(dto.date ? new Date(dto.date) : new Date());
    return this.prisma.gpReport.create({
      data: {
        patientId,
        authorId: user.id,
        date,
        content: dto.content ?? (await this.draft(patientId, date)),
      },
    });
  }

  async update(user: AccessUser, patientId: string, id: string, dto: UpdateGpReportDto) {
    await this.access.assertPatient(user, patientId);
    const report = await this.owned(patientId, id);
    return this.prisma.gpReport.update({
      where: { id },
      data: {
        content: dto.content,
        date: dto.date ? dayOf(new Date(dto.date)) : undefined,
        ...(dto.status ? statusChange(dto.status, report.sentAt) : {}),
      },
    });
  }

  /** « Régénérer »: the draft's text is replaced by a new one from the file, dated today. */
  async regenerate(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    const report = await this.owned(patientId, id);
    if (report.status !== GpReportStatus.DRAFT) {
      throw new ConflictException('Ce compte rendu a été envoyé : il ne peut plus être régénéré');
    }
    const date = dayOf(new Date());
    return this.prisma.gpReport.update({
      where: { id },
      data: { date, content: await this.draft(patientId, date) },
    });
  }

  /** The same, to print the PDF (the route records it as a download). */
  document(user: AccessUser, patientId: string, id: string) {
    return this.findOne(user, patientId, id);
  }

  async remove(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await this.owned(patientId, id);
    await this.prisma.gpReport.delete({ where: { id } });
  }

  /** Gathers what the letter tells and writes it. */
  private async draft(patientId: string, today: Date): Promise<string> {
    const [patient, measurements, sessions, entries] = await Promise.all([
      this.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
        select: {
          firstName: true,
          lastName: true,
          sex: true,
          dateOfBirth: true,
          gpName: true,
          consultationReason: true,
          practitionerId: true,
        },
      }),
      this.prisma.measurement.findMany({
        where: { patientId, type: { in: [MetricType.WEIGHT, MetricType.HEIGHT] } },
        orderBy: [{ measuredAt: 'asc' }, { createdAt: 'asc' }],
        select: { type: true, value: true, measuredAt: true },
      }),
      this.prisma.consultation.findMany({
        where: { patientId },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: { date: true, sessionWork: true, advice: true },
      }),
      this.prisma.fileEntry.findMany({
        where: { patientId, field: { in: FILE_FIELDS } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        distinct: ['field'],
        select: { field: true, content: true },
      }),
    ]);
    const practitioner = await this.practitioner(patient.practitionerId);
    const points = (type: MetricType) =>
      measurements.filter((m) => m.type === type).map((m) => ({ value: Number(m.value), measuredAt: m.measuredAt }));

    return buildGpReportDraft({
      today,
      practice: practitioner.practice,
      practitioner,
      patient,
      heights: points(MetricType.HEIGHT),
      weights: points(MetricType.WEIGHT),
      sessions,
      file: entries,
    });
  }

  private practitioner(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { firstName: true, lastName: true, phone: true, email: true, practice: true },
    });
  }

  private async owned(patientId: string, id: string) {
    const report = await this.prisma.gpReport.findUnique({ where: { id } });
    if (!report || report.patientId !== patientId) {
      throw new NotFoundException('Compte rendu introuvable');
    }
    return report;
  }
}

/** Marking as sent records when (once); back to draft clears it. */
function statusChange(status: GpReportStatus, sentAt: Date | null) {
  return status === GpReportStatus.SENT
    ? { status, sentAt: sentAt ?? new Date() }
    : { status, sentAt: null };
}
