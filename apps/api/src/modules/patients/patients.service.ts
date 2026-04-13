import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientStatus, User, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

const PATIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  zipCode: true,
  status: true,
  privateNote: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelationship: true,
  referralSource: true,
  createdAt: true,
  updatedAt: true,
  tags: {
    select: {
      tag: { select: { id: true, name: true, color: true } },
    },
  },
};

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: User, query: PatientQueryDto) {
    const { page = 1, limit = 20, search, status, tagId } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(user.role !== UserRole.ADMIN ? { practitionerId: user.id } : {}),
      ...(status ? { status } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({
        where,
        select: {
          ...PATIENT_SELECT,
          appointments: {
            select: { startAt: true, status: true },
            orderBy: { startAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastName: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: data.map((p) => ({
        ...p,
        tags: p.tags.map((pt: any) => pt.tag),
        lastAppointmentAt: p.appointments[0]?.startAt ?? null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: User) {
    const patient = await this.prisma.patient.findUnique({
      where: { id, deletedAt: null },
      select: {
        ...PATIENT_SELECT,
        nutritionalProfile: true,
        consents: { orderBy: { givenAt: 'desc' } },
        _count: {
          select: {
            appointments: true,
            notes: true,
            documents: true,
            tasks: true,
          },
        },
      },
    });

    if (!patient) throw new NotFoundException('Patient introuvable');
    this.checkAccess(patient as any, user);

    return {
      ...patient,
      tags: patient.tags.map((pt: any) => pt.tag),
    };
  }

  async create(dto: CreatePatientDto, user: User) {
    const { tagIds, emergencyContact, ...data } = dto;

    return this.prisma.patient.create({
      data: {
        ...data,
        practitionerId: user.id,
        emergencyContactName: emergencyContact?.name,
        emergencyContactPhone: emergencyContact?.phone,
        emergencyContactRelationship: emergencyContact?.relationship,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        tags: tagIds?.length
          ? { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
          : undefined,
      },
      select: PATIENT_SELECT,
    });
  }

  async update(id: string, dto: UpdatePatientDto, user: User) {
    const patient = await this.findOneRaw(id);
    this.checkAccess(patient, user);

    const { tagIds, emergencyContact, ...data } = dto;

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...data,
        emergencyContactName: emergencyContact?.name,
        emergencyContactPhone: emergencyContact?.phone,
        emergencyContactRelationship: emergencyContact?.relationship,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        ...(tagIds !== undefined
          ? {
              tags: {
                deleteMany: {},
                create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
              },
            }
          : {}),
      },
      select: PATIENT_SELECT,
    });
  }

  async remove(id: string, user: User) {
    const patient = await this.findOneRaw(id);
    this.checkAccess(patient, user);

    return this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date(), status: PatientStatus.ARCHIVED },
    });
  }

  async findAllTags() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  async getTimeline(id: string, user: User) {
    const patient = await this.findOneRaw(id);
    this.checkAccess(patient, user);

    const [appointments, notes, tasks] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId: id },
        orderBy: { startAt: 'desc' },
        take: 50,
        select: { id: true, startAt: true, status: true, type: true, reason: true, duration: true },
      }),
      this.prisma.clinicalNote.findMany({
        where: { patientId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          createdAt: true,
          finalizedAt: true,
        },
      }),
      this.prisma.task.findMany({
        where: { patientId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueAt: true,
          completedAt: true,
        },
      }),
    ]);

    return { appointments, notes, tasks };
  }

  private async findOneRaw(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');
    return patient;
  }

  private checkAccess(patient: { practitionerId: string }, user: User) {
    if (user.role === UserRole.ADMIN) return;
    if (patient.practitionerId !== user.id) {
      throw new ForbiddenException('Accès non autorisé à ce patient');
    }
  }
}
