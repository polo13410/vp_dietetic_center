import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, TaskStatus, User } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(user: User, patientId?: string, status?: TaskStatus) {
    return this.prisma.task.findMany({
      where: {
        OR: [{ assignedToId: user.id }, { createdById: user.id }],
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
    });
  }

  async create(dto: CreateTaskDto, user: User) {
    const task = await this.prisma.task.create({
      data: { ...dto, createdById: user.id },
    });

    this.notifications.create(
      user.id,
      NotificationType.TASK_CREATED,
      'Tache creee',
      `Nouvelle tache : ${dto.title}`,
      'task',
      task.id,
    ).catch(() => {});

    return task;
  }

  async update(id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Tâche introuvable');
    const completedAt =
      dto.status === TaskStatus.DONE && !task.completedAt ? new Date() : task.completedAt;
    return this.prisma.task.update({
      where: { id },
      data: { ...dto, completedAt },
    });
  }

  async remove(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED },
    });
  }
}
