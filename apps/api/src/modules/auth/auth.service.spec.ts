import { createHash } from 'crypto';

import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configuration } from '../../config/configuration';
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

  it('refuses a refresh without a cookie', async () => {
    await expect(service.refreshTokens(undefined)).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.refreshToken.findUnique).not.toHaveBeenCalled();
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

describe('AuthService password reset', () => {
  const user = { ...createMockUser(), firstName: 'Test' };
  const mail = { sendPasswordReset: vi.fn().mockResolvedValue(undefined) };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockPrisma as any,
      { findByEmail: vi.fn().mockResolvedValue(user) } as any,
      {} as any,
      { get: vi.fn() } as any,
      mail as any,
    );
  });

  it('emails the token but stores only its hash', async () => {
    await service.requestPasswordReset(user.email);
    const sent = mail.sendPasswordReset.mock.calls[0][1] as string;
    const stored = mockPrisma.user.update.mock.calls[0][0].data.passwordResetToken;
    expect(stored).toBe(createHash('sha256').update(sent).digest('hex'));
    expect(stored).not.toBe(sent);
  });

  it('answers the same way when the email cannot be sent', async () => {
    mail.sendPasswordReset.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(service.requestPasswordReset(user.email)).resolves.toBeUndefined();
  });

  it('finds the user by the hash, and ends every open session', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
    });
    await service.resetPassword('raw-token', 'N0uveau-mot-de-passe!');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { passwordResetToken: createHash('sha256').update('raw-token').digest('hex') },
    });
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('configuration', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('refuses a missing or short JWT secret in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => configuration()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'too-short';
    expect(() => configuration()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'x'.repeat(64);
    expect(configuration().jwt.secret).toHaveLength(64);
  });
});

describe('AuthService Google sign-in', () => {
  it('refuses a malformed or forged Google token with 401, not a server error', async () => {
    const service = new AuthService(
      mockPrisma as any,
      { findByEmail: vi.fn() } as any,
      {} as any,
      { get: vi.fn(() => 'client-id') } as any,
      {} as any,
    );
    await expect(service.validateGoogleToken('not-a-token')).rejects.toThrow(UnauthorizedException);
  });
});
