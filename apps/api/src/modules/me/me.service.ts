import { Injectable } from '@nestjs/common';
import { Theme } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { UpdateMeDto, UpdatePracticeDto } from './dto/me.dto';

const PRACTICE_FIELDS = [
  'practiceName',
  'address',
  'zipCode',
  'city',
  'siret',
  'adeliRpps',
  'vatMention',
  'invoiceFooter',
] as const;

/** The signed-in user's own profile, appearance and practice (settings page). */
@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        preferences: { select: { theme: true } },
      },
    });
    const { preferences, ...profile } = user;
    return {
      ...profile,
      theme: preferences?.theme ?? Theme.SYSTEM,
    };
  }

  async updateProfile(userId: string, dto: UpdateMeDto) {
    const { theme, ...fields } = dto;
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(fields).length > 0) {
        await tx.user.update({ where: { id: userId }, data: fields });
      }
      if (theme) {
        await tx.userPreferences.upsert({
          where: { userId },
          create: { userId, theme },
          update: { theme },
        });
      }
    });
    return this.getProfile(userId);
  }

  async getPractice(userId: string) {
    const practice = await this.prisma.practitionerProfile.findUnique({ where: { userId } });
    // Nothing filled in yet: every field is empty
    return Object.fromEntries(PRACTICE_FIELDS.map((field) => [field, practice?.[field] ?? null])) as Record<
      (typeof PRACTICE_FIELDS)[number],
      string | null
    >;
  }

  async updatePractice(userId: string, dto: UpdatePracticeDto) {
    await this.prisma.practitionerProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return this.getPractice(userId);
  }
}
