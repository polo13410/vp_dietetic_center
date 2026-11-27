import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { AuditAction, UserRole } from '@prisma/client';
import type { Response } from 'express';

import type { AccessUser } from '../../common/access/patient-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audited } from '../audit/audited.decorator';

import { CancelInvoiceDto, InvoicePeriodQueryDto } from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

const uuid = new ParseUUIDPipe();

/** The « Factures » page: her invoices and credit notes, their totals, the accountant's export. */
@ApiTags('invoices')
@ApiBearerAuth()
// Invoices belong to the practitioner who issued them
@Roles(UserRole.PRATICIENNE)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @Audited({ action: AuditAction.READ, entity: 'invoice' })
  @ApiOperation({ summary: 'Factures et avoirs d’une période, avec le total encaissé (par moyen de paiement, par mois)' })
  list(@CurrentUser() user: AccessUser, @Query() query: InvoicePeriodQueryDto) {
    return this.invoices.list(user, query.from, query.to);
  }

  @Get('export')
  @Audited({ action: AuditAction.EXPORT, entity: 'invoice' })
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export CSV d’une période pour le comptable (tous les statuts)' })
  async export(
    @CurrentUser() user: AccessUser,
    @Query() query: InvoicePeriodQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.invoices.exportCsv(user, query.from, query.to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="factures-${query.from}-${query.to}.csv"`);
    return csv;
  }

  @Get('to-issue')
  @ApiOperation({ summary: 'Séances sans facture (« Factures à faire »)' })
  toIssue(@CurrentUser() user: AccessUser) {
    return this.invoices.sessionsToInvoice(user);
  }

  @Get(':id/preview')
  @Header('Cache-Control', 'private, no-store')
  @Audited({ action: AuditAction.READ, entity: 'invoice', patientId: 'result:patientId' })
  @ApiOperation({ summary: 'Consulter une facture ou un avoir dans le navigateur' })
  preview(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.invoices.findOne(user, id);
  }

  @Get(':id/document')
  @Header('Cache-Control', 'private, no-store')
  @Audited({ action: AuditAction.EXPORT, entity: 'invoice', patientId: 'result:patientId' })
  @ApiOperation({ summary: 'Une facture ou un avoir, pour en faire le PDF' })
  document(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.invoices.findOne(user, id);
  }

  @Post(':id/correct')
  @Audited({ action: AuditAction.CREATE, entity: 'invoice', patientId: 'result:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Corriger la facture : avoir + nouvelle facture d’après la séance actuelle' })
  correct(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string) {
    return this.invoices.correct(user, id);
  }

  @Post(':id/cancel')
  @Audited({ action: AuditAction.CREATE, entity: 'invoice', patientId: 'result:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Annuler la facture (avoir) ; la séance redevient sans facture' })
  cancel(@CurrentUser() user: AccessUser, @Param('id', uuid) id: string, @Body() dto: CancelInvoiceDto) {
    return this.invoices.cancel(user, id, dto.reason);
  }
}

/** The invoice block of a session. */
@ApiTags('invoices')
@ApiBearerAuth()
@Roles(UserRole.PRATICIENNE)
@Controller({ path: 'consultations/:consultationId', version: '1' })
export class SessionInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'La facture de la séance, ce qui ne correspond plus, et les factures annulées' })
  forSession(@CurrentUser() user: AccessUser, @Param('consultationId', uuid) consultationId: string) {
    return this.invoices.forSession(user, consultationId);
  }

  @Post('invoice')
  @Audited({ action: AuditAction.CREATE, entity: 'invoice', patientId: 'result:patientId', entityId: 'result:id' })
  @ApiOperation({ summary: 'Faire la facture de la séance' })
  issue(@CurrentUser() user: AccessUser, @Param('consultationId', uuid) consultationId: string) {
    return this.invoices.issue(user, consultationId);
  }
}

/** The « Factures » tab of the patient file. */
@ApiTags('invoices')
@ApiBearerAuth()
@Roles(UserRole.PRATICIENNE)
@Controller({ path: 'patients/:patientId/invoices', version: '1' })
export class PatientInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @Audited({ action: AuditAction.READ, entity: 'invoice', patientId: 'param:patientId' })
  @ApiOperation({ summary: 'Les factures du patient et leur total' })
  forPatient(@CurrentUser() user: AccessUser, @Param('patientId', uuid) patientId: string) {
    return this.invoices.forPatient(user, patientId);
  }
}
