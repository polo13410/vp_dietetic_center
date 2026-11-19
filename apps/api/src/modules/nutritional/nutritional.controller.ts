import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { CreateNutritionalEntryDto } from './dto/create-entry.dto';
import { UpdateNutritionalProfileDto } from './dto/update-profile.dto';
import { NutritionalService } from './nutritional.service';

@ApiTags('nutritional')
@ApiBearerAuth()
@Controller({ path: 'nutritional', version: '1' })
export class NutritionalController {
  constructor(private readonly service: NutritionalService) {}

  @Get('profile/:patientId')
  getProfile(@Param('patientId') patientId: string, @CurrentUser() user: User) {
    return this.service.getProfile(patientId, user);
  }

  @Patch('profile/:patientId')
  updateProfile(
    @Param('patientId') patientId: string,
    @Body() dto: UpdateNutritionalProfileDto,
    @CurrentUser() user: User,
  ) {
    return this.service.updateProfile(patientId, dto, user);
  }

  @Get('entries')
  getEntries(
    @CurrentUser() user: User,
    @Query('patientId') patientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!patientId) throw new BadRequestException('patientId requis');
    return this.service.getEntries(patientId, user, from, to);
  }

  @Post('entries')
  createEntry(@Body() dto: CreateNutritionalEntryDto, @CurrentUser() user: User) {
    const { patientId, ...data } = dto;
    return this.service.createEntry(patientId, data, user);
  }
}
