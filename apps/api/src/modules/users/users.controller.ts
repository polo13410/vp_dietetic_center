import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
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

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Récupérer un utilisateur par ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur (ADMIN)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un utilisateur (ADMIN)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Désactiver un utilisateur (ADMIN)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
