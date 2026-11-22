import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { estimatedBirthDate } from '../patient-file/calculations';
import { PatientFileService } from '../patient-file/patient-file.service';

import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

const PATIENT_SELECT = {
  id: true,
  practitionerId: true,
  firstName: true,
  lastName: true,
  sex: true,
  dateOfBirth: true,
  birthDateEstimated: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  zipCode: true,
  familySituation: true,
  profession: true,
  gpName: true,
  consultationReason: true,
  referralSource: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PatientSelect;

/** Profile fields that are health data, hidden from record-only access. */
const CLINICAL_FIELDS = ['consultationReason', 'bmi'] as const;

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
    private readonly file: PatientFileService,
    private readonly audit: AuditService,
  ) {}

  async findAll(user: User, query: PatientQueryDto) {
    const { page = 1, limit = 20, search, archived = false } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {
      deletedAt: null,
      archivedAt: archived ? { not: null } : null,
      ...this.access.patientScope(user, 'record'),
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
          // Last appointment that took place (not a future or cancelled one)
          appointments: {
            where: { startAt: { lte: new Date() }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
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

    const bmi = await this.file.bmiFor(
      data.filter((p) => this.access.canAccess(user, p.practitionerId, 'full')).map((p) => p.id),
    );

    return {
      data: data.map(({ appointments, ...p }) =>
        this.redact(
          { ...p, lastAppointmentAt: appointments[0]?.startAt ?? null, bmi: bmi.get(p.id) ?? null },
          user,
        ),
      ),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user: User) {
    const patient = await this.prisma.patient.findUnique({
      where: { id, deletedAt: null },
      select: {
        ...PATIENT_SELECT,
        consents: { orderBy: { givenAt: 'desc' } },
        _count: {
          select: {
            appointments: true,
            consultations: true,
            documents: true,
            tasks: true,
          },
        },
      },
    });

    if (!patient) throw new NotFoundException('Patient introuvable');
    this.access.assertOwner(user, patient.practitionerId, 'record');

    const bmi = this.access.canAccess(user, patient.practitionerId, 'full')
      ? ((await this.file.bmiFor([patient.id])).get(patient.id) ?? null)
      : null;

    return this.redact({ ...patient, bmi }, user);
  }

  async create(dto: CreatePatientDto, user: User) {
    const { age, dateOfBirth, ...data } = dto;
    return this.prisma.patient.create({
      data: { ...data, ...birthDate(dateOfBirth, age), practitionerId: user.id },
      select: PATIENT_SELECT,
    });
  }

  async update(id: string, dto: UpdatePatientDto, user: User) {
    const patient = await this.findOneRaw(id);
    this.access.assertOwner(user, patient.practitionerId);

    const { age, dateOfBirth, ...data } = dto;
    return this.prisma.patient.update({
      where: { id },
      data: { ...data, ...birthDate(dateOfBirth, age) },
      select: PATIENT_SELECT,
    });
  }

  /** Archived patients leave the lists and the dashboard; their file stays as it is. */
  async setArchived(id: string, archived: boolean, user: User) {
    const patient = await this.findOneRaw(id);
    this.access.assertOwner(user, patient.practitionerId);
    return this.prisma.patient.update({
      where: { id },
      data: { archivedAt: archived ? (patient.archivedAt ?? new Date()) : null },
      select: PATIENT_SELECT,
    });
  }

  async remove(id: string, user: User) {
    const patient = await this.findOneRaw(id);
    this.access.assertOwner(user, patient.practitionerId);

    return this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** The audit trail of one patient's file, for their practitioner. */
  async accessLog(id: string, user: AccessUser) {
    await this.access.assertPatient(user, id);
    return this.audit.forPatient(id);
  }

  private async findOneRaw(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');
    return patient;
  }

  /** Drops clinical fields for users with record-only access (assistants). */
  private redact<T extends { practitionerId: string }>(patient: T, user: AccessUser) {
    if (this.access.canAccess(user, patient.practitionerId, 'full')) return patient;
    const record: Record<string, unknown> = { ...patient };
    for (const field of CLINICAL_FIELDS) delete record[field];
    return record as Omit<T, (typeof CLINICAL_FIELDS)[number]>;
  }
}

/**
 * The birth date to store: the given date, or an estimated one from a declared age
 * (docs/REFONTE.md § 3.1). Nothing when neither is given; null clears it.
 */
export function birthDate(dateOfBirth?: string | null, age?: number | null) {
  const hasAge = age !== undefined && age !== null;
  if (hasAge && dateOfBirth) {
    throw new BadRequestException("Indiquez la date de naissance ou l'âge, pas les deux");
  }
  if (hasAge) return { dateOfBirth: estimatedBirthDate(age), birthDateEstimated: true };
  if (dateOfBirth === null) return { dateOfBirth: null, birthDateEstimated: false };
  if (dateOfBirth) return { dateOfBirth: new Date(dateOfBirth), birthDateEstimated: false };
  return {};
}
