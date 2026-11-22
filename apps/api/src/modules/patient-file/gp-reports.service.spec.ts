import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { GpReportsService } from './gp-reports.service';

describe('GpReportsService', () => {
  let service: GpReportsService;
  const user = createMockUser();
  const report = { id: 'r1', patientId: 'p1', status: 'DRAFT', sentAt: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date('2026-11-22T12:00:00Z') });
    service = new GpReportsService(mockPrisma as any, mockAccess as any);
  });

  afterEach(() => vi.useRealTimers());

  it("lists the patient's reports, latest first", async () => {
    mockPrisma.gpReport.findMany.mockResolvedValue([report]);
    await expect(service.list(user as any, 'p1')).resolves.toEqual([report]);
    expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
    expect(mockPrisma.gpReport.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1' });
  });

  it('creates a draft dated today, written by the user', async () => {
    await service.create(user as any, 'p1', { content: 'Cher confrère,' });
    expect(mockPrisma.gpReport.create).toHaveBeenCalledWith({
      data: { patientId: 'p1', authorId: 'user-1', date: new Date('2026-11-22'), content: 'Cher confrère,' },
    });
  });

  it('records the sending date once, and clears it back to draft', async () => {
    mockPrisma.gpReport.findUnique.mockResolvedValue(report);
    await service.update(user as any, 'p1', 'r1', { status: 'SENT' });
    expect(mockPrisma.gpReport.update.mock.calls[0][0].data).toMatchObject({
      status: 'SENT',
      sentAt: new Date('2026-11-22T12:00:00Z'),
    });

    const sentAt = new Date('2026-11-01');
    mockPrisma.gpReport.findUnique.mockResolvedValue({ ...report, status: 'SENT', sentAt });
    await service.update(user as any, 'p1', 'r1', { status: 'SENT', content: 'Corrigé' });
    expect(mockPrisma.gpReport.update.mock.calls[1][0].data).toMatchObject({ content: 'Corrigé', sentAt });

    await service.update(user as any, 'p1', 'r1', { status: 'DRAFT', date: '2026-11-20' });
    expect(mockPrisma.gpReport.update.mock.calls[2][0].data).toMatchObject({
      status: 'DRAFT',
      sentAt: null,
      date: new Date('2026-11-20'),
    });
  });

  it('reads and deletes a report', async () => {
    mockPrisma.gpReport.findUnique.mockResolvedValue(report);
    await expect(service.findOne(user as any, 'p1', 'r1')).resolves.toBe(report);
    await service.remove(user as any, 'p1', 'r1');
    expect(mockPrisma.gpReport.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it("hides another patient's report", async () => {
    mockPrisma.gpReport.findUnique.mockResolvedValue({ ...report, patientId: 'p2' });
    await expect(service.findOne(user as any, 'p1', 'r1')).rejects.toThrow(NotFoundException);
    await expect(service.remove(user as any, 'p1', 'r1')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.gpReport.delete).not.toHaveBeenCalled();
  });
});
