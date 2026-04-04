import { NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockNotifications, mockPrisma } from '../../test/setup';

import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService(mockPrisma as any, mockNotifications as any);
  });

  describe('findAll', () => {
    it('returns tasks for the user', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 't1', title: 'Task 1' }]);

      const result = await service.findAll(user as any);
      expect(result).toHaveLength(1);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ assignedToId: user.id }, { createdById: user.id }],
          }),
        }),
      );
    });

    it('filters by patientId', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      await service.findAll(user as any, 'patient-1');
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientId: 'patient-1' }),
        }),
      );
    });
  });

  describe('create', () => {
    it('sets createdById from current user', async () => {
      mockPrisma.task.create.mockResolvedValue({ id: 't1' });

      await service.create({ title: 'New task' }, user as any);

      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdById: user.id }),
        }),
      );
    });

    it('creates a notification', async () => {
      mockPrisma.task.create.mockResolvedValue({ id: 't1' });
      await service.create({ title: 'New task' }, user as any);
      expect(mockNotifications.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('auto-sets completedAt when status is DONE', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', completedAt: null });
      mockPrisma.task.update.mockResolvedValue({});

      await service.update('t1', { status: TaskStatus.DONE });

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft deletes by setting CANCELLED status', async () => {
      mockPrisma.task.update.mockResolvedValue({});
      await service.remove('t1');
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TaskStatus.CANCELLED },
        }),
      );
    });
  });
});
