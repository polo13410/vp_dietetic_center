import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller({ version: '1' })
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get('search')
  @ApiOperation({ summary: 'Recherche globale multi-entités' })
  search(@Query('q') q: string, @CurrentUser() user: any) {
    return this.service.search(q, user);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Données du tableau de bord' })
  dashboardSummary(@CurrentUser() user: any) {
    return this.service.getDashboardSummary(user);
  }
}
