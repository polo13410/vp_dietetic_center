import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreateFormulaDto, UpdateFormulaDto } from './dto/formula.dto';

const SELECT = {
  id: true,
  label: true,
  priceCents: true,
  position: true,
  archivedAt: true,
} as const;

/** The practitioner's prices ("Bilan 60 €"). Sessions copy label and price when they use one. */
@Injectable()
export class FormulasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Offered formulas first, in her order, then the archived ones. */
  list(practitionerId: string) {
    return this.prisma.formula.findMany({
      where: { practitionerId },
      select: SELECT,
      orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(practitionerId: string, dto: CreateFormulaDto) {
    return this.prisma.formula.create({
      data: {
        practitionerId,
        label: dto.label,
        priceCents: dto.priceCents ?? null,
        position: await this.nextPosition(practitionerId),
      },
      select: SELECT,
    });
  }

  async update(practitionerId: string, id: string, dto: UpdateFormulaDto) {
    const formula = await this.findOwn(practitionerId, id);
    const { archived, ...fields } = dto;
    let archive = {};
    if (archived === true && !formula.archivedAt) archive = { archivedAt: new Date() };
    if (archived === false && formula.archivedAt) {
      // Offered again: it goes back at the end of the list
      archive = { archivedAt: null, position: await this.nextPosition(practitionerId) };
    }
    return this.prisma.formula.update({
      where: { id },
      data: { ...fields, ...archive },
      select: SELECT,
    });
  }

  /**
   * Deletes a formula no session uses. One that sessions use is archived instead: it is no
   * longer offered, and those sessions keep it.
   */
  async remove(practitionerId: string, id: string) {
    const formula = await this.findOwn(practitionerId, id);
    const used = await this.prisma.consultation.count({ where: { formulaId: id } });
    if (used > 0) {
      const archived = await this.prisma.formula.update({
        where: { id },
        data: { archivedAt: formula.archivedAt ?? new Date() },
        select: SELECT,
      });
      return { deleted: false, formula: archived };
    }
    await this.prisma.formula.delete({ where: { id } });
    return { deleted: true, formula: null };
  }

  /** Sets the order of the offered formulas; `ids` must list each of them once. */
  async reorder(practitionerId: string, ids: string[]) {
    const offered = await this.prisma.formula.findMany({
      where: { practitionerId, archivedAt: null },
      select: { id: true },
    });
    const known = new Set(offered.map((f) => f.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new BadRequestException('La liste des formules a changé. Rechargez la page.');
    }
    await this.prisma.$transaction(
      ids.map((id, position) => this.prisma.formula.update({ where: { id }, data: { position } })),
    );
    return this.list(practitionerId);
  }

  private async findOwn(practitionerId: string, id: string) {
    const formula = await this.prisma.formula.findUnique({ where: { id } });
    if (!formula || formula.practitionerId !== practitionerId) {
      throw new NotFoundException('Formule introuvable');
    }
    return formula;
  }

  private async nextPosition(practitionerId: string) {
    const last = await this.prisma.formula.findFirst({
      where: { practitionerId, archivedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }
}
