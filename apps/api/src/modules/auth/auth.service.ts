import { createHash, randomBytes } from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

import {
  generateRecoveryCodes,
  generateSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyCode,
} from './two-factor/totp';

/** Shown on the sign-in page: the Google account is fine, but nobody registered its address. */
export const NOT_REGISTERED =
  'Cette adresse Google n’est pas enregistrée dans l’application. Demandez à l’administratrice de créer votre compte avec cette adresse.';
export const ACCOUNT_DISABLED =
  'Ce compte est désactivé. Demandez à l’administratrice de le réactiver.';
export const WRONG_CODE =
  'Ce code n’est pas bon. Tapez le code à 6 chiffres affiché en ce moment par votre application, ou un code de secours.';
export const CHALLENGE_EXPIRED = 'La vérification a pris trop de temps. Reconnectez-vous avec Google.';

/** Time to type the code after Google, with the signed challenge kept by the sign-in page. */
const CHALLENGE_EXPIRES_IN = '5m';

/**
 * Google said who she is; the second step (a code from her authenticator app) is still to do.
 * `setup` is there until she has confirmed her app once: the secret to add to it.
 */
export interface TwoFactorChallenge {
  twoFactor: 'setup' | 'verify';
  challengeToken: string;
  setup?: { secret: string; otpauthUrl: string };
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(this.config.get<string>('google.clientId'));
  }

  /**
   * Issues an access token and a new refresh token. `sessionExpiresAt` keeps the expiry of the
   * session being refreshed, so a session ends `jwt.refreshExpiresIn` after sign-in at the latest.
   */
  async login(user: User, ipAddress?: string, userAgent?: string, sessionExpiresAt?: Date) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt =
      sessionExpiresAt ??
      new Date(Date.now() + this.parseExpiry(this.config.get('jwt.refreshExpiresIn', '10h')));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return {
      accessToken,
      refreshToken: rawToken,
      refreshExpiresAt: expiresAt,
      expiresIn: this.parseExpiry(this.config.get('jwt.expiresIn', '15m')) / 1000,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async refreshTokens(rawToken: string | undefined, ipAddress?: string, userAgent?: string) {
    if (!rawToken) throw new UnauthorizedException('Session expirée');

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
    if (!user.isActive) throw new UnauthorizedException('Compte désactivé');

    return this.login(user, ipAddress, userAgent, stored.expiresAt);
  }

  async logout(rawToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken) },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * The only way to sign in: a Google ID token, verified with Google, whose verified e-mail
   * belongs to a registered, active user, then a code from her authenticator app
   * (`completeTwoFactor`). Never creates an account, never opens a session by itself.
   */
  async validateGoogleToken(idToken: string): Promise<TwoFactorChallenge> {
    // A malformed, expired, forged or foreign token is a refused sign-in, not a server error
    const ticket = await this.googleClient
      .verifyIdToken({ idToken, audience: this.config.get<string>('google.clientId') })
      .catch(() => {
        throw new UnauthorizedException('La connexion avec Google a échoué. Réessayez.');
      });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException(
        'L’adresse de ce compte Google n’est pas vérifiée par Google. Vérifiez-la, puis réessayez.',
      );
    }

    const user = await this.findRegisteredUser(payload.email);

    // Binds the Google account to the user on her first Google sign-in
    if (!user.googleId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, avatarUrl: payload.picture ?? null },
      });
    }

    return this.twoFactorChallenge(user);
  }

  /**
   * The second step: a code of her app (or, once enrolled, one of her recovery codes) for the
   * challenge given after Google. The first code confirms the enrolment and returns her
   * recovery codes, shown once.
   */
  async completeTwoFactor(challengeToken: string, code: string, ipAddress?: string, userAgent?: string) {
    const userId = await this.readChallenge(challengeToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new UnauthorizedException(ACCOUNT_DISABLED);
    if (!user.twoFactorSecret) throw new UnauthorizedException(CHALLENGE_EXPIRED);

    const enrolling = !user.twoFactorEnabledAt;
    const step = verifyCode(user.twoFactorSecret, code, user.twoFactorLastStep);
    let recoveryCodes: string[] | undefined;

    if (step !== null) {
      // Conditional update: two requests with the same code cannot both pass
      if (enrolling) recoveryCodes = generateRecoveryCodes();
      const { count } = await this.prisma.user.updateMany({
        where: {
          id: user.id,
          OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }],
        },
        data: {
          twoFactorLastStep: step,
          ...(recoveryCodes && {
            twoFactorEnabledAt: new Date(),
            twoFactorRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
          }),
        },
      });
      if (count === 0) throw new UnauthorizedException(WRONG_CODE);
    } else {
      // A recovery code works only once enrolled, and only once
      const hash = hashRecoveryCode(code);
      if (enrolling || !user.twoFactorRecoveryCodes.includes(hash)) {
        throw new UnauthorizedException(WRONG_CODE);
      }
      const { count } = await this.prisma.user.updateMany({
        where: { id: user.id, twoFactorRecoveryCodes: { has: hash } },
        data: { twoFactorRecoveryCodes: user.twoFactorRecoveryCodes.filter((h) => h !== hash) },
      });
      if (count === 0) throw new UnauthorizedException(WRONG_CODE);
    }

    const session = await this.startSession(user, ipAddress, userAgent);
    return { ...session, recoveryCodes };
  }

  /**
   * Local development and end-to-end tests only (see DevLoginModule, which exists only there):
   * signs in a registered, active user by e-mail, with the same checks as Google.
   */
  async devLogin(email: string, ipAddress?: string, userAgent?: string) {
    const user = await this.findRegisteredUser(email);
    return this.startSession(user, ipAddress, userAgent);
  }

  private async findRegisteredUser(email: string): Promise<User> {
    const user = await this.usersService.findByEmail(email.trim().toLowerCase());
    if (!user) throw new UnauthorizedException(NOT_REGISTERED);
    if (!user.isActive) throw new UnauthorizedException(ACCOUNT_DISABLED);
    return user;
  }

  /** After Google: a short-lived challenge, and the secret to add to her app if not done yet. */
  private async twoFactorChallenge(user: User): Promise<TwoFactorChallenge> {
    const challengeToken = this.jwtService.sign(
      { sub: user.id, typ: 'two-factor' },
      { secret: this.challengeSecret(), expiresIn: CHALLENGE_EXPIRES_IN },
    );
    if (user.twoFactorEnabledAt && user.twoFactorSecret) return { twoFactor: 'verify', challengeToken };

    // The same secret until she confirms it, so a second try works with what she already scanned
    let secret = user.twoFactorSecret;
    if (!secret) {
      secret = generateSecret();
      await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });
    }
    return { twoFactor: 'setup', challengeToken, setup: { secret, otpauthUrl: otpauthUrl(secret, user.email) } };
  }

  private async readChallenge(challengeToken: string): Promise<string> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; typ?: string }>(challengeToken, {
        secret: this.challengeSecret(),
      });
      if (payload.typ !== 'two-factor' || !payload.sub) throw new Error('Not a challenge');
      return payload.sub;
    } catch {
      throw new UnauthorizedException(CHALLENGE_EXPIRED);
    }
  }

  /** Its own key: a challenge can never be used as an access token, nor the other way round. */
  private challengeSecret(): string {
    return `${this.config.getOrThrow<string>('jwt.secret')}:two-factor`;
  }

  private async startSession(user: User, ipAddress?: string, userAgent?: string) {
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.login(user, ipAddress, userAgent);
  }

  private parseExpiry(expiry: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 3600 * 1000,
      d: 86400 * 1000,
    };
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // default 15min
    return parseInt(match[1]) * (units[match[2]] ?? 1000);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
