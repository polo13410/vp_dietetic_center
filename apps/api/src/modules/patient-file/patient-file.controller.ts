import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, FileField, MetricType, UserRole } from '@prisma/client';

import type { AccessUser } from '../../common/access/patient-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { ConsultationsService } from './consultations.service';
import { CreateConsultationDto, UpdateConsultationDto } from './dto/consultation.dto';
import {
  CreateGpReportDto,
  CreateLifeEventDto,
  CreateMeasurementDto,
  SaveFileFieldDto,
  UpdateFileEntryDto,
  UpdateGpReportDto,
  UpdateLifeEventDto,
  UpdateMeasurementDto,
} from './dto/entries.dto';
import { GpReportsService } from './gp-reports.service';
import { PatientFileService } from './patient-file.service';

const uuid = new ParseUUIDPipe();
const fileField = new ParseEnumPipe(FileField);

@ApiTags('patient-file')
@ApiBearerAuth()
// Clinical data: practitioners only (assistants are refused by the access service)
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ path: 'patients/:patientId', version: '1' })
export class PatientFileController {
  constructor(
    private readonly file: PatientFileService,
    private readonly sessions: ConsultationsService,
    private readonly gpReports: GpReportsService,
  ) {}

  @Get('brief')
  @Audited({ action: AuditAction.READ, entity: 'patient', patientId: 'param:patientId', entityId: 'param:patientId' })
  @ApiOperation({ summary: 'Résumé du patient avant une séance' })
  brief(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.file.getBrief(user, patientId);
  }

  // ─── Sessions ────────────────────────────────────────────────────────────────

  @Get('consultations')
  @ApiOperation({ summary: 'Le suivi : les séances, avec poids, IMC, MB et écarts' })
  listSessions(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.sessions.list(user, patientId);
  }

  @Post('consultations')
  @Audited({ action: AuditAction.CREATE, entity: 'consultation', patientId: 'param:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Démarrer une séance (depuis un rendez-vous, qui passe à « terminé », ou non)' })
  startSession(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Body() dto: CreateConsultationDto,
  ) {
    return this.sessions.create(user, patientId, dto);
  }

  // ─── Medical file ────────────────────────────────────────────────────────────

