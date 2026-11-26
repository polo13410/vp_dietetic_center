import { Injectable } from '@nestjs/common';
import { Theme } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { UpdateActivityDto, UpdateMeDto } from './dto/me.dto';

/** Who she is, printed on her invoices. Where she consults is in her practices. */
const ACTIVITY_FIELDS = [
  'practiceName',
  'siret',
  'adeliRpps',
  'vatMention',
  'invoiceFooter',
] as const;

/** The signed-in user's own profile, appearance and activity (settings page). */
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
        twoFactorEnabledAt: true,
        twoFactorRecoveryCodes: true,
        preferences: { select: { theme: true } },
      },
    });
    const { preferences, twoFactorRecoveryCodes, ...profile } = user;
    return {
      ...profile,
      theme: preferences?.theme ?? Theme.SYSTEM,
      recoveryCodesLeft: twoFactorRecoveryCodes.length,
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

  async getActivity(userId: string) {
    const activity = await this.prisma.practitionerProfile.findUnique({ where: { userId } });
    // Nothing filled in yet: every field is empty
    return Object.fromEntries(ACTIVITY_FIELDS.map((field) => [field, activity?.[field] ?? null])) as Record<
      (typeof ACTIVITY_FIELDS)[number],
      string | null
    >;
  }

  async updateActivity(userId: string, dto: UpdateActivityDto) {
    await this.prisma.practitionerProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return this.getActivity(userId);
  }
}
