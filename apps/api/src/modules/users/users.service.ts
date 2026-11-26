import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ensureDefaultFormulas } from '../me/default-formulas';
import { ensureDefaultPractice } from '../me/default-practice';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        twoFactorEnabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role ?? UserRole.ASSISTANTE,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
      // A new practitioner starts with « Bilan » and « Suivi », prices to fill in, and a practice
      if (user.role === UserRole.PRATICIENNE) {
        await ensureDefaultFormulas(tx, user.id);
        await ensureDefaultPractice(tx, user.id);
      }
      return user;
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: dto,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });
      // Becoming a practitioner: she gets the default formulas and practice if she has none
      if (user.role !== UserRole.PRATICIENNE && updated.role === UserRole.PRATICIENNE) {
        await ensureDefaultFormulas(tx, id);
        await ensureDefaultPractice(tx, id);
      }
      return updated;
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });
  }

  /**
   * Lost phone: she enrols a new app at her next sign-in. Her sessions end now, so nobody stays
   * signed in on the strength of the old app. Never for oneself (someone using an admin session
   * must not be able to drop its second step).
   */
  async resetTwoFactor(id: string, byUserId: string) {
    if (id === byUserId) {
      throw new BadRequestException('Vous ne pouvez pas réinitialiser votre propre double authentification.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorLastStep: null, twoFactorRecoveryCodes: [] },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { id };
  }
}
