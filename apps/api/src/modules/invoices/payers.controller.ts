import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, UserRole } from '@prisma/client';

import type { AccessUser } from '../../common/access/patient-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import {
  CreateCoverageDto,
  CreatePayerDto,
  PayerInvoicePaidDto,
  PayerPeriodDto,
  UpdateCoverageDto,
  UpdatePayerDto,
} from './dto/payer.dto';
import { PayerInvoicesService } from './payer-invoices.service';
import { PayersService } from './payers.service';

const uuid = new ParseUUIDPipe();

/** The « Organismes » tab of the Factures page: her payers and their invoices (lot 16). */
@ApiTags('payers')
@ApiBearerAuth()
@Roles(UserRole.PRATICIENNE)
@Controller({ path: 'payers', version: '1' })
export class PayersController {
  constructor(
    private readonly payers: PayersService,
    private readonly payerInvoices: PayerInvoicesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Ses organismes, avec la prochaine période à facturer et les factures en attente' })
  list(@CurrentUser() user: AccessUser) {
    return this.payerInvoices.overview(user);
  }

  @Get('reminders')
  @ApiOperation({ summary: 'Périodes terminées à facturer, factures en attente depuis plus de 60 jours' })
  reminders(@CurrentUser() user: AccessUser) {
    return this.payerInvoices.reminders(user);
  }

  @Post()
  @Audited({ action: AuditAction.CREATE, entity: 'payer' })
  @ApiOperation({ summary: 'Ajouter un organisme' })
  create(@CurrentUser() user: AccessUser, @Body() dto: CreatePayerDto) {
    return this.payers.create(user, dto);
  }

  @Patch(':id')
  @Audited({ action: AuditAction.UPDATE, entity: 'payer' })
  @ApiOperation({ summary: 'Modifier, archiver ou proposer à nouveau un organisme' })
  update(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string, @Body() dto: UpdatePayerDto) {
    return this.payers.update(user, id, dto);
  }

  @Get(':id/preview')
  @Audited({ action: AuditAction.READ, entity: 'payer' })
  @ApiOperation({ summary: 'Préparer la facture : les séances de la période qu’il prend en charge' })
  preview(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string, @Query() period: PayerPeriodDto) {
    return this.payerInvoices.preview(user, id, period.from, period.to);
  }

  @Post(':id/invoices')
  @Audited({ action: AuditAction.CREATE, entity: 'invoice', entityId: 'result:id' })
  @ApiOperation({ summary: 'Émettre la facture de l’organisme sur la période' })
  issue(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string, @Body() period: PayerPeriodDto) {
    return this.payerInvoices.issue(user, id, period.from, period.to);
  }
}

/** Her payer invoices and their payment (« en attente », « réglée le … »). */
@ApiTags('payers')
@ApiBearerAuth()
@Roles(UserRole.PRATICIENNE)
@Controller({ path: 'payer-invoices', version: '1' })
export class PayerInvoicesController {
  constructor(private readonly payerInvoices: PayerInvoicesService) {}

  @Get()
  @Audited({ action: AuditAction.READ, entity: 'invoice' })
  @ApiOperation({ summary: 'Les factures des organismes et leurs avoirs, avec ce qui ne correspond plus' })
  list(@CurrentUser() user: AccessUser) {
    return this.payerInvoices.list(user);
  }

  @Post(':id/paid')
  @Audited({ action: AuditAction.UPDATE, entity: 'invoice' })
  @ApiOperation({ summary: '« Réglée le … » (null : de nouveau en attente)' })
  paid(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string, @Body() dto: PayerInvoicePaidDto) {
    return this.payerInvoices.setPaid(user, id, dto.paidOn ?? null);
  }
}

/** The patient's coverages, in the « Factures » tab of their file. */
@ApiTags('payers')
@ApiBearerAuth()
@Roles(UserRole.PRATICIENNE)
@Controller({ path: 'patients/:patientId/coverages', version: '1' })
export class PatientCoveragesController {
  constructor(private readonly payers: PayersService) {}

  @Get()
  @Audited({ action: AuditAction.READ, entity: 'patient_coverage', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Ses prises en charge' })
  list(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.payers.coverages(user, patientId);
  }

  @Post()
  @Audited({ action: AuditAction.CREATE, entity: 'patient_coverage', patientId: 'param:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Ajouter une prise en charge' })
  create(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string, @Body() dto: CreateCoverageDto) {
    return this.payers.createCoverage(user, patientId, dto);
  }

  @Patch(':id')
  @Audited({ action: AuditAction.UPDATE, entity: 'patient_coverage', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Modifier une prise en charge' })
  update(
    @CurrentUser() user: AccessUser,
    @Param('patientId', uuid) patientId: string,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateCoverageDto,
  ) {
    return this.payers.updateCoverage(user, patientId, id, dto);
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'patient_coverage', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Retirer une prise en charge (les séances passées gardent leur partage)' })
  remove(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string, @Param('id', uuid) id: string) {
    return this.payers.removeCoverage(user, patientId, id);
  }
}