  @Get('file')
  @Audited({ action: AuditAction.READ, entity: 'file_entry', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Dossier médical : valeur actuelle de chaque rubrique' })
  getFile(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.file.getFile(user, patientId);
  }

  @Put('file/:field')
  @Audited({ action: AuditAction.UPDATE, entity: 'file_entry', patientId: 'param:patientId', entityId: 'result:id' })
  @ApiOperation({
    summary: 'Enregistrer une rubrique (même jour ou même séance : mise à jour ; autre jour : nouvelle version)',
  })
  saveFileField(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('field', fileField) field: FileField,
    @Body() dto: SaveFileFieldDto,
  ) {
    return this.file.saveFileField(user, patientId, field, dto);
  }

  @Get('file-entries')
  @Audited({ action: AuditAction.READ, entity: 'file_entry', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Historique du dossier médical (une rubrique ou toutes)' })
  listFileEntries(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Query('field', new ParseEnumPipe(FileField, { optional: true })) field?: FileField,
  ) {
    return this.file.listFileEntries(user, patientId, field);
  }

  @Patch('file-entries/:id')
  @Audited({ action: AuditAction.UPDATE, entity: 'file_entry', patientId: 'param:patientId' })
  @ApiOperation({ summary: "Corriger une version de l'historique" })
  updateFileEntry(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateFileEntryDto,
  ) {
    return this.file.updateFileEntry(user, patientId, id, dto);
  }

  @Delete('file-entries/:id')
  @Audited({ action: AuditAction.DELETE, entity: 'file_entry', patientId: 'param:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFileEntry(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.file.removeFileEntry(user, patientId, id);
  }

  // ─── Measurements ────────────────────────────────────────────────────────────

  @Get('measurements')
  listMeasurements(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Query('type', new ParseEnumPipe(MetricType, { optional: true })) type?: MetricType,
  ) {
    return this.file.listMeasurements(user, patientId, type);
  }

  @Post('measurements')
  @Audited({ action: AuditAction.CREATE, entity: 'measurement', patientId: 'param:patientId', entityId: 'result:id' })
  createMeasurement(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Body() dto: CreateMeasurementDto,
  ) {
    return this.file.createMeasurement(user, patientId, dto);
  }

  @Patch('measurements/:id')
  @Audited({ action: AuditAction.UPDATE, entity: 'measurement', patientId: 'param:patientId' })
  updateMeasurement(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateMeasurementDto,
  ) {
    return this.file.updateMeasurement(user, patientId, id, dto);
  }

  @Delete('measurements/:id')
  @Audited({ action: AuditAction.DELETE, entity: 'measurement', patientId: 'param:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMeasurement(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.file.removeMeasurement(user, patientId, id);
  }

  // ─── Life events ─────────────────────────────────────────────────────────────

  @Get('life-events')
  listLifeEvents(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.file.listLifeEvents(user, patientId);
  }

  @Post('life-events')
  @Audited({ action: AuditAction.CREATE, entity: 'life_event', patientId: 'param:patientId', entityId: 'result:id' })
  createLifeEvent(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Body() dto: CreateLifeEventDto,
  ) {
    return this.file.createLifeEvent(user, patientId, dto);
  }

  @Patch('life-events/:id')
  @Audited({ action: AuditAction.UPDATE, entity: 'life_event', patientId: 'param:patientId' })
  updateLifeEvent(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateLifeEventDto,
  ) {
    return this.file.updateLifeEvent(user, patientId, id, dto);
  }

  @Delete('life-events/:id')
  @Audited({ action: AuditAction.DELETE, entity: 'life_event', patientId: 'param:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLifeEvent(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.file.removeLifeEvent(user, patientId, id);
  }

  // ─── Reports to the GP ───────────────────────────────────────────────────────

  @Get('gp-reports')
  @Audited({ action: AuditAction.READ, entity: 'gp_report', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Comptes rendus au médecin traitant' })
  listGpReports(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.gpReports.list(user, patientId);
  }

  @Get('gp-reports/:id')
  @Audited({ action: AuditAction.READ, entity: 'gp_report', patientId: 'param:patientId' })
  findGpReport(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.gpReports.findOne(user, patientId, id);
  }

  @Get('gp-reports/:id/document')
  @Audited({ action: AuditAction.EXPORT, entity: 'gp_report', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Un compte rendu avec le papier à en-tête du cabinet, pour en faire le PDF' })
  gpReportDocument(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.gpReports.document(user, patientId, id);
  }

  @Post('gp-reports')
  @Audited({ action: AuditAction.CREATE, entity: 'gp_report', patientId: 'param:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Rédiger un compte rendu (sans texte : pré-rempli à partir du dossier)' })
  createGpReport(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Body() dto: CreateGpReportDto,
  ) {
    return this.gpReports.create(user, patientId, dto);
  }

  @Patch('gp-reports/:id')
  @Audited({ action: AuditAction.UPDATE, entity: 'gp_report', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Modifier un compte rendu, ou le marquer comme envoyé' })
  updateGpReport(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateGpReportDto,
  ) {
    return this.gpReports.update(user, patientId, id, dto);
  }

  @Post('gp-reports/:id/regenerate')
  @Audited({ action: AuditAction.UPDATE, entity: 'gp_report', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Régénérer un brouillon à partir du dossier (remplace son texte)' })
  regenerateGpReport(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.gpReports.regenerate(user, patientId, id);
  }

  @Delete('gp-reports/:id')
  @Audited({ action: AuditAction.DELETE, entity: 'gp_report', patientId: 'param:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGpReport(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.gpReports.remove(user, patientId, id);
  }
}

@ApiTags('patient-file')
@ApiBearerAuth()
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ path: 'consultations', version: '1' })
export class ConsultationsController {
  constructor(private readonly sessions: ConsultationsService) {}

  @Get(':id')
  @Audited({ action: AuditAction.READ, entity: 'consultation', patientId: 'result:patientId' })
  @ApiOperation({ summary: 'Une séance, avec ses calculs et les conseils de la séance précédente' })
  findOne(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.sessions.findOne(user, id);
  }

  @Patch(':id')
  @Audited({ action: AuditAction.UPDATE, entity: 'consultation', patientId: 'result:patientId' })
  @ApiOperation({ summary: 'Modifier une séance (toujours possible, même passée)' })
  update(
    @CurrentUser() user: AccessUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    return this.sessions.update(user, id, dto);
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'consultation', patientId: 'result:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une séance et ses mesures' })
  remove(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.sessions.remove(user, id);
  }
}
