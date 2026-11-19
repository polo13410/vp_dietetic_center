import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, TaskStatus, User, UserRole } from '@prisma/client';

import { AccessUser, PatientAccessService } from '../../common/access/patient-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly access: PatientAccessService,
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
    await this.assertLinks(user, dto);
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

  async update(id: string, dto: UpdateTaskDto, user: AccessUser) {
    const task = await this.findAccessible(id, user);
    // Only re-check links the update actually changes
    if (dto.patientId) await this.access.assertPatient(user, dto.patientId, 'record');
    if (dto.appointmentId) {
      await this.access.assertAppointment(
        user,
        dto.appointmentId,
        dto.patientId ?? task.patientId ?? undefined,
      );
    }
    const completedAt =
      dto.status === TaskStatus.DONE && !task.completedAt ? new Date() : task.completedAt;
    return this.prisma.task.update({
      where: { id },
      data: { ...dto, completedAt },
    });
  }

  async remove(id: string, user: AccessUser) {
    await this.findAccessible(id, user);
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED },
    });
  }

  /** A task is visible to its creator, its assignee, and admins (same rule as findAll). */
  private async findAccessible(id: string, user: AccessUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Tâche introuvable');
    const allowed =
      user.role === UserRole.ADMIN || task.createdById === user.id || task.assignedToId === user.id;
    if (!allowed) throw new ForbiddenException('Accès non autorisé à cette tâche');
    return task;
  }

  /** The patient and appointment a task points to must be accessible to the user. */
  private async assertLinks(
    user: AccessUser,
    { patientId, appointmentId }: { patientId?: string; appointmentId?: string },
  ) {
    if (patientId) await this.access.assertPatient(user, patientId, 'record');
    if (appointmentId) await this.access.assertAppointment(user, appointmentId, patientId);
  }
}
