import { Injectable } from '@nestjs/common';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateNutritionalEntryDto } from './dto/create-entry.dto';
import { UpdateNutritionalProfileDto } from './dto/update-profile.dto';

@Injectable()
export class NutritionalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PatientAccessService,
  ) {}

  async getProfile(patientId: string, user: AccessUser) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.nutritionalProfile.upsert({
      where: { patientId },
      update: {},
      create: { patientId },
    });
  }

  async updateProfile(patientId: string, dto: UpdateNutritionalProfileDto, user: AccessUser) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.nutritionalProfile.upsert({
      where: { patientId },
      update: dto,
      create: { patientId, ...dto },
    });
  }

  async getEntries(patientId: string, user: AccessUser, from?: string, to?: string) {
    await this.access.assertPatient(user, patientId);
    return this.prisma.nutritionalEntry.findMany({
      where: {
        patientId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async createEntry(
    patientId: string,
    data: Omit<CreateNutritionalEntryDto, 'patientId'>,
    user: AccessUser,
  ) {
    await this.access.assertPatient(user, patientId);
    const entryDate = new Date(data.date);
    const payload = { ...data, date: entryDate };

    return this.prisma.nutritionalEntry.upsert({
      where: { patientId_date: { patientId, date: entryDate } },
      update: payload,
      create: { patientId, ...payload },
    });
  }
}
