import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientQueryDto } from './dto/patient-query.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les patients (paginé, filtré, recherche)' })
  findAll(@CurrentUser() user: any, @Query() query: PatientQueryDto) {
    return this.patientsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fiche patient complète' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline du patient (RDV, notes, tâches)' })
  getTimeline(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getTimeline(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un patient' })
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un patient' })
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archiver un patient (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.remove(id, user);
  }
}
