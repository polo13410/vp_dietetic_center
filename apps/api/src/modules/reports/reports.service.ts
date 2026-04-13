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

  // --- Nouveaux endpoints analytiques ---

  async getPatientsStats(user: User) {
    const practFilter = user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {};

    const [patients, byStatus] = await Promise.all([
      this.prisma.patient.findMany({
        where: { ...practFilter, deletedAt: null },
        select: { dateOfBirth: true },
      }),
      this.prisma.patient.groupBy({
        by: ['status'],
        where: { ...practFilter, deletedAt: null },
        _count: { status: true },
      }),
    ]);

    // Age groups from dateOfBirth
    const now = new Date();
    const ageGroups: Record<string, number> = {
      '0-17': 0, '18-25': 0, '26-35': 0, '36-50': 0, '51-65': 0, '65+': 0,
    };
    let noAge = 0;

    for (const p of patients) {
      if (!p.dateOfBirth) { noAge++; continue; }
      const age = now.getFullYear() - new Date(p.dateOfBirth).getFullYear();
      if (age < 18) ageGroups['0-17']++;
      else if (age <= 25) ageGroups['18-25']++;
      else if (age <= 35) ageGroups['26-35']++;
      else if (age <= 50) ageGroups['36-50']++;
      else if (age <= 65) ageGroups['51-65']++;
      else ageGroups['65+']++;
    }

    const ageGroupData = Object.entries(ageGroups).map(([name, count]) => ({ name, count }));

    const statusData = byStatus.map((s) => ({
      name: s.status === 'ACTIVE' ? 'Actif' : s.status === 'INACTIVE' ? 'Inactif' : 'Archivé',
      value: s._count.status,
    }));

    return {
      total: patients.length,
      noAge,
      ageGroupData,
      statusData,
    };
  }

  async getAppointmentsOverview(user: User, from?: string, to?: string) {
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
      select: { startAt: true, status: true, type: true },
      orderBy: { startAt: 'asc' },
    });

    // Monthly counts
    const byMonth: Record<string, { total: number; completed: number }> = {};
    const typeCount: Record<string, number> = {};

    for (const a of appointments) {
      const month = a.startAt.toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, completed: 0 };
      byMonth[month].total++;
      if (a.status === 'COMPLETED') byMonth[month].completed++;

      typeCount[a.type] = (typeCount[a.type] ?? 0) + 1;
    }

    const TYPE_LABELS: Record<string, string> = {
      IN_PERSON: 'En cabinet',
      VIDEO: 'Vidéo',
      PHONE: 'Téléphone',
    };

    const monthlyData = Object.entries(byMonth).map(([month, d]) => ({
      month,
      total: d.total,
      completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    }));

    const typeData = Object.entries(typeCount).map(([type, value]) => ({
      name: TYPE_LABELS[type] ?? type,
      value,
    }));

    return { monthlyData, typeData };
  }

  async getNutritionTrends(user: User, from?: string, to?: string) {
    const dateFilter =
      from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    // Only include patients belonging to this practitioner
    const patientIds = user.role !== UserRole.ADMIN
      ? (await this.prisma.patient.findMany({
          where: { practitionerId: user.id, deletedAt: null },
          select: { id: true },
        })).map((p) => p.id)
      : undefined;

    const entries = await this.prisma.nutritionalEntry.findMany({
      where: {
        ...dateFilter,
        ...(patientIds ? { patientId: { in: patientIds } } : {}),
        OR: [
          { weight: { not: null } },
          { bmi: { not: null } },
          { energyLevel: { not: null } },
          { waterIntake: { not: null } },
        ],
      },
      select: { date: true, weight: true, bmi: true, energyLevel: true, waterIntake: true },
      orderBy: { date: 'asc' },
    });

    // Group by month, compute averages
    const byMonth: Record<string, { weight: number[]; bmi: number[]; energy: number[]; water: number[] }> = {};

    for (const e of entries) {
      const month = new Date(e.date).toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { weight: [], bmi: [], energy: [], water: [] };
      if (e.weight != null) byMonth[month].weight.push(Number(e.weight));
      if (e.bmi != null) byMonth[month].bmi.push(Number(e.bmi));
      if (e.energyLevel != null) byMonth[month].energy.push(e.energyLevel);
      if (e.waterIntake != null) byMonth[month].water.push(Number(e.waterIntake));
    }

    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : null;

    return Object.entries(byMonth).map(([month, d]) => ({
      month,
      avgWeight: avg(d.weight),
      avgBmi: avg(d.bmi),
      avgEnergy: avg(d.energy),
      avgWater: avg(d.water),
    }));
  }
}
