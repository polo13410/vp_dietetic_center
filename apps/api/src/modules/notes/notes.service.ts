import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NoteStatus, User, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: User, patientId?: string, appointmentId?: string, status?: NoteStatus) {
    const where: Record<string, unknown> = {
      ...(user.role !== UserRole.ADMIN ? { authorId: user.id } : {}),
      ...(patientId ? { patientId } : {}),
      ...(appointmentId ? { appointmentId } : {}),
      ...(status ? { status } : {}),
    };

    return this.prisma.clinicalNote.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        patientId: true,
        appointmentId: true,
        type: true,
        status: true,
        title: true,
        finalizedAt: true,
        createdAt: true,
        updatedAt: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findOne(id: string, user: User) {
    const note = await this.prisma.clinicalNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note introuvable');
    if (user.role !== UserRole.ADMIN && note.authorId !== user.id) throw new ForbiddenException();
    return note;
  }

  async create(dto: CreateNoteDto, user: User) {
    return this.prisma.clinicalNote.create({
      data: {
        ...dto,
        authorId: user.id,
        status: NoteStatus.DRAFT,
      },
    });
  }

  async update(id: string, dto: UpdateNoteDto, user: User) {
    const note = await this.findOne(id, user);
    if (note.status === NoteStatus.FINALIZED) {
      throw new BadRequestException('Une note finalisée ne peut pas être modifiée');
    }
    return this.prisma.clinicalNote.update({ where: { id }, data: dto });
  }

  async finalize(id: string, user: User) {
    const note = await this.findOne(id, user);
    if (note.status === NoteStatus.FINALIZED) {
      throw new BadRequestException('Note déjà finalisée');
    }
    return this.prisma.clinicalNote.update({
      where: { id },
      data: { status: NoteStatus.FINALIZED, finalizedAt: new Date() },
    });
  }

  async remove(id: string, user: User) {
    const note = await this.findOne(id, user);
    if (note.status === NoteStatus.FINALIZED) {
      throw new BadRequestException('Une note finalisée ne peut pas être supprimée');
    }
    return this.prisma.clinicalNote.delete({ where: { id } });
  }
}
