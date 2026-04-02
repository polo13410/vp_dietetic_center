import { Injectable } from '@nestjs/common';

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

  async createEntry(patientId: string, data: Record<string, unknown>) {
    return this.prisma.nutritionalEntry.upsert({
      where: { patientId_date: { patientId, date: new Date(data.date as string) } },
      update: data,
      create: { patientId, ...data },
    });
  }
}
