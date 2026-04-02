import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, user: User) {
    if (!query || query.trim().length < 2) return { patients: [], appointments: [], notes: [] };

    const q = query.trim();
    const practFilter = user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {};

    const [patients, appointments, notes] = await Promise.all([
      this.prisma.patient.findMany({
        where: {
          ...practFilter,
          deletedAt: null,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, status: true },
        take: 5,
      }),
      this.prisma.appointment.findMany({
        where: {
          ...practFilter,
          OR: [
            { reason: { contains: q, mode: 'insensitive' } },
            { patient: { firstName: { contains: q, mode: 'insensitive' } } },
            { patient: { lastName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { patient: { select: { firstName: true, lastName: true } } },
        take: 5,
        orderBy: { startAt: 'desc' },
      }),
      this.prisma.clinicalNote.findMany({
        where: {
          ...(user.role !== UserRole.ADMIN ? { authorId: user.id } : {}),
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, type: true, status: true, patientId: true, createdAt: true },
        take: 5,
      }),
    ]);

    return { patients, appointments, notes };
  }

  async getDashboardSummary(user: User) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 3600 * 1000);

    const practFilter = user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {};

    const [
      todayAppointments,
      upcomingAppointments,
      pendingTasks,
      draftNotes,
      activePatientCount,
      weekAppts,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...practFilter, startAt: { gte: startOfDay, lt: endOfDay } },
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...practFilter,
          startAt: { gte: endOfDay, lt: endOfWeek },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
      this.prisma.task.findMany({
        where: {
          OR: [{ assignedToId: user.id }, { createdById: user.id }],
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        take: 10,
      }),
      this.prisma.clinicalNote.findMany({
        where: {
          ...(user.role !== UserRole.ADMIN ? { authorId: user.id } : {}),
          status: 'DRAFT',
        },
        select: { id: true, title: true, patientId: true, updatedAt: true },
        take: 5,
      }),
      this.prisma.patient.count({ where: { ...practFilter, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.appointment.findMany({
        where: { ...practFilter, startAt: { gte: startOfDay, lt: endOfWeek } },
        select: { status: true },
      }),
    ]);

    const weekStats = weekAppts.reduce(
      (acc, a) => {
        acc.appointmentsCount++;
        if (a.status === 'COMPLETED') acc.completedCount++;
        if (a.status === 'CANCELLED') acc.cancelledCount++;
        if (a.status === 'NO_SHOW') acc.noShowCount++;
        return acc;
      },
      { appointmentsCount: 0, completedCount: 0, cancelledCount: 0, noShowCount: 0 },
    );

    return {
      todayAppointments,
      upcomingAppointments,
      pendingTasks,
      draftNotes,
      activePatientCount,
      weekStats,
    };
  }
}
