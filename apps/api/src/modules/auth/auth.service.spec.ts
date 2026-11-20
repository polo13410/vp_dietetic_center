import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockPrisma } from '../../test/setup';

import { AuthService } from './auth.service';

describe('AuthService sessions', () => {
  let service: AuthService;
  const user = { ...createMockUser(), isActive: true };
  const config = {
    get: vi.fn((key: string, fallback?: string) =>
      ({ 'jwt.expiresIn': '15m', 'jwt.refreshExpiresIn': '10h' })[key] ?? fallback,
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T08:00:00Z'));
    service = new AuthService(
      mockPrisma as any,
      {} as any,
      { sign: vi.fn(() => 'access-token') } as any,
      config as any,
      {} as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a 10-hour session at sign-in', async () => {
    const result = await service.login(user as any);
    expect(result.refreshExpiresAt).toEqual(new Date('2026-11-20T18:00:00Z'));
    expect(result.expiresIn).toBe(15 * 60);
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: new Date('2026-11-20T18:00:00Z') }),
      }),
    );
  });

  it('keeps the original end of session when refreshing', async () => {
    const sessionEnd = new Date('2026-11-20T18:00:00Z');
    vi.setSystemTime(new Date('2026-11-20T15:00:00Z'));
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: user.id,
      expiresAt: sessionEnd,
      revokedAt: null,
    });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue(user);

    const result = await service.refreshTokens('raw-token');

    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt1' } }),
    );
    expect(result.refreshExpiresAt).toEqual(sessionEnd);
  });

  it('refuses an expired session', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: user.id,
      expiresAt: new Date('2026-11-20T07:59:59Z'),
      revokedAt: null,
    });
    await expect(service.refreshTokens('raw-token')).rejects.toThrow(UnauthorizedException);
  });
});
