import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail } from 'class-validator';
import type { Request, Response } from 'express';

import { Public } from '../../../common/decorators/public.decorator';
import { Audited } from '../../audit/audited.decorator';
import { SIGN_IN_AUDIT, SIGN_IN_LIMIT, sendSession } from '../auth.controller';
import { AuthService } from '../auth.service';

import { devLoginEnabled } from './dev-login-enabled';

export class DevLoginDto {
  @IsEmail()
  email: string;
}

/** Sign-in without Google, for local development and end-to-end tests (see DevLoginModule). */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class DevLoginController {
  constructor(private readonly authService: AuthService) {
    // Defence in depth: the module is only loaded when this is true, and it throws elsewhere
    if (!devLoginEnabled()) throw new Error('The dev sign-in is off: DevLoginModule must not be loaded');
  }

  @Public()
  @Post('dev-login')
  @Audited(SIGN_IN_AUDIT)
  @Throttle(SIGN_IN_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion sans Google (développement local et tests uniquement)' })
  async devLogin(@Body() dto: DevLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.devLogin(dto.email, req.ip, req.headers['user-agent']);
    return sendSession(res, session);
  }
}
