import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';

import { AuthModule } from '../auth.module';

import { devLoginEnabled } from './dev-login-enabled';
import { DevLoginController } from './dev-login.controller';

@Module({
  imports: [AuthModule],
  controllers: [DevLoginController],
})
export class DevLoginModule {}

/**
 * Loaded only when devLoginEnabled() (DEV_LOGIN=true on a local machine): elsewhere the route
 * POST /auth/dev-login does not exist. Waits for the .env files to be read.
 */
export const devLoginImport = () => ConditionalModule.registerWhen(DevLoginModule, devLoginEnabled, { debug: false });
