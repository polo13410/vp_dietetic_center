import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService(mockPrisma as any, mockAccess as any);
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

    it('checks access to the linked patient and appointment', async () => {
      mockPrisma.task.create.mockResolvedValue({ id: 't1' });
      await service.create(
        { title: 'New task', patientId: 'p1', appointmentId: 'a1' },
        user as any,
      );
      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1', 'record');
      expect(mockAccess.assertAppointment).toHaveBeenCalledWith(user, 'a1', 'p1');
    });

    it("refuses to link another practitioner's patient", async () => {
      mockAccess.assertPatient.mockRejectedValueOnce(new ForbiddenException());
      await expect(
        service.create({ title: 'New task', patientId: 'p1' }, user as any),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.task.create).not.toHaveBeenCalled();
    });

    it('records who created it', async () => {
      mockPrisma.task.create.mockResolvedValue({ id: 't1' });
      await service.create({ title: 'New task' }, user as any);
      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: { title: 'New task', createdById: 'user-1' },
      });
    });
  });

  describe('update', () => {
    it('auto-sets completedAt when status is DONE', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        completedAt: null,
        createdById: user.id,
      });
      mockPrisma.task.update.mockResolvedValue({});

      await service.update('t1', { status: TaskStatus.DONE }, user as any);

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { title: 'X' }, user as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets the assignee update the task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        createdById: 'other',
        assignedToId: user.id,
      });
      mockPrisma.task.update.mockResolvedValue({});
      await expect(service.update('t1', { title: 'X' }, user as any)).resolves.toBeDefined();
    });

    it('refuses updates from users who neither created nor are assigned the task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({
        id: 't1',
        createdById: 'other',
        assignedToId: 'someone-else',
      });
      await expect(service.update('t1', { title: 'X' }, user as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it("refuses admins on someone else's task", async () => {
      const admin = createMockUser({ id: 'admin-1', role: 'ADMIN' });
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', createdById: 'other' });
      await expect(service.update('t1', { title: 'X' }, admin as any)).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('soft deletes by setting CANCELLED status', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', createdById: user.id });
      mockPrisma.task.update.mockResolvedValue({});
      await service.remove('t1', user as any);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TaskStatus.CANCELLED },
        }),
      );
    });

    it("refuses to cancel someone else's task", async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: 't1', createdById: 'other' });
      await expect(service.remove('t1', user as any)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });
  });
});
