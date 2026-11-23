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
        select: { id: true, firstName: true, lastName: true, email: true, archivedAt: true },
        take: 5,
      }),
      this.prisma.appointment.findMany({
        where: {
          ...apptScope,
          OR: [
            { reason: { contains: q, mode: 'insensitive' } },
            { formula: { label: { contains: q, mode: 'insensitive' } } },
            { patient: { firstName: { contains: q, mode: 'insensitive' } } },
            { patient: { lastName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          formula: { select: { id: true, label: true } },
        },
        take: 5,
        orderBy: { startAt: 'desc' },
      }),
      // Session records: only the practitioner's own
      this.prisma.consultation.findMany({
        where: {
          practitionerId: user.id,
          OR: [
            { habits: { contains: q, mode: 'insensitive' } },
            { sessionWork: { contains: q, mode: 'insensitive' } },
            { advice: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          date: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ]);

    return { patients, appointments, consultations };
  }

}
