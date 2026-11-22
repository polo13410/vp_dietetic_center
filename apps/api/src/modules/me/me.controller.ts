import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, UserRole } from '@prisma/client';

import type { AccessUser } from '../../common/access/patient-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { CreateFormulaDto, ReorderFormulasDto, UpdateFormulaDto } from './dto/formula.dto';
import { UpdateMeDto, UpdatePracticeDto } from './dto/me.dto';
import { FormulasService } from './formulas.service';
import { MeService } from './me.service';

const uuid = new ParseUUIDPipe();

/** The settings page: what the signed-in user changes about herself. */
@ApiTags('me')
@ApiBearerAuth()
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly formulas: FormulasService,
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

  // ─── Practice (printed on invoices) ────────────────────────────────────────────

  @Get('practice')
  @Roles(UserRole.PRATICIENNE)
  @ApiOperation({ summary: 'Mon cabinet (informations des factures)' })
  getPractice(@CurrentUser() user: AccessUser) {
    return this.me.getPractice(user.id);
  }

  @Patch('practice')
  @Roles(UserRole.PRATICIENNE)
  @Audited({ action: AuditAction.UPDATE, entity: 'practice' })
  @ApiOperation({ summary: 'Modifier mon cabinet' })
  updatePractice(@CurrentUser() user: AccessUser, @Body() dto: UpdatePracticeDto) {
    return this.me.updatePractice(user.id, dto);
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
