import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
// Patient data: never admins (they manage the app, not patients)
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les patients (paginé, filtré, recherche)' })
  findAll(@CurrentUser() user: any, @Query() query: PatientQueryDto) {
    return this.patientsService.findAll(user, query);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Lister tous les tags disponibles' })
  findAllTags() {
    return this.patientsService.findAllTags();
  }

  @Get(':id')
  @Audited({ action: AuditAction.READ, entity: 'patient', patientId: 'param:id' })
  @ApiOperation({ summary: 'Fiche patient complète' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user);
  }

  @Get(':id/access-log')
  @ApiOperation({ summary: 'Qui a consulté ou modifié ce dossier, et quand' })
  accessLog(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.accessLog(id, user);
  }

  @Post()
  @Audited({ action: AuditAction.CREATE, entity: 'patient', patientId: 'result:id', entityId: 'result:id' })
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Créer un patient' })
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.create(dto, user);
  }

  @Patch(':id')
  @Audited({ action: AuditAction.UPDATE, entity: 'patient', patientId: 'param:id' })
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Mettre à jour un patient' })
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.update(id, dto, user);
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'patient', patientId: 'param:id' })
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Archiver un patient (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.remove(id, user);
  }
}
