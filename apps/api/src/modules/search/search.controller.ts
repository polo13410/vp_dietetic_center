import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
// Patient data: never admins (they manage the app, not patients)
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ version: '1' })
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get('search')
  @ApiOperation({ summary: 'Recherche globale multi-entités' })
  search(@Query('q') q: string, @CurrentUser() user: any) {
    return this.service.search(q, user);
  }

}
