import { createHash, randomBytes } from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Compte temporairement bloqué. Réessayez dans quelques minutes.',
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      // Increment login attempts
      const attempts = user.loginAttempts + 1;
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockedUntil },
      });
      return null;
    }

    // Reset login attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return user;
  }

  async login(user: User, ipAddress?: string, userAgent?: string) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + this.parseExpiry(this.config.get('jwt.refreshExpiresIn', '7d')),
    );

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

  async refreshTokens(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

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

    return this.login(user);
  }

  async logout(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return; // Ne pas révéler si l'email existe

    randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        // Stored in metadata – simplified here; use a dedicated table in production
      },
    });

    // TODO: Send email with reset link containing token
    // await this.mailService.sendPasswordReset(user.email, token);
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
