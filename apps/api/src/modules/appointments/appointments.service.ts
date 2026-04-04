import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, NotificationType, User, UserRole } from '@prisma/client';

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
  ) {}

  async findAll(user: User, query: AppointmentQueryDto) {
    const { page = 1, limit = 20, patientId, status, from, to } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {}),
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
        },
        orderBy: { startAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, user: User) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        notes: { select: { id: true, title: true, status: true, type: true } },
      },
    });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.checkAccess(appt, user);
    return appt;
  }

  async create(dto: CreateAppointmentDto, user: User) {
    const endAt = new Date(new Date(dto.startAt).getTime() + dto.duration * 60 * 1000);
    const appt = await this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        practitionerId: user.id,
        startAt: new Date(dto.startAt),
        endAt,
        duration: dto.duration,
        type: dto.type,
        reason: dto.reason,
        preNotes: dto.preNotes,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.notifications.create(
      user.id,
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
    this.checkAccess(appt, user);

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
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt,
      },
    });
  }

  async remove(id: string, user: User) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.checkAccess(appt, user);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
    });
  }

  private checkAccess(appt: { practitionerId: string }, user: User) {
    if (user.role === UserRole.ADMIN) return;
    if (appt.practitionerId !== user.id) throw new ForbiddenException();
  }
}
