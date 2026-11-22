import { createHash } from 'crypto';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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

describe('AuthService change password', () => {
  let service: AuthService;
  let user: ReturnType<typeof createMockUser>;
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');

  beforeEach(async () => {
    vi.clearAllMocks();
    // Low cost: the real hashing, quickly
    user = createMockUser({ passwordHash: await bcrypt.hash('Ancien-mdp1', 4) });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue(user);
    service = new AuthService(mockPrisma as any, {} as any, {} as any, { get: vi.fn() } as any, {} as any);
  });

  it('checks the current password, saves the new one and closes the other sessions', async () => {
    await service.changePassword(user.id, 'Ancien-mdp1', 'Nouveau-mdp2', 'this-session');
    const saved = mockPrisma.user.update.mock.calls[0][0];
    expect(saved.where).toEqual({ id: user.id });
    expect(await bcrypt.compare('Nouveau-mdp2', saved.data.passwordHash)).toBe(true);
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null, tokenHash: { not: sha('this-session') } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('closes every session when the current one is unknown', async () => {
    await service.changePassword(user.id, 'Ancien-mdp1', 'Nouveau-mdp2');
    expect(mockPrisma.refreshToken.updateMany.mock.calls[0][0].where).toEqual({
      userId: user.id,
      revokedAt: null,
    });
  });

  it('refuses a wrong current password with 400 (not 401, which would end the session)', async () => {
    await expect(service.changePassword(user.id, 'Mauvais1', 'Nouveau-mdp2')).rejects.toThrow(
      new BadRequestException('Le mot de passe actuel n’est pas le bon.'),
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a new password equal to the current one', async () => {
    await expect(service.changePassword(user.id, 'Ancien-mdp1', 'Ancien-mdp1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a Google-only account, which has no password', async () => {
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ ...user, passwordHash: null });
    await expect(service.changePassword(user.id, 'x', 'Nouveau-mdp2')).rejects.toThrow(/Google/);
  });

  it('refuses a password sign-in on a Google-only account', async () => {
    const google = new AuthService(
      mockPrisma as any,
      { findByEmail: vi.fn().mockResolvedValue({ ...user, passwordHash: null }) } as any,
      {} as any,
      { get: vi.fn() } as any,
      {} as any,
    );
    await expect(google.validateUser(user.email, '')).resolves.toBeNull();
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
