import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configuration } from '../../config/configuration';
import { createMockUser, mockPrisma } from '../../test/setup';

import { ACCOUNT_DISABLED, AuthService, CHALLENGE_EXPIRED, NOT_REGISTERED, WRONG_CODE } from './auth.service';
import { codeAt, hashRecoveryCode, stepAt } from './two-factor/totp';

const settings: Record<string, string> = {
  'jwt.secret': 'test-jwt-secret',
  'jwt.expiresIn': '15m',
  'jwt.refreshExpiresIn': '10h',
  'google.clientId': 'client-id',
};
const config = {
  get: vi.fn((key: string, fallback?: string) => settings[key] ?? fallback),
  getOrThrow: vi.fn((key: string) => settings[key]),
};

// Access tokens are a fixed value; two-factor challenges are real JWTs (signed with their own key)
const realJwt = new JwtService({});
const jwt = {
  sign: vi.fn((payload: object, options?: object) => (options ? realJwt.sign(payload, options) : 'access-token')),
  verifyAsync: vi.fn((token: string, options: object) => realJwt.verifyAsync(token, options)),
};

function makeService(findByEmail = vi.fn()) {
  return new AuthService(mockPrisma as any, { findByEmail } as any, jwt as any, config as any);
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

  it('binds her Google account the first time and asks her to set up her app, without a session', async () => {
    findByEmail.mockResolvedValue(googleUser);
    const result = await service.validateGoogleToken('id-token');

    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'client-id' });
    expect(findByEmail).toHaveBeenCalledWith('valerie@gmail.com');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: googleUser.id },
      data: { googleId: 'google-sub', avatarUrl: null },
    });
    const secret = mockPrisma.user.update.mock.calls[1][0].data.twoFactorSecret;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(result).toEqual({
      twoFactor: 'setup',
      challengeToken: expect.any(String),
      setup: { secret, otpauthUrl: expect.stringContaining(`secret=${secret}`) },
    });
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('keeps the secret not yet confirmed, so what she already scanned still works', async () => {
    findByEmail.mockResolvedValue({ ...googleUser, googleId: 'google-sub', twoFactorSecret: 'PENDINGSECRET' });
    const result = await service.validateGoogleToken('id-token');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(result.setup?.secret).toBe('PENDINGSECRET');
  });

  it('asks for the code of her app once it is set up', async () => {
    findByEmail.mockResolvedValue({
      ...googleUser,
      googleId: 'google-sub',
      twoFactorSecret: 'SECRET',
      twoFactorEnabledAt: new Date(),
    });
    const result = await service.validateGoogleToken('id-token');
    expect(result).toEqual({ twoFactor: 'verify', challengeToken: expect.any(String) });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
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

describe('AuthService two-step verification', () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const now = new Date('2026-11-20T08:00:00Z');
  const enrolled = createMockUser({
    twoFactorSecret: secret,
    twoFactorEnabledAt: new Date('2026-11-01T08:00:00Z'),
    twoFactorLastStep: null as number | null,
    twoFactorRecoveryCodes: [hashRecoveryCode('AAAA-BBBB'), hashRecoveryCode('CCCC-DDDD')],
  });
  let service: AuthService;

  /** The challenge POST /auth/google gives her. */
  const challengeFor = async (user: object) => {
    const findByEmail = vi.fn().mockResolvedValue({ ...user, googleId: 'google-sub' });
    const google = makeService(findByEmail);
    (google as any).googleClient.verifyIdToken = vi.fn().mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub', email: 'test@test.com', email_verified: true }),
    });
    return (await google.validateGoogleToken('id-token')).challengeToken;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    service = makeService();
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the session with the current code of her app, and remembers the step', async () => {
    const token = await challengeFor(enrolled);
    mockPrisma.user.findUnique.mockResolvedValue(enrolled);
    const step = stepAt(now.getTime());

    const result = await service.completeTwoFactor(token, codeAt(secret, step), '1.2.3.4', 'Safari');

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: enrolled.id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
      data: { twoFactorLastStep: step },
    });
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: enrolled.id, ipAddress: '1.2.3.4', userAgent: 'Safari' }),
    });
    expect(result.accessToken).toBe('access-token');
    expect(result.recoveryCodes).toBeUndefined();
  });

  it('confirms the set-up with the first code and gives her recovery codes once', async () => {
    const pending = { ...enrolled, twoFactorEnabledAt: null, twoFactorRecoveryCodes: [] };
    const token = await challengeFor(pending);
    mockPrisma.user.findUnique.mockResolvedValue(pending);

    const result = await service.completeTwoFactor(token, codeAt(secret, stepAt(now.getTime())));

    expect(result.recoveryCodes).toHaveLength(10);
    const data = mockPrisma.user.updateMany.mock.calls[0][0].data;
    expect(data.twoFactorEnabledAt).toEqual(now);
    expect(data.twoFactorRecoveryCodes).toEqual(result.recoveryCodes!.map(hashRecoveryCode));
  });

  it('refuses a wrong code, a code already used and a recovery code before set-up', async () => {
    const token = await challengeFor(enrolled);
    const step = stepAt(now.getTime());
    mockPrisma.user.findUnique.mockResolvedValue(enrolled);
    await expect(service.completeTwoFactor(token, '000000')).rejects.toThrow(WRONG_CODE);

    mockPrisma.user.findUnique.mockResolvedValue({ ...enrolled, twoFactorLastStep: step + 1 });
    await expect(service.completeTwoFactor(token, codeAt(secret, step))).rejects.toThrow(WRONG_CODE);

    // Same code sent twice at once: the second conditional update matches nothing
    mockPrisma.user.findUnique.mockResolvedValue(enrolled);
    mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.completeTwoFactor(token, codeAt(secret, step))).rejects.toThrow(WRONG_CODE);

    mockPrisma.user.findUnique.mockResolvedValue({ ...enrolled, twoFactorEnabledAt: null });
    await expect(service.completeTwoFactor(token, 'AAAA-BBBB')).rejects.toThrow(WRONG_CODE);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('accepts each recovery code once', async () => {
    const token = await challengeFor(enrolled);
    mockPrisma.user.findUnique.mockResolvedValue(enrolled);

    await service.completeTwoFactor(token, 'aaaa bbbb');

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: enrolled.id, twoFactorRecoveryCodes: { has: hashRecoveryCode('AAAA-BBBB') } },
      data: { twoFactorRecoveryCodes: [hashRecoveryCode('CCCC-DDDD')] },
    });
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('refuses a forged or expired challenge, and an access token used as one', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(enrolled);
    const code = codeAt(secret, stepAt(now.getTime()));
    await expect(service.completeTwoFactor('not-a-token', code)).rejects.toThrow(CHALLENGE_EXPIRED);

    const accessLike = realJwt.sign({ sub: enrolled.id }, { secret: 'test-jwt-secret' });
    await expect(service.completeTwoFactor(accessLike, code)).rejects.toThrow(CHALLENGE_EXPIRED);

    const token = await challengeFor(enrolled);
    vi.setSystemTime(new Date(now.getTime() + 6 * 60_000));
    await expect(service.completeTwoFactor(token, codeAt(secret, stepAt()))).rejects.toThrow(CHALLENGE_EXPIRED);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses a user deactivated between the two steps', async () => {
    const token = await challengeFor(enrolled);
    mockPrisma.user.findUnique.mockResolvedValue({ ...enrolled, isActive: false });
    await expect(service.completeTwoFactor(token, codeAt(secret, stepAt()))).rejects.toThrow(ACCOUNT_DISABLED);
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
