import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreatePracticeDto, UpdatePracticeDto } from './dto/practice.dto';

type Tx = Prisma.TransactionClient;

export const PRACTICE_SELECT = {
  id: true,
  name: true,
  address: true,
  zipCode: true,
  city: true,
  phone: true,
  siret: true,
  isDefault: true,
  archivedAt: true,
} as const;

/**
 * Where the practitioner consults (« Mes cabinets », docs/REFONTE.md lot 15). The rule: she
 * always has at least one active practice, and exactly one of her active practices is the
 * default one (prefilled on appointments, used for sessions without an appointment). Every
 * change runs in a transaction holding her practices lock, so two changes at once cannot
 * leave her with two defaults or none.
 */
@Injectable()
export class PracticesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active ones first (the default one first), then the archived ones. */
  list(practitionerId: string) {
    return this.prisma.practice.findMany({
      where: { practitionerId },
      select: PRACTICE_SELECT,
      orderBy: [
        { archivedAt: { sort: 'asc', nulls: 'first' } },
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /** The first one she adds becomes her default one. */
  create(practitionerId: string, dto: CreatePracticeDto) {
    return this.locked(practitionerId, async (tx) => {
      const active = await tx.practice.count({ where: { practitionerId, archivedAt: null } });
      return tx.practice.create({
        data: { ...dto, practitionerId, isDefault: active === 0 },
        select: PRACTICE_SELECT,
      });
    });
  }

  /**
   * Edits a practice, makes it the default one (`isDefault: true`), archives it
   * (`archived: true`: never the last active one; a default one hands over to the oldest
   * remaining) or offers it again (`archived: false`, not as the default).
   */
  update(practitionerId: string, id: string, dto: UpdatePracticeDto) {
    return this.locked(practitionerId, async (tx) => {
      const practice = await this.findOwn(tx, practitionerId, id);
      const { isDefault, archived, ...fields } = dto;
      const archiving = archived === true && !practice.archivedAt;
      const restoring = archived === false && !!practice.archivedAt;
      const archivedAfter = archiving || (!!practice.archivedAt && !restoring);

      if (isDefault && archivedAfter) {
        throw new BadRequestException('Un cabinet archivé ne peut pas être celui par défaut. Proposez-le à nouveau d’abord.');
      }

      const data: Prisma.PracticeUpdateInput = { ...fields };
      if (archiving) {
        const others = await tx.practice.findMany({
          where: { practitionerId, archivedAt: null, id: { not: id } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (others.length === 0) {
          throw new BadRequestException('Gardez au moins un cabinet : ajoutez-en un autre avant d’archiver celui-ci.');
        }
        data.archivedAt = new Date();
        data.isDefault = false;
        if (practice.isDefault) {
          await tx.practice.update({ where: { id: others[0].id }, data: { isDefault: true } });
        }
      }
      if (restoring) {
        data.archivedAt = null;
        data.isDefault = false;
      }
      if (isDefault && !practice.isDefault) {
        await tx.practice.updateMany({
          where: { practitionerId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        data.isDefault = true;
      }
      return tx.practice.update({ where: { id }, data, select: PRACTICE_SELECT });
    });
  }

  /** Runs `fn` in a transaction holding the practitioner's practices lock. */
  private locked<T>(practitionerId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`practices:${practitionerId}`}))`;
      return fn(tx);
    });
  }

  private async findOwn(tx: Tx, practitionerId: string, id: string) {
    const practice = await tx.practice.findUnique({ where: { id } });
    if (!practice || practice.practitionerId !== practitionerId) {
      throw new NotFoundException('Cabinet introuvable');
    }
    return practice;
  }
}
