import { NotificationType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../test/setup';

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(mockPrisma as any);
  });

  describe('create', () => {
    it('creates a notification', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.create(
        'user-1',
        NotificationType.TASK_CREATED,
        'Title',
        'Message',
        'task',
        'task-1',
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: NotificationType.TASK_CREATED,
          title: 'Title',
          message: 'Message',
          entityType: 'task',
          entityId: 'task-1',
        },
      });
    });
  });

  describe('findAll', () => {
    it('returns all notifications for user', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      const result = await service.findAll('user-1');
      expect(result).toHaveLength(1);
    });

    it('filters unread only', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      await service.findAll('user-1', true);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ read: false }),
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('updates read to true', async () => {
      mockPrisma.notification.update.mockResolvedValue({});
      await service.markAsRead('n1');
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { read: true },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('updates all unread for user', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
      await service.markAllAsRead('user-1');
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });
});
