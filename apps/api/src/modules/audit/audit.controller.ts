import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller({ path: 'audit-logs', version: '1' })
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Journaux d'audit (ADMIN uniquement)' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('entity') entity?: string,
  ) {
    return this.service.findAll(+page, +limit, entity);
  }
}
