import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Appointment, AppointmentStatus, AppointmentType, Prisma, User, UserRole } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultPractice } from '../me/default-practice';

import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

/** What an appointment is shown with: who, its type and where. */
export const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true } },
  practitioner: { select: { id: true, firstName: true, lastName: true } },
  consultation: { select: { id: true } },
  formula: { select: { id: true, label: true } },
  practice: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude;

type Booking = Pick<Appointment, 'type' | 'formulaId' | 'practiceId' | 'duration'>;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
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
        include: APPOINTMENT_INCLUDE,
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
      include: APPOINTMENT_INCLUDE,
    });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.access.assertCanManageAppointment(user, appt.practitionerId);
    return this.redact(appt, user);
  }

  /**
   * What an appointment can be booked with: the offered formulas (types of appointment, with
   * their duration) and active practices of the patient's practitioner, or of the signed-in
   * practitioner when no patient is chosen yet.
   */
  async options(user: AccessUser, patientId?: string) {
    let practitionerId: string | null = null;
    if (patientId) ({ practitionerId } = await this.access.assertPatient(user, patientId, 'record'));
    else if (user.role === UserRole.PRATICIENNE) practitionerId = user.id;
    if (!practitionerId) return { formulas: [], practices: [] };

    const [formulas, practices] = await Promise.all([
      this.prisma.formula.findMany({
        where: { practitionerId, archivedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, label: true, priceCents: true, durationMinutes: true },
      }),
      this.prisma.practice.findMany({
        where: { practitionerId, archivedAt: null },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, address: true, zipCode: true, city: true, isDefault: true },
      }),
    ]);
    return { formulas, practices };
  }

  async create(dto: CreateAppointmentDto, user: User) {
    // The appointment belongs to the patient's practitioner, even when an assistant books it
    const { practitionerId } = await this.access.assertPatient(user, dto.patientId, 'record');
    const booking = await this.booking(practitionerId, dto);
    const startAt = new Date(dto.startAt);
    return this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        practitionerId,
        startAt,
        endAt: endOf(startAt, booking.duration),
        ...booking,
        reason: dto.reason ?? null,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateAppointmentDto, user: User) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.access.assertCanManageAppointment(user, appt.practitionerId);
    // Moving the appointment to another patient also moves it to that patient's practitioner
    let practitionerId = appt.practitionerId;
    if (dto.patientId && dto.patientId !== appt.patientId) {
      ({ practitionerId } = await this.access.assertPatient(user, dto.patientId, 'record'));
    }
    // Another practitioner: her types and practices, not the previous one's
    const current = practitionerId === appt.practitionerId ? appt : { ...appt, formulaId: null, practiceId: null };
    const booking = await this.booking(practitionerId, dto, current);
    const startAt = dto.startAt ? new Date(dto.startAt) : appt.startAt;

    const { formulaId: _f, practiceId: _p, duration: _d, type: _t, startAt: _s, ...rest } = dto;
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...rest,
        ...booking,
        practitionerId,
        startAt,
        endAt: endOf(startAt, booking.duration),
      },
      include: APPOINTMENT_INCLUDE,
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

  /**
   * Type, duration and place of an appointment, from what was sent and what it was (`current`):
   * - the type is one of her formulas; choosing one gives its duration unless one is sent;
   * - in person, it takes place in one of her active practices, her default one unless said
   *   otherwise; by video or phone, in none.
   * A formula or practice she no longer offers is refused, unless the appointment already had it.
   */
  private async booking(
    practitionerId: string,
    dto: Partial<Booking> & { duration?: number },
    current?: Booking,
  ): Promise<Booking> {
    const type = dto.type ?? current?.type ?? AppointmentType.IN_PERSON;

    let formulaId = current?.formulaId ?? null;
    let duration = dto.duration ?? current?.duration;
    if (dto.formulaId !== undefined && dto.formulaId !== formulaId) {
      formulaId = dto.formulaId;
      if (formulaId) {
        const formula = await this.prisma.formula.findUnique({ where: { id: formulaId } });
        if (!formula || formula.practitionerId !== practitionerId) {
          throw new BadRequestException('Type de rendez-vous introuvable');
        }
        if (formula.archivedAt) throw new BadRequestException("Ce type de rendez-vous n'est plus proposé");
        duration = dto.duration ?? formula.durationMinutes;
      }
    }
    if (!duration) throw new BadRequestException('Indiquez la durée en minutes.');

    let practiceId: string | null = null;
    if (type === AppointmentType.IN_PERSON) {
      const asked = dto.practiceId === undefined ? (current?.practiceId ?? null) : dto.practiceId;
      if (asked && asked !== current?.practiceId) {
        const practice = await this.prisma.practice.findUnique({ where: { id: asked } });
        if (!practice || practice.practitionerId !== practitionerId) {
          throw new BadRequestException('Cabinet introuvable');
        }
        if (practice.archivedAt) throw new BadRequestException("Ce cabinet n'est plus proposé");
      }
      practiceId = asked ?? (await defaultPractice(this.prisma, practitionerId))?.id ?? null;
    }
    return { type, formulaId, practiceId, duration };
  }

  /** Drops the link to the session record for scheduling-only users (assistants). */
  private redact<T extends { practitionerId: string }>(appt: T, user: AccessUser) {
    if (this.access.canAccess(user, appt.practitionerId, 'full')) return appt;
    const visible: Record<string, unknown> = { ...appt };
    delete visible.consultation;
    return visible as Omit<T, 'consultation'>;
  }
}

const endOf = (startAt: Date, minutes: number) => new Date(startAt.getTime() + minutes * 60 * 1000);
