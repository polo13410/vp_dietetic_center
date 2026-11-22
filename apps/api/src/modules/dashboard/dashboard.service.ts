import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Prisma, TaskStatus } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

const DAY = 24 * 3600 * 1000;
/** A patient with no session for this long, and nothing booked, should be contacted. */
export const FOLLOW_UP_AFTER_DAYS = 42;

const UPCOMING: AppointmentStatus[] = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
const PATIENT = { select: { id: true, firstName: true, lastName: true } };

/**
 * The practitioner's day at a glance: today's appointments (with their session if it was
 * started), patients to follow up and open tasks. Sessions without an invoice come from
 * `GET /invoices/to-issue`.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  async getSummary(user: AccessUser) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + DAY);

    const [todayAppointments, followUps, tasks] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...this.access.appointmentScope(user), startAt: { gte: startOfDay, lt: endOfDay } },
        include: { patient: PATIENT, consultation: { select: { id: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.followUps(user, now),
      this.prisma.task.findMany({
        where: {
          OR: [{ assignedToId: user.id }, { createdById: user.id }],
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        },
        include: { patient: PATIENT },
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }],
        take: 10,
      }),
    ]);

    return { todayAppointments, followUps, tasks };
  }

  /**
   * Current patients with nothing booked and no session for FOLLOW_UP_AFTER_DAYS (or no
   * session at all although created that long ago): never seen first, then the longest
   * without a session.
   */
  private async followUps(user: AccessUser, now: Date) {
    const threshold = new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * DAY);
    const where: Prisma.PatientWhereInput = {
      ...this.access.patientScope(user),
      deletedAt: null,
      archivedAt: null,
      createdAt: { lt: threshold },
      consultations: { none: { date: { gte: threshold } } },
      appointments: { none: { startAt: { gte: now }, status: { in: UPCOMING } } },
    };
    const rows = await this.prisma.patient.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        consultations: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
      },
      take: 50,
    });
    return rows
      .map(({ consultations, ...patient }) => {
        const lastSessionAt = consultations[0]?.date ?? null;
        return {
          patient,
          lastSessionAt,
          daysSince: lastSessionAt ? Math.floor((now.getTime() - lastSessionAt.getTime()) / DAY) : null,
        };
      })
      .sort((a, b) => (b.daysSince ?? Number.MAX_SAFE_INTEGER) - (a.daysSince ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 10);
  }
}
