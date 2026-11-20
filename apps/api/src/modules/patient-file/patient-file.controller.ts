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
import { AuditAction } from '@prisma/client';
import { MetricType, PatientTopic, UserRole } from '@prisma/client';

import type { AccessUser } from '../../common/access/patient-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { ConsultationsService } from './consultations.service';
import { CreateConsultationDto, ReviewGoalDto, UpdateConsultationDto } from './dto/consultation.dto';
import {
  CreateGoalDto,
  CreateLifeEventDto,
  CreateMeasurementDto,
  CreateTopicNoteDto,
  UpdateGoalDto,
  UpdateLifeEventDto,
  UpdateMeasurementDto,
  UpdateTopicNoteDto,
} from './dto/entries.dto';
import { PatientFileService } from './patient-file.service';

const uuid = new ParseUUIDPipe();

@ApiTags('patient-file')
@ApiBearerAuth()
// Clinical data: practitioners only (assistants are refused by the access service)
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ path: 'patients/:patientId', version: '1' })
export class PatientFileController {
  constructor(
    private readonly file: PatientFileService,
    private readonly sessions: ConsultationsService,
  ) {}

  @Get('brief')
  @Audited({ action: AuditAction.READ, entity: 'patient', patientId: 'param:patientId', entityId: 'param:patientId' })
  @ApiOperation({ summary: 'Résumé du patient avant une séance' })
  brief(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.file.getBrief(user, patientId);
  }

  // ─── Sessions ────────────────────────────────────────────────────────────────

  @Get('consultations')
  listSessions(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.sessions.list(user, patientId);
  }

  @Post('consultations')
  @Audited({ action: AuditAction.CREATE, entity: 'consultation', patientId: 'param:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Démarrer une séance (depuis un rendez-vous ou non)' })
  startSession(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Body() dto: CreateConsultationDto,
  ) {
    return this.sessions.create(user, patientId, dto);
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

  // ─── Topic notes ─────────────────────────────────────────────────────────────

  @Get('topic-notes')
  listTopicNotes(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Query('topic', new ParseEnumPipe(PatientTopic, { optional: true })) topic?: PatientTopic,
  ) {
    return this.file.listTopicNotes(user, patientId, topic);
  }

  @Post('topic-notes')
  @Audited({ action: AuditAction.CREATE, entity: 'topic_note', patientId: 'param:patientId', entityId: 'result:id' })
  createTopicNote(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Body() dto: CreateTopicNoteDto,
  ) {
    return this.file.createTopicNote(user, patientId, dto);
  }

  @Patch('topic-notes/:id')
  @Audited({ action: AuditAction.UPDATE, entity: 'topic_note', patientId: 'param:patientId' })
  updateTopicNote(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateTopicNoteDto,
  ) {
    return this.file.updateTopicNote(user, patientId, id, dto);
  }

  @Delete('topic-notes/:id')
  @Audited({ action: AuditAction.DELETE, entity: 'topic_note', patientId: 'param:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTopicNote(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.file.removeTopicNote(user, patientId, id);
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

  // ─── Goals ───────────────────────────────────────────────────────────────────

  @Get('goals')
  listGoals(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.file.listGoals(user, patientId);
  }

  @Post('goals')
  @Audited({ action: AuditAction.CREATE, entity: 'goal', patientId: 'param:patientId', entityId: 'result:id' })
  createGoal(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.file.createGoal(user, patientId, dto);
  }

  @Patch('goals/:id')
  @Audited({ action: AuditAction.UPDATE, entity: 'goal', patientId: 'param:patientId' })
  updateGoal(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.file.updateGoal(user, patientId, id, dto);
  }

  @Delete('goals/:id')
  @Audited({ action: AuditAction.DELETE, entity: 'goal', patientId: 'param:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGoal(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
  ) {
    return this.file.removeGoal(user, patientId, id);
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
  findOne(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.sessions.findOne(user, id);
  }

  @Patch(':id')
  @Audited({ action: AuditAction.UPDATE, entity: 'consultation', patientId: 'result:patientId' })
  update(
    @CurrentUser() user: AccessUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    return this.sessions.update(user, id, dto);
  }

  @Post(':id/finalize')
  @Audited({ action: AuditAction.FINALIZE, entity: 'consultation', patientId: 'result:patientId' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finaliser la séance (verrouillée ensuite, RDV marqué terminé)' })
  finalize(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.sessions.finalize(user, id);
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'consultation', patientId: 'result:patientId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Abandonner un brouillon de séance et ce qui y a été saisi' })
  remove(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.sessions.remove(user, id);
  }

  @Put(':id/goal-reviews/:goalId')
  @Audited({ action: AuditAction.UPDATE, entity: 'goal', patientId: 'result:patientId', entityId: 'param:goalId' })
  @ApiOperation({ summary: "Faire le point sur un objectif pendant la séance" })
  reviewGoal(
    @CurrentUser() user: AccessUser,
    @Param('id', uuid) id: string,
    @Param('goalId', uuid) goalId: string,
    @Body() dto: ReviewGoalDto,
  ) {
    return this.sessions.reviewGoal(user, id, goalId, dto);
  }
}
