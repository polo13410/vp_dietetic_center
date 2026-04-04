import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('activity')
  getActivity(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getActivityReport(user, from, to);
  }

  @Get('trend')
  getTrend(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getAppointmentTrend(user, from, to);
  }

  @Get('patient-growth')
  getPatientGrowth(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getPatientGrowth(user, from, to);
  }
}
