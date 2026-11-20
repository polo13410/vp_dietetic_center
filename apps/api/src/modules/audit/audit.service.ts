import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAuditLogDto {
  userId: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  patientId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditQuery {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  entity?: string;
  patientId?: string;
  from?: string;
  to?: string;
}

const USER = { select: { id: true, firstName: true, lastName: true, email: true, role: true } };

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({
      data: { ...dto, metadata: dto.metadata as Prisma.InputJsonValue | undefined },
    });
  }

  /** The whole trail, newest first (admin). */
  async findAll({ page = 1, limit = 50, userId, action, entity, patientId, from, to }: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
      ...(patientId ? { patientId } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: USER },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Who read or changed one patient's file, newest first. */
  async forPatient(patientId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { patientId },
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
