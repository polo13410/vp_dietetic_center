import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export type AccessUser = Pick<User, 'id' | 'role'>;

/**
 * Single source of truth for "who may touch which patient's data".
 * Rule today: ADMIN sees everything, everyone else only their own patients.
 */
@Injectable()
export class PatientAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prisma filter restricting patients to those the user may access. */
  patientScope(user: AccessUser): Prisma.PatientWhereInput {
    return user.role === UserRole.ADMIN ? {} : { practitionerId: user.id };
  }

  /** Throws ForbiddenException if the user may not access a patient owned by `practitionerId`. */
  assertOwner(user: AccessUser, practitionerId: string): void {
    if (user.role === UserRole.ADMIN) return;
    if (practitionerId !== user.id) {
      throw new ForbiddenException('Accès non autorisé à ce patient');
    }
  }

  /** Ensures the patient exists, is not deleted, and is accessible by the user. */
  async assertPatient(user: AccessUser, patientId: string): Promise<void> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId, deletedAt: null },
      select: { practitionerId: true },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');
    this.assertOwner(user, patient.practitionerId);
  }

  /**
   * Ensures the appointment is accessible by the user and, when `patientId` is given,
   * belongs to that patient.
   */
  async assertAppointment(
    user: AccessUser,
    appointmentId: string,
    patientId?: string,
  ): Promise<void> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { practitionerId: true, patientId: true },
    });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    this.assertOwner(user, appt.practitionerId);
    if (patientId && appt.patientId !== patientId) {
      throw new ForbiddenException("Ce rendez-vous n'appartient pas à ce patient");
    }
  }
}
