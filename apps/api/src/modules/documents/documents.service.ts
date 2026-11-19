import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface UploadDocumentDto {
  patientId: string;
  name: string;
  originalName: string;
  type: DocumentType;
  mimeType: string;
  sizeBytes: number;
  gcsPath: string;
  description?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  async findAll(user: AccessUser, patientId?: string) {
    return this.prisma.document.findMany({
      where: {
        deletedAt: null,
        ...(patientId ? { patientId } : {}),
        patient: { deletedAt: null, ...this.access.patientScope(user) },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AccessUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id, deletedAt: null },
      include: { patient: { select: { practitionerId: true } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable');
    const { patient, ...document } = doc;
    this.access.assertOwner(user, patient.practitionerId);
    return document;
  }

  async assertCanUpload(user: AccessUser, patientId: string) {
    await this.access.assertPatient(user, patientId);
  }

  async create(dto: UploadDocumentDto, user: AccessUser) {
    return this.prisma.document.create({
      data: { ...dto, uploadedById: user.id },
    });
  }

  async remove(id: string, user: AccessUser) {
    await this.findOne(id, user);
    return this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
