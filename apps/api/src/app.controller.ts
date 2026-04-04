import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  @Get('health')
  @Public()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }
}
