import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  async search(query: string, user: User) {
    if (!query || query.trim().length < 2) return { patients: [], appointments: [], consultations: [] };

    const q = query.trim();
    const apptScope = this.access.appointmentScope(user);

    const [patients, appointments, consultations] = await Promise.all([
      this.prisma.patient.findMany({
        where: {
          ...this.access.patientScope(user, 'record'),
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
          ...apptScope,
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
      // Session records: only the practitioner's own
      this.prisma.consultation.findMany({
        where: {
          practitionerId: user.id,
          OR: [
            { summary: { contains: q, mode: 'insensitive' } },
            { advice: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          date: true,
          status: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ]);

    return { patients, appointments, consultations };
  }

  async getDashboardSummary(user: User) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);
    const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 3600 * 1000);

    const apptScope = this.access.appointmentScope(user);

    const [
      todayAppointments,
      upcomingAppointments,
      pendingTasks,
      draftConsultations,
      activePatientCount,
      weekAppts,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...apptScope, startAt: { gte: startOfDay, lt: endOfDay } },
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...apptScope,
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
      // Sessions left unfinished
      this.prisma.consultation.findMany({
        where: { practitionerId: user.id, status: 'DRAFT' },
        select: {
          id: true,
          date: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.patient.count({
        where: { ...this.access.patientScope(user, 'record'), status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.appointment.findMany({
        where: { ...apptScope, startAt: { gte: startOfDay, lt: endOfWeek } },
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
      draftConsultations,
      activePatientCount,
      weekStats,
    };
  }
}
