import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { NutritionalService } from './nutritional.service';

@ApiTags('nutritional')
@ApiBearerAuth()
@Controller({ path: 'nutritional', version: '1' })
export class NutritionalController {
  constructor(private readonly service: NutritionalService) {}

  @Get('profile/:patientId')
  getProfile(@Param('patientId') patientId: string) {
    return this.service.getProfile(patientId);
  }

  @Patch('profile/:patientId')
  updateProfile(@Param('patientId') patientId: string, @Body() data: Record<string, unknown>) {
    return this.service.updateProfile(patientId, data);
  }

  @Get('entries')
  getEntries(
    @Query('patientId') patientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getEntries(patientId, from, to);
  }

  @Post('entries')
  createEntry(@Body() body: Record<string, unknown>) {
    const { patientId, ...data } = body;
    return this.service.createEntry(patientId as string, data);
  }
}
