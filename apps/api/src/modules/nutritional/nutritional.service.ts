import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NutritionalService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(patientId: string) {
    return this.prisma.nutritionalProfile.upsert({
      where: { patientId },
      update: {},
      create: { patientId },
    });
  }

  async updateProfile(patientId: string, data: Record<string, unknown>) {
    return this.prisma.nutritionalProfile.upsert({
      where: { patientId },
      update: data,
      create: { patientId, ...data },
    });
  }

  async getEntries(patientId: string, from?: string, to?: string) {
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

  async createEntry(patientId: string, data: { date: string | Date } & Record<string, unknown>) {
    const entryDate = new Date(data.date);
    const payload = {
      ...data,
      date: entryDate,
    } as Omit<Prisma.NutritionalEntryUncheckedCreateInput, 'patientId'>;

    return this.prisma.nutritionalEntry.upsert({
      where: { patientId_date: { patientId, date: entryDate } },
      update: payload,
      create: { patientId, ...payload },
    });
  }
}
