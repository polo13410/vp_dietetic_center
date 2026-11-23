import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureDefaultPractice } from './default-practice';
import { PracticesService } from './practices.service';

interface Row {
  id: string;
  practitionerId: string;
  name: string;
  isDefault: boolean;
  archivedAt: Date | null;
  createdAt: Date;
}

/**
 * A practice table in memory: just enough of Prisma for the service, so the rule « at least
 * one active practice, exactly one default among them » is checked on the rows themselves.
 */
function fakePrisma() {
  let rows: Row[] = [];
  let next = 1;
  const matches = (row: Row, where: any = {}) =>
    Object.entries(where).every(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && 'not' in value) return (row as any)[key] !== value.not;
      return (row as any)[key] === value;
    });
  const practice = {
    count: vi.fn(async ({ where }: any) => rows.filter((r) => matches(r, where)).length),
    findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
    findMany: vi.fn(async ({ where }: any) =>
      rows.filter((r) => matches(r, where)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    ),
    create: vi.fn(async ({ data }: any) => {
      const row: Row = {
        id: `pr-${next}`,
        isDefault: false,
        archivedAt: null,
        createdAt: new Date(Date.UTC(2026, 0, next)),
        ...data,
      };
      next += 1;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const found = rows.filter((r) => matches(r, where));
      found.forEach((r) => Object.assign(r, data));
      return { count: found.length };
    }),
  };
  const prisma: any = {
    practice,
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return {
    prisma,
    rows: (practitionerId = 'user-1') => rows.filter((r) => r.practitionerId === practitionerId),
    reset: () => {
      rows = [];
      next = 1;
    },
  };
}

describe('PracticesService: at least one active practice, exactly one default', () => {
  const db = fakePrisma();
  let service: PracticesService;

  beforeEach(() => {
    db.reset();
    vi.clearAllMocks();
    service = new PracticesService(db.prisma);
  });

  /** The rule, checked after every change */
  const expectOneDefault = () => {
    const active = db.rows().filter((r) => !r.archivedAt);
    expect(active.length).toBeGreaterThan(0);
    expect(active.filter((r) => r.isDefault)).toHaveLength(1);
    expect(db.rows().filter((r) => r.archivedAt && r.isDefault)).toHaveLength(0);
  };

  it('makes the first practice the default one, not the next ones', async () => {
    const aix = await service.create('user-1', { name: 'Aix' });
    const marseille = await service.create('user-1', { name: 'Marseille' });
    expect(aix.isDefault).toBe(true);
    expect(marseille.isDefault).toBe(false);
    expectOneDefault();
  });

  it('choosing another default one takes it from the previous one', async () => {
    await service.create('user-1', { name: 'Aix' });
    const marseille = await service.create('user-1', { name: 'Marseille' });
    await service.update('user-1', marseille.id, { isDefault: true });
    expect(db.rows().map((r) => [r.name, r.isDefault])).toEqual([
      ['Aix', false],
      ['Marseille', true],
    ]);
    expectOneDefault();
  });

  it('archiving the default one hands it over to the oldest remaining active one', async () => {
    const aix = await service.create('user-1', { name: 'Aix' });
    await service.create('user-1', { name: 'Marseille' });
    await service.create('user-1', { name: 'Salon' });
    const archived = await service.update('user-1', aix.id, { archived: true });
    expect(archived).toMatchObject({ isDefault: false, archivedAt: expect.any(Date) });
    expect(db.rows().find((r) => r.isDefault)?.name).toBe('Marseille');
    expectOneDefault();
  });

  it('never archives her last active practice', async () => {
    const aix = await service.create('user-1', { name: 'Aix' });
    const marseille = await service.create('user-1', { name: 'Marseille' });
    await service.update('user-1', marseille.id, { archived: true });
    await expect(service.update('user-1', aix.id, { archived: true })).rejects.toThrow(
      'Gardez au moins un cabinet',
    );
    expectOneDefault();
  });

  it('offers an archived practice again, not as the default one', async () => {
    await service.create('user-1', { name: 'Aix' });
    const marseille = await service.create('user-1', { name: 'Marseille' });
    await service.update('user-1', marseille.id, { archived: true });
    const back = await service.update('user-1', marseille.id, { archived: false });
    expect(back).toMatchObject({ archivedAt: null, isDefault: false });
    expectOneDefault();
  });

  it('refuses to make an archived practice the default one', async () => {
    await service.create('user-1', { name: 'Aix' });
    const marseille = await service.create('user-1', { name: 'Marseille' });
    await service.update('user-1', marseille.id, { archived: true });
    await expect(service.update('user-1', marseille.id, { isDefault: true })).rejects.toThrow(BadRequestException);
    // Offered again and chosen in the same change is fine
    await service.update('user-1', marseille.id, { archived: false, isDefault: true });
    expect(db.rows().find((r) => r.isDefault)?.name).toBe('Marseille');
    expectOneDefault();
  });

  it('refuses to archive and choose as default in one change', async () => {
    await service.create('user-1', { name: 'Aix' });
    const marseille = await service.create('user-1', { name: 'Marseille' });
    await expect(
      service.update('user-1', marseille.id, { archived: true, isDefault: true }),
    ).rejects.toThrow(BadRequestException);
    expectOneDefault();
  });

  it('edits the details, keeping the default as it is', async () => {
    const aix = await service.create('user-1', { name: 'Aix' });
    await service.update('user-1', aix.id, { name: 'Cabinet d’Aix', city: 'Aix-en-Provence', isDefault: true });
    expect(db.rows()[0]).toMatchObject({ name: 'Cabinet d’Aix', city: 'Aix-en-Provence', isDefault: true });
    expectOneDefault();
  });

  it("does not touch another practitioner's practices", async () => {
    await service.create('user-1', { name: 'Aix' });
    const other = await service.create('user-2', { name: 'Lyon' });
    expect(other.isDefault).toBe(true);
    await expect(service.update('user-1', other.id, { name: 'Pris' })).rejects.toThrow(NotFoundException);
    expectOneDefault();
  });

  it('runs every change under her practices lock', async () => {
    await service.create('user-1', { name: 'Aix' });
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('gives a new practitioner her first practice, once', async () => {
    await ensureDefaultPractice(db.prisma, 'user-1');
    await ensureDefaultPractice(db.prisma, 'user-1');
    expect(db.rows()).toEqual([expect.objectContaining({ name: 'Mon cabinet', isDefault: true })]);
  });
});
