import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from '@prisma/client';
import type { CookieOptions, Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { Audited, type AuditedOptions } from '../audit/audited.decorator';

import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';

// Firebase Hosting (in front of the app) only guarantees to forward a cookie with this name
const REFRESH_COOKIE = '__session';

/** Sign-in endpoints: few attempts per IP. */
export const SIGN_IN_LIMIT = { default: { limit: 10, ttl: 60_000 } };

/** A sign-in is logged as LOGIN for the user it signed in. */
export const SIGN_IN_AUDIT: AuditedOptions = {
  action: AuditAction.LOGIN,
  entity: 'session',
  entityId: 'result:user.id',
  userId: 'result:user.id',
};

// Sent only to /api/v1/auth/* (refresh and logout), never readable by scripts
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
};

type Session = Awaited<ReturnType<AuthService['login']>>;

/** Sets the refresh cookie, which expires with the session, and returns the rest to the app. */
export function sendSession(res: Response, session: Session) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: session.refreshExpiresAt,
  });
  return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('google')
  @Audited(SIGN_IN_AUDIT)
  @Throttle(SIGN_IN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion avec Google (le seul moyen de se connecter)' })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.validateGoogleToken(
      dto.idToken,
      req.ip,
      req.headers['user-agent'],
    );
    return sendSession(res, session);
  }

  // Public: the refresh token (an opaque value from the cookie) is checked by the service
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rafraichir le token d'acces" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.refreshTokens(
      req.cookies[REFRESH_COOKIE],
      req.ip,
      req.headers['user-agent'],
    );
    const { accessToken, expiresIn } = sendSession(res, session);
    return { accessToken, expiresIn };
  }

  @Post('logout')
  @Audited({ action: AuditAction.LOGOUT, entity: 'session' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Déconnexion' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies[REFRESH_COOKIE];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
  }
}
