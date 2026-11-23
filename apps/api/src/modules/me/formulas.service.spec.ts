import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../test/setup';

import { DEFAULT_FORMULAS, ensureDefaultFormulas } from './default-formulas';
import { FormulasService } from './formulas.service';

const mine = { id: 'f1', practitionerId: 'user-1', label: 'Bilan', priceCents: 6000, position: 0, archivedAt: null };

describe('FormulasService', () => {
  let service: FormulasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FormulasService(mockPrisma as any);
    mockPrisma.formula.findUnique.mockResolvedValue(mine);
    mockPrisma.formula.update.mockImplementation(({ data }: any) => Promise.resolve({ ...mine, ...data }));
  });

  it('lists only her formulas, offered ones first, in her order', async () => {
    mockPrisma.formula.findMany.mockResolvedValue([mine]);
    await service.list('user-1');
    expect(mockPrisma.formula.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { practitionerId: 'user-1' },
        orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { position: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  });

  it('adds a formula at the end of the offered ones, price optional', async () => {
    mockPrisma.formula.findFirst.mockResolvedValue({ position: 1 });
    await service.create('user-1', { label: 'Séance de groupe' });
    expect(mockPrisma.formula.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { practitionerId: 'user-1', label: 'Séance de groupe', priceCents: null, position: 2 },
      }),
    );
  });

  it('starts at position 0 when there is no formula yet', async () => {
    mockPrisma.formula.findFirst.mockResolvedValue(null);
    await service.create('user-1', { label: 'Bilan', priceCents: 6000 });
    expect(mockPrisma.formula.create.mock.calls[0][0].data.position).toBe(0);
  });

  it('changes the label and price', async () => {
    await service.update('user-1', 'f1', { label: 'Bilan complet', priceCents: 6500 });
    expect(mockPrisma.formula.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1' }, data: { label: 'Bilan complet', priceCents: 6500 } }),
    );
  });

  it('offers an archived formula again, at the end of the list', async () => {
    mockPrisma.formula.findUnique.mockResolvedValue({ ...mine, archivedAt: new Date() });
    mockPrisma.formula.findFirst.mockResolvedValue({ position: 3 });
    await service.update('user-1', 'f1', { archived: false });
    expect(mockPrisma.formula.update.mock.calls[0][0].data).toEqual({ archivedAt: null, position: 4 });
  });

  it('archives on request', async () => {
    await service.update('user-1', 'f1', { archived: true });
    expect(mockPrisma.formula.update.mock.calls[0][0].data.archivedAt).toBeInstanceOf(Date);
  });

  it('refuses another practitioner’s formula', async () => {
    mockPrisma.formula.findUnique.mockResolvedValue({ ...mine, practitionerId: 'someone-else' });
    await expect(service.update('user-1', 'f1', { label: 'X' })).rejects.toThrow(NotFoundException);
    await expect(service.remove('user-1', 'f1')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.formula.update).not.toHaveBeenCalled();
    expect(mockPrisma.formula.delete).not.toHaveBeenCalled();
  });

  it('deletes a formula no session or appointment uses', async () => {
    mockPrisma.consultation.count.mockResolvedValue(0);
    mockPrisma.appointment.count.mockResolvedValue(0);
    await expect(service.remove('user-1', 'f1')).resolves.toEqual({ deleted: true, formula: null });
    expect(mockPrisma.formula.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
  });

  it('archives instead of deleting a formula that sessions use', async () => {
    mockPrisma.consultation.count.mockResolvedValue(3);
    mockPrisma.appointment.count.mockResolvedValue(0);
    const result = await service.remove('user-1', 'f1');
    expect(mockPrisma.consultation.count).toHaveBeenCalledWith({ where: { formulaId: 'f1' } });
    expect(mockPrisma.formula.delete).not.toHaveBeenCalled();
    expect(result.deleted).toBe(false);
    expect(result.formula?.archivedAt).toBeInstanceOf(Date);
  });

  it('archives instead of deleting a formula an appointment is booked with', async () => {
    mockPrisma.consultation.count.mockResolvedValue(0);
    mockPrisma.appointment.count.mockResolvedValue(1);
    const result = await service.remove('user-1', 'f1');
    expect(mockPrisma.appointment.count).toHaveBeenCalledWith({ where: { formulaId: 'f1' } });
    expect(mockPrisma.formula.delete).not.toHaveBeenCalled();
    expect(result.deleted).toBe(false);
  });

  it('reorders the offered formulas', async () => {
    mockPrisma.formula.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await service.reorder('user-1', ['b', 'a']);
    expect(mockPrisma.formula.update).toHaveBeenNthCalledWith(1, { where: { id: 'b' }, data: { position: 0 } });
    expect(mockPrisma.formula.update).toHaveBeenNthCalledWith(2, { where: { id: 'a' }, data: { position: 1 } });
  });

  it('refuses an order that leaves out or adds a formula', async () => {
    mockPrisma.formula.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await expect(service.reorder('user-1', ['a'])).rejects.toThrow(BadRequestException);
    await expect(service.reorder('user-1', ['a', 'someone-elses'])).rejects.toThrow(BadRequestException);
    expect(mockPrisma.formula.update).not.toHaveBeenCalled();
  });
});

describe('ensureDefaultFormulas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gives a new practitioner « Bilan » (1 h) and « Suivi » (45 min) without a price', async () => {
    mockPrisma.formula.count.mockResolvedValue(0);
    await ensureDefaultFormulas(mockPrisma as any, 'user-1');
    expect(DEFAULT_FORMULAS.map((f) => f.label)).toEqual(['Bilan', 'Suivi']);
    expect(mockPrisma.formula.createMany).toHaveBeenCalledWith({
      data: [
        { practitionerId: 'user-1', label: 'Bilan', durationMinutes: 60, position: 0 },
        { practitionerId: 'user-1', label: 'Suivi', durationMinutes: 45, position: 1 },
      ],
    });
  });

  it('leaves the formulas of a practitioner who has some', async () => {
    mockPrisma.formula.count.mockResolvedValue(2);
    await ensureDefaultFormulas(mockPrisma as any, 'user-1');
    expect(mockPrisma.formula.createMany).not.toHaveBeenCalled();
  });
});
