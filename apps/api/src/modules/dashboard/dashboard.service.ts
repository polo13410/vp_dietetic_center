import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Prisma, TaskStatus } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

const DAY = 24 * 3600 * 1000;
/** A patient not seen for this long, with nothing booked, should be contacted. */
export const FOLLOW_UP_AFTER_DAYS = 42;
/** A patient is "followed" if seen recently or booked. */
const FOLLOWED_WITHIN_DAYS = 90;

const UPCOMING: AppointmentStatus[] = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];
const TOOK_PLACE: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
];
const PATIENT = { select: { id: true, firstName: true, lastName: true } };

/**
 * The practitioner's day at a glance: today's appointments and their sessions, the next
 * patient, patients to follow up and tasks due.
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
    const startOfWeek = new Date(startOfDay.getTime() - ((startOfDay.getDay() + 6) % 7) * DAY);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * DAY);

    const appointments = this.access.appointmentScope(user);
    const patients: Prisma.PatientWhereInput = {
      ...this.access.patientScope(user),
      deletedAt: null,
      archivedAt: null,
    };

    const [
      todayAppointments,
      nextAppointment,
      weekAppointmentCount,
      followedPatientCount,
      followUps,
      tasks,
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...appointments, startAt: { gte: startOfDay, lt: endOfDay } },
        include: { patient: PATIENT, consultation: { select: { id: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.appointment.findFirst({
        // Still to come, or started less than an hour ago; starting its session marks it done
        where: {
          ...appointments,
          startAt: { gte: new Date(now.getTime() - 3600 * 1000) },
          status: { in: UPCOMING },
        },
        include: { patient: PATIENT, consultation: { select: { id: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.appointment.count({
        where: {
          ...appointments,
          startAt: { gte: startOfWeek, lt: endOfWeek },
          status: { notIn: [AppointmentStatus.CANCELLED] },
        },
      }),
      this.prisma.patient.count({
        where: {
          ...patients,
          OR: [
            { consultations: { some: { date: { gte: new Date(now.getTime() - FOLLOWED_WITHIN_DAYS * DAY) } } } },
            { appointments: { some: { startAt: { gte: now }, status: { in: UPCOMING } } } },
          ],
        },
      }),
      this.followUps(patients, now),
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

    return {
      todayAppointments,
      nextAppointment,
      stats: {
        todayCount: todayAppointments.filter((a) => a.status !== AppointmentStatus.CANCELLED).length,
        todayRemaining: todayAppointments.filter((a) => UPCOMING.includes(a.status) && a.startAt >= now)
          .length,
        weekAppointmentCount,
        followedPatientCount,
      },
      followUps,
      tasks,
    };
  }

  /**
   * Active patients with nothing booked and not seen for FOLLOW_UP_AFTER_DAYS (or never seen
   * although created that long ago), longest first.
   */
  private async followUps(patients: Prisma.PatientWhereInput, now: Date) {
    const threshold = new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * DAY);
    const rows = await this.prisma.patient.findMany({
      where: {
        ...patients,
        appointments: {
          none: {
            OR: [
              { startAt: { gte: now }, status: { in: UPCOMING } },
              { startAt: { gte: threshold, lt: now }, status: { in: TOOK_PLACE } },
            ],
          },
        },
        createdAt: { lt: threshold },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        appointments: {
          where: { startAt: { lt: now }, status: { in: TOOK_PLACE } },
          orderBy: { startAt: 'desc' },
          take: 1,
          select: { startAt: true },
        },
      },
      take: 50,
    });
    return rows
      .map(({ appointments, ...patient }) => {
        const lastSeenAt = appointments[0]?.startAt ?? null;
        return {
          patient,
          lastSeenAt,
          daysSince: lastSeenAt ? Math.floor((now.getTime() - lastSeenAt.getTime()) / DAY) : null,
        };
      })
      // Never seen first, then the longest without a visit
      .sort((a, b) => (b.daysSince ?? Number.MAX_SAFE_INTEGER) - (a.daysSince ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 10);
  }
}
