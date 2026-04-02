import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivityReport(user: User, from?: string, to?: string) {
    const practFilter = user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {};
    const dateFilter = from || to
      ? { startAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {};

    const [totalAppointments, byStatus, newPatients, activePatients] = await Promise.all([
      this.prisma.appointment.count({ where: { ...practFilter, ...dateFilter } }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { ...practFilter, ...dateFilter },
        _count: { status: true },
      }),
      this.prisma.patient.count({
        where: {
          ...practFilter,
          deletedAt: null,
          ...(from ? { createdAt: { gte: new Date(from) } } : {}),
        },
      }),
      this.prisma.patient.count({ where: { ...practFilter, status: 'ACTIVE', deletedAt: null } }),
    ]);

    return {
      totalAppointments,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.status])),
      newPatients,
      activePatients,
    };
  }
}
