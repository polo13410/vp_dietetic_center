import { Injectable, NotFoundException } from '@nestjs/common';
import { GpReportStatus } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateGpReportDto, UpdateGpReportDto } from './dto/entries.dto';
import { dayOf } from './patient-file.service';

/**
 * Reports to the patient's general practitioner. A file can have several over time; each is a
 * draft until marked as sent. The writing screen and the pre-filled draft come in lot 10.
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

  async findOne(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    return this.owned(patientId, id);
  }

  async create(user: AccessUser, patientId: string, dto: CreateGpReportDto) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.gpReport.create({
      data: {
        patientId,
        authorId: user.id,
        date: dayOf(dto.date ? new Date(dto.date) : new Date()),
        content: dto.content,
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

  async remove(user: AccessUser, patientId: string, id: string) {
    await this.access.assertPatient(user, patientId);
    await this.owned(patientId, id);
    await this.prisma.gpReport.delete({ where: { id } });
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
