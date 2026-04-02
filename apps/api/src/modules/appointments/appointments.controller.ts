import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { AppointmentsService } from './appointments.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les rendez-vous' })
  findAll(@CurrentUser() user: any, @Query() query: AppointmentQueryDto) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: "Detail d'un rendez-vous" })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un rendez-vous' })
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un rendez-vous' })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Annuler un rendez-vous' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
