import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    auditLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(120), findMany: vi.fn().mockResolvedValue([]) },
  };
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService(prisma as any);
  });

  it('writes an entry', async () => {
    await service.log({ userId: 'u1', action: 'READ', entity: 'patient', patientId: 'p1', metadata: { route: '/x' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'u1', action: 'READ', entity: 'patient', patientId: 'p1', metadata: { route: '/x' } },
    });
  });

  it('lists the whole trail unfiltered, newest first, by page', async () => {
    const result = await service.findAll({ page: 2, limit: 50 });
    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.where).toEqual({});
    expect(args).toMatchObject({ orderBy: { createdAt: 'desc' }, skip: 50, take: 50 });
    expect(result.meta).toEqual({ total: 120, page: 2, limit: 50, totalPages: 3 });
  });

  it('filters by user, action, entity, patient and dates', async () => {
    await service.findAll({
      userId: 'u1',
      action: 'EXPORT',
      entity: 'document',
      patientId: 'p1',
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      action: 'EXPORT',
      entity: 'document',
      patientId: 'p1',
      createdAt: { gte: new Date('2026-11-01'), lte: new Date('2026-11-30') },
    });
  });

  it('filters on one date bound only', async () => {
    await service.findAll({ from: '2026-11-01' });
    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({ createdAt: { gte: new Date('2026-11-01') } });
    await service.findAll({ to: '2026-11-30' });
    expect(prisma.auditLog.findMany.mock.calls[1][0].where).toEqual({ createdAt: { lte: new Date('2026-11-30') } });
  });

  it("gives one patient's history", async () => {
    await service.forPatient('p1');
    expect(prisma.auditLog.findMany.mock.calls[0][0]).toMatchObject({ where: { patientId: 'p1' }, take: 100 });
  });
});
