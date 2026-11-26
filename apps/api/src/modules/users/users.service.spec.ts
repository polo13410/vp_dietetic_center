import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../test/setup';

import { UsersService } from './users.service';

describe('UsersService default formulas and practice', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(mockPrisma as any);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.formula.count.mockResolvedValue(0);
    mockPrisma.practice.count.mockResolvedValue(0);
  });

  const dto = { email: 'new@example.fr', firstName: 'Anne', lastName: 'Roy' };

  it('gives a new practitioner the formulas « Bilan » (1 h) and « Suivi » (45 min) without a price, and a practice', async () => {
    mockPrisma.user.create.mockResolvedValue({ id: 'u2', role: 'PRATICIENNE' });
    await service.create({ ...dto, role: 'PRATICIENNE' as any });
    expect(mockPrisma.formula.createMany).toHaveBeenCalledWith({
      data: [
        { practitionerId: 'u2', label: 'Bilan', durationMinutes: 60, position: 0 },
        { practitionerId: 'u2', label: 'Suivi', durationMinutes: 45, position: 1 },
      ],
    });
    expect(mockPrisma.practice.create).toHaveBeenCalledWith({
      data: { practitionerId: 'u2', name: 'Mon cabinet', isDefault: true },
    });
  });

  it('gives no formula to an assistant', async () => {
    mockPrisma.user.create.mockResolvedValue({ id: 'u3', role: 'ASSISTANTE' });
    await service.create(dto);
    expect(mockPrisma.formula.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.practice.create).not.toHaveBeenCalled();
  });

  it('gives them to an account that becomes a practitioner, only then', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u3', role: 'ASSISTANTE' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u3', role: 'PRATICIENNE' });
    await service.update('u3', { role: 'PRATICIENNE' as any });
    expect(mockPrisma.formula.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.practice.create).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u3', role: 'PRATICIENNE' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u3', role: 'PRATICIENNE' });
    await service.update('u3', { firstName: 'Anne' });
    expect(mockPrisma.formula.createMany).not.toHaveBeenCalled();
  });
});

describe('UsersService two-step verification reset', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(mockPrisma as any);
  });

  it('clears her app and recovery codes and ends her sessions', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    await service.resetTwoFactor('u2', 'admin');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { twoFactorSecret: null, twoFactorEnabledAt: null, twoFactorLastStep: null, twoFactorRecoveryCodes: [] },
    });
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u2', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('never resets one’s own, nor an unknown account', async () => {
    await expect(service.resetTwoFactor('admin', 'admin')).rejects.toThrow(/propre/);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.resetTwoFactor('u9', 'admin')).rejects.toThrow(/introuvable/);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
