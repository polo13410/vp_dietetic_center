import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoteStatus } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiBearerAuth()
@Controller({ path: 'notes', version: '1' })
export class NotesController {
  constructor(private readonly service: NotesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les notes cliniques' })
  findAll(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('status') status?: NoteStatus,
  ) {
    return this.service.findAll(user, patientId, appointmentId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finaliser et verrouiller une note' })
  finalize(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.finalize(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
