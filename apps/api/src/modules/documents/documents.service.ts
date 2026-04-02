import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, User } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(patientId?: string) {
    return this.prisma.document.findMany({
      where: { deletedAt: null, ...(patientId ? { patientId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundException('Document introuvable');
    return doc;
  }

  async create(dto: UploadDocumentDto, user: User) {
    return this.prisma.document.create({
      data: { ...dto, uploadedById: user.id },
    });
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    return this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
