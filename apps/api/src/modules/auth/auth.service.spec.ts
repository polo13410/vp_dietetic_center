import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configuration } from '../../config/configuration';
import { createMockUser, mockPrisma } from '../../test/setup';

import { ACCOUNT_DISABLED, AuthService, NOT_REGISTERED } from './auth.service';

const config = {
  get: vi.fn(
    (key: string, fallback?: string) =>
      ({ 'jwt.expiresIn': '15m', 'jwt.refreshExpiresIn': '10h', 'google.clientId': 'client-id' })[key] ??
      fallback,
  ),
};

function makeService(findByEmail = vi.fn()) {
  return new AuthService(
    mockPrisma as any,
    { findByEmail } as any,
    { sign: vi.fn(() => 'access-token') } as any,
    config as any,
  );
}

describe('AuthService sessions', () => {
  let service: AuthService;
  const user = { ...createMockUser(), isActive: true };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T08:00:00Z'));
    service = makeService();
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

describe('AuthService Google sign-in', () => {
  const googleUser = createMockUser({ email: 'valerie@gmail.com' });
  const findByEmail = vi.fn();
  let service: AuthService;
  let verifyIdToken: ReturnType<typeof vi.fn>;

  /** What Google's verification returns for an ID token. */
  const ticket = (payload: Record<string, unknown>) => ({
    getPayload: () => ({ sub: 'google-sub', email: 'valerie@gmail.com', email_verified: true, ...payload }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService(findByEmail);
    verifyIdToken = vi.fn().mockResolvedValue(ticket({}));
    (service as any).googleClient.verifyIdToken = verifyIdToken;
  });

  it('signs in a registered, active user and binds her Google account the first time', async () => {
    findByEmail.mockResolvedValue(googleUser);
    const result = await service.validateGoogleToken('id-token', '1.2.3.4', 'Safari');

    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'client-id' });
    expect(findByEmail).toHaveBeenCalledWith('valerie@gmail.com');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: googleUser.id },
      data: { googleId: 'google-sub', avatarUrl: null },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: googleUser.id },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: googleUser.id, ipAddress: '1.2.3.4', userAgent: 'Safari' }),
    });
    expect(result.user).toEqual({
      id: googleUser.id,
      email: 'valerie@gmail.com',
      firstName: googleUser.firstName,
      lastName: googleUser.lastName,
      role: googleUser.role,
    });
  });

  it('does not bind the Google account again', async () => {
    findByEmail.mockResolvedValue({ ...googleUser, googleId: 'google-sub' });
    await service.validateGoogleToken('id-token');
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({ lastLoginAt: expect.any(Date) });
  });

  it('refuses an address nobody registered, without creating an account', async () => {
    findByEmail.mockResolvedValue(null);
    await expect(service.validateGoogleToken('id-token')).rejects.toThrow(
      new UnauthorizedException(NOT_REGISTERED),
    );
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses a deactivated account', async () => {
    findByEmail.mockResolvedValue({ ...googleUser, isActive: false });
    await expect(service.validateGoogleToken('id-token')).rejects.toThrow(
      new UnauthorizedException(ACCOUNT_DISABLED),
    );
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses a Google account whose e-mail Google has not verified', async () => {
    verifyIdToken.mockResolvedValue(ticket({ email_verified: false }));
    findByEmail.mockResolvedValue(googleUser);
    await expect(service.validateGoogleToken('id-token')).rejects.toThrow(/vérifiée/);
    expect(findByEmail).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses a malformed or forged Google token with 401, not a server error', async () => {
    // The real Google client, which cannot verify this token
    const real = makeService(findByEmail);
    await expect(real.validateGoogleToken('not-a-token')).rejects.toThrow(UnauthorizedException);
    expect(findByEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService dev sign-in', () => {
  const findByEmail = vi.fn();
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = makeService(findByEmail);
  });

  it('signs in a registered, active user by e-mail', async () => {
    findByEmail.mockResolvedValue(createMockUser());
    const result = await service.devLogin(' Test@Test.com ');
    expect(findByEmail).toHaveBeenCalledWith('test@test.com');
    expect(result.accessToken).toBe('access-token');
  });

  it('has the same checks as Google: never an unknown or deactivated account', async () => {
    findByEmail.mockResolvedValue(null);
    await expect(service.devLogin('inconnue@test.com')).rejects.toThrow(NOT_REGISTERED);
    findByEmail.mockResolvedValue(createMockUser({ isActive: false }));
    await expect(service.devLogin('test@test.com')).rejects.toThrow(ACCOUNT_DISABLED);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
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
