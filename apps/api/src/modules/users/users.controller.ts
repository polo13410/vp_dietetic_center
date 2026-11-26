import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Audited } from '../audit/audited.decorator';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister tous les utilisateurs (ADMIN)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Audited({ action: AuditAction.CREATE, entity: 'user', entityId: 'result:id' })
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur (ADMIN)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Audited({ action: AuditAction.UPDATE, entity: 'user' })
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un utilisateur (ADMIN)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/two-factor/reset')
  @Audited({ action: AuditAction.UPDATE, entity: 'user' })
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Réinitialiser la double authentification (téléphone perdu, ADMIN)' })
  resetTwoFactor(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.usersService.resetTwoFactor(id, user.id);
  }

  @Delete(':id')
  @Audited({ action: AuditAction.DELETE, entity: 'user' })
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Désactiver un utilisateur (ADMIN)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
