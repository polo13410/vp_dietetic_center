import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  @ApiOperation({ summary: 'Lister les patients (paginé, recherche, archivés à part)' })
  findAll(@CurrentUser() user: any, @Query() query: PatientQueryDto) {
    return this.patientsService.findAll(user, query);
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

  @Post(':id/archive')
  @Audited({ action: AuditAction.UPDATE, entity: 'patient', patientId: 'param:id' })
  @Roles(UserRole.PRATICIENNE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archiver un patient (il sort des listes, son dossier reste intact)' })
  archive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.setArchived(id, true, user);
  }

  @Post(':id/unarchive')
  @Audited({ action: AuditAction.UPDATE, entity: 'patient', patientId: 'param:id' })
  @Roles(UserRole.PRATICIENNE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Désarchiver un patient' })
  unarchive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.setArchived(id, false, user);
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'patient', patientId: 'param:id' })
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Supprimer un patient (suppression logique)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.remove(id, user);
  }
}
