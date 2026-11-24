import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsString, MaxLength } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { SearchService } from './search.service';

export class SearchDto {
  @ApiProperty({ description: 'Terme recherché' })
  @IsString()
  @MaxLength(100)
  q!: string;
}

@ApiTags('search')
@ApiBearerAuth()
// Patient data: never admins (they manage the app, not patients)
@Roles(UserRole.PRATICIENNE, UserRole.ASSISTANTE)
@Controller({ version: '1' })
export class SearchController {
  constructor(private readonly service: SearchService) {}

  /** POST: the term travels in the body, never in a URL (URLs end up in every log). */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recherche globale multi-entités' })
  search(@Body() { q }: SearchDto, @CurrentUser() user: any) {
    return this.service.search(q, user);
  }

}
