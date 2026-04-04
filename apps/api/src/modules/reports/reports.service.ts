import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivityReport(user: User, from?: string, to?: string) {
    const practFilter = user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {};
    const dateFilter =
      from || to
        ? {
            startAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
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

  async getAppointmentTrend(user: User, from?: string, to?: string) {
    const practFilter = user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {};
    const dateFilter =
      from || to
        ? {
            startAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    const appointments = await this.prisma.appointment.findMany({
      where: { ...practFilter, ...dateFilter },
      select: { startAt: true, status: true },
      orderBy: { startAt: 'asc' },
    });

    // Group by date
    const byDate: Record<string, Record<string, number>> = {};
    for (const a of appointments) {
      const date = a.startAt.toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = {};
      byDate[date][a.status] = (byDate[date][a.status] ?? 0) + 1;
    }

    return Object.entries(byDate).map(([date, statuses]) => ({
      date,
      ...statuses,
      total: Object.values(statuses).reduce((s, v) => s + v, 0),
    }));
  }

  async getPatientGrowth(user: User, from?: string, _to?: string) {
    const practFilter = user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {};
    const dateFilter = from ? { createdAt: { gte: new Date(from) } } : {};

    const patients = await this.prisma.patient.findMany({
      where: { ...practFilter, ...dateFilter, deletedAt: null },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by month
    const byMonth: Record<string, number> = {};
    for (const p of patients) {
      const month = p.createdAt.toISOString().slice(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] ?? 0) + 1;
    }

    let cumulative = 0;
    return Object.entries(byMonth).map(([month, count]) => {
      cumulative += count;
      return { month, count, cumulative };
    });
  }
}
