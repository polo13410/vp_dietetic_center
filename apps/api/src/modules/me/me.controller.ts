import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, UserRole } from '@prisma/client';

import type { AccessUser } from '../../common/access/patient-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { CreateFormulaDto, ReorderFormulasDto, UpdateFormulaDto } from './dto/formula.dto';
import { UpdateActivityDto, UpdateMeDto } from './dto/me.dto';
import { CreatePracticeDto, UpdatePracticeDto } from './dto/practice.dto';
import { FormulasService } from './formulas.service';
import { MeService } from './me.service';
import { PracticesService } from './practices.service';

const uuid = new ParseUUIDPipe();

/** The settings page: what the signed-in user changes about herself. */
@ApiTags('me')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly formulas: FormulasService,
    private readonly practices: PracticesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mon profil (nom, téléphone, apparence, mode de connexion)' })
  getProfile(@CurrentUser() user: AccessUser) {
    return this.me.getProfile(user.id);
  }

  @Patch()
  @Audited({ action: AuditAction.UPDATE, entity: 'user', entityId: 'result:id' })
  @ApiOperation({ summary: 'Modifier mon profil ou mon apparence' })
  updateProfile(@CurrentUser() user: AccessUser, @Body() dto: UpdateMeDto) {
    return this.me.updateProfile(user.id, dto);
  }

  // ─── Activity (printed on invoices) ────────────────────────────────────────────

  @Get('activity')
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Mon activité (nom, SIRET, ADELI/RPPS, mentions des factures)' })
  getActivity(@CurrentUser() user: AccessUser) {
    return this.me.getActivity(user.id);
  }

  @Patch('activity')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.UPDATE, entity: 'activity' })
  @ApiOperation({ summary: 'Modifier mon activité' })
  updateActivity(@CurrentUser() user: AccessUser, @Body() dto: UpdateActivityDto) {
    return this.me.updateActivity(user.id, dto);
  }

  // ─── Practices (where she consults) ──────────────────────────────────────────

  @Get('practices')
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Mes cabinets : actifs (celui par défaut en premier) puis archivés' })
  listPractices(@CurrentUser() user: AccessUser) {
    return this.practices.list(user.id);
  }

  @Post('practices')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.CREATE, entity: 'practice', entityId: 'result:id' })
  @ApiOperation({ summary: 'Ajouter un cabinet (le premier devient celui par défaut)' })
  createPractice(@CurrentUser() user: AccessUser, @Body() dto: CreatePracticeDto) {
    return this.practices.create(user.id, dto);
  }

  @Patch('practices/:id')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.UPDATE, entity: 'practice' })
  @ApiOperation({ summary: 'Modifier un cabinet, le choisir par défaut, l’archiver ou le proposer à nouveau' })
  updatePractice(
    @CurrentUser() user: AccessUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdatePracticeDto,
  ) {
    return this.practices.update(user.id, id, dto);
  }

  // ─── Formulas (prices) ───────────────────────────────────────────────────────

  @Get('formulas')
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Mes tarifs : formules proposées (dans mon ordre) puis retirées' })
  listFormulas(@CurrentUser() user: AccessUser) {
    return this.formulas.list(user.id);
  }

  @Post('formulas')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.CREATE, entity: 'formula', entityId: 'result:id' })
  @ApiOperation({ summary: 'Ajouter une formule (en dernier)' })
  createFormula(@CurrentUser() user: AccessUser, @Body() dto: CreateFormulaDto) {
    return this.formulas.create(user.id, dto);
  }

  @Put('formulas/order')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.UPDATE, entity: 'formula' })
  @ApiOperation({ summary: 'Changer l’ordre des formules proposées' })
  reorderFormulas(@CurrentUser() user: AccessUser, @Body() dto: ReorderFormulasDto) {
    return this.formulas.reorder(user.id, dto.ids);
  }

  @Patch('formulas/:id')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.UPDATE, entity: 'formula' })
  @ApiOperation({ summary: 'Modifier une formule, ou la proposer à nouveau (archived: false)' })
  updateFormula(
    @CurrentUser() user: AccessUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateFormulaDto,
  ) {
    return this.formulas.update(user.id, id, dto);
  }

  @Delete('formulas/:id')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.DELETE, entity: 'formula' })
  @ApiOperation({ summary: 'Supprimer une formule (archivée à la place si des séances l’utilisent)' })
  removeFormula(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.formulas.remove(user.id, id);
  }
}
