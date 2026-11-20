import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, NotificationType, User } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly access: PatientAccessService,
  ) {}

  async findAll(user: User, query: AppointmentQueryDto) {
    const { page = 1, limit = 20, patientId, status, from, to } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...this.access.appointmentScope(user),
      ...(patientId ? { patientId } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            startAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          practitioner: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: data.map((appt) => this.redact(appt, user)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: User) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        practitioner: { select: { id: true, firstName: true, lastName: true } },
        consultation: { select: { id: true, status: true } },
      },
    });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.access.assertCanManageAppointment(user, appt.practitionerId);
    return this.redact(appt, user);
  }

  async create(dto: CreateAppointmentDto, user: User) {
    // The appointment belongs to the patient's practitioner, even when an assistant books it
    const { practitionerId } = await this.access.assertPatient(user, dto.patientId, 'record');
    const endAt = new Date(new Date(dto.startAt).getTime() + dto.duration * 60 * 1000);
    const appt = await this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        practitionerId,
        startAt: new Date(dto.startAt),
        endAt,
        duration: dto.duration,
        type: dto.type,
        reason: dto.reason,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.notifications.create(
      practitionerId,
      NotificationType.APPOINTMENT_CREATED,
      'Rendez-vous cree',
      `RDV avec ${appt.patient.lastName} ${appt.patient.firstName} le ${new Date(dto.startAt).toLocaleDateString('fr-FR')}`,
      'appointment',
      appt.id,
    ).catch(() => {});

    return appt;
  }

  async update(id: string, dto: UpdateAppointmentDto, user: User) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.access.assertCanManageAppointment(user, appt.practitionerId);
    // Moving the appointment to another patient also moves it to that patient's practitioner
    let practitionerId: string | undefined;
    if (dto.patientId && dto.patientId !== appt.patientId) {
      ({ practitionerId } = await this.access.assertPatient(user, dto.patientId, 'record'));
    }

    const endAt =
      dto.startAt && dto.duration
        ? new Date(new Date(dto.startAt).getTime() + dto.duration * 60 * 1000)
        : dto.startAt
          ? new Date(new Date(dto.startAt).getTime() + appt.duration * 60 * 1000)
          : undefined;

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...dto,
        ...(practitionerId ? { practitionerId } : {}),
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt,
      },
    });
  }

  async remove(id: string, user: User) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.access.assertCanManageAppointment(user, appt.practitionerId);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
    });
  }

  /** Drops the link to the session record for scheduling-only users (assistants). */
  private redact<T extends { practitionerId: string }>(appt: T, user: AccessUser) {
    if (this.access.canAccess(user, appt.practitionerId, 'full')) return appt;
    const visible: Record<string, unknown> = { ...appt };
    delete visible.consultation;
    return visible as Omit<T, 'consultation'>;
  }
}
