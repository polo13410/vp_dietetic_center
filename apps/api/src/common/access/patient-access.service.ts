import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export type AccessUser = Pick<User, 'id' | 'role'>;

/**
 * - `record`: read the administrative patient record (identity, contact, tags, appointments
 *   history in the timeline) or reference the patient from a task.
 * - `full`: clinical data (notes, nutrition, documents, private note) and any modification.
 */
export type PatientAccessLevel = 'record' | 'full';

/**
 * Single source of truth for "who may touch which patient's data".
 * - ADMIN: nothing. Admins manage the app and its users, not patients (health data is
 *   need-to-know); clinical controllers also refuse them outright.
 * - PRATICIENNE: everything on their own patients.
 * - ASSISTANTE: read-only `record` access to all patients, never `full`; manages the
 *   appointments of every practitioner (scheduling only, not post-session notes).
 */
@Injectable()
export class PatientAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prisma filter restricting patients to those the user may access at `level`. */
  patientScope(user: AccessUser, level: PatientAccessLevel = 'full'): Prisma.PatientWhereInput {
    if (user.role === UserRole.PRATICIENNE) return { practitionerId: user.id };
    if (user.role === UserRole.ASSISTANTE && level === 'record') return {};
    return { id: { in: [] } };
  }

  /** Whether the user may access a patient owned by `practitionerId` at `level`. */
  canAccess(user: AccessUser, practitionerId: string, level: PatientAccessLevel = 'full'): boolean {
    if (user.role === UserRole.PRATICIENNE) return practitionerId === user.id;
    return user.role === UserRole.ASSISTANTE && level === 'record';
  }

  /** Throws ForbiddenException unless the user may access a patient owned by `practitionerId`. */
  assertOwner(user: AccessUser, practitionerId: string, level: PatientAccessLevel = 'full'): void {
    if (!this.canAccess(user, practitionerId, level)) {
      throw new ForbiddenException('Accès non autorisé à ce patient');
    }
  }

  /**
   * Ensures the patient exists, is not deleted, and is accessible by the user at `level`.
   * Returns the patient's practitioner.
   */
  async assertPatient(
    user: AccessUser,
    patientId: string,
    level: PatientAccessLevel = 'full',
  ): Promise<{ practitionerId: string }> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId, deletedAt: null },
      select: { practitionerId: true },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');
    this.assertOwner(user, patient.practitionerId, level);
    return patient;
  }

  /** Prisma filter restricting appointments to those the user may manage. */
  appointmentScope(user: AccessUser): Prisma.AppointmentWhereInput {
    if (user.role === UserRole.PRATICIENNE) return { practitionerId: user.id };
    if (user.role === UserRole.ASSISTANTE) return {};
    return { id: { in: [] } };
  }

  /** Whether the user may view and manage (schedule, edit, cancel) an appointment. */
  canManageAppointment(user: AccessUser, practitionerId: string): boolean {
    if (user.role === UserRole.PRATICIENNE) return practitionerId === user.id;
    return user.role === UserRole.ASSISTANTE;
  }

  assertCanManageAppointment(user: AccessUser, practitionerId: string): void {
    if (!this.canManageAppointment(user, practitionerId)) {
      throw new ForbiddenException('Accès non autorisé à ce rendez-vous');
    }
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
    this.assertCanManageAppointment(user, appt.practitionerId);
    if (patientId && appt.patientId !== patientId) {
      throw new ForbiddenException("Ce rendez-vous n'appartient pas à ce patient");
    }
  }
}
