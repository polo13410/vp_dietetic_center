import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { AppointmentsService } from './appointments.service';
import { AppointmentQueryDto } from './dto/appointment-query.dto';
import { BookingOptionsQueryDto } from './dto/booking-options.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@ApiTags('appointments')
@ApiBearerAuth()
// Patient data: never admins (they manage the app, not patients)
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les rendez-vous' })
  findAll(@CurrentUser() user: any, @Query() query: AppointmentQueryDto) {
    return this.service.findAll(user, query);
  }

  @Get('options')
  @ApiOperation({ summary: 'Types de rendez-vous (formules, avec leur durée) et cabinets proposés' })
  options(@CurrentUser() user: any, @Query() query: BookingOptionsQueryDto) {
    return this.service.options(user, query.patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Detail d'un rendez-vous" })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Audited({ action: AuditAction.CREATE, entity: 'appointment', patientId: 'result:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Créer un rendez-vous' })
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Audited({ action: AuditAction.UPDATE, entity: 'appointment', patientId: 'result:patientId' })
  @ApiOperation({ summary: 'Modifier un rendez-vous' })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'appointment', patientId: 'result:patientId' })
  @ApiOperation({ summary: 'Annuler un rendez-vous' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
