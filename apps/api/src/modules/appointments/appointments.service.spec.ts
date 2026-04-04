import { NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockNotifications, mockPrisma } from '../../test/setup';

import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AppointmentsService(mockPrisma as any, mockNotifications as any);
  });

  describe('findAll', () => {
    it('returns paginated appointments', async () => {
      mockPrisma.appointment.count.mockResolvedValue(5);
      mockPrisma.appointment.findMany.mockResolvedValue([{ id: 'a1' }]);

      const result = await service.findAll(user as any, { page: 1, limit: 10 });
      expect(result.meta.total).toBe(5);
      expect(result.data).toHaveLength(1);
    });

    it('filters by date range', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.findAll(user as any, { from: '2024-01-01', to: '2024-12-31' });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('computes endAt from startAt + duration', async () => {
      const patient = { id: 'p1', firstName: 'Marie', lastName: 'Dupont' };
      mockPrisma.appointment.create.mockResolvedValue({ id: 'a1', patient });

      await service.create(
        { patientId: 'p1', startAt: '2024-06-15T10:00:00Z', duration: 45, type: 'IN_PERSON' as any },
        user as any,
      );

      const call = mockPrisma.appointment.create.mock.calls[0][0];
      const startAt = new Date('2024-06-15T10:00:00Z');
      const expectedEnd = new Date(startAt.getTime() + 45 * 60 * 1000);
      expect(call.data.endAt).toEqual(expectedEnd);
    });

    it('creates a notification', async () => {
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'a1',
        patient: { id: 'p1', firstName: 'M', lastName: 'D' },
      });

      await service.create(
        { patientId: 'p1', startAt: '2024-06-15T10:00:00Z', duration: 30, type: 'IN_PERSON' as any },
        user as any,
      );

      expect(mockNotifications.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', user as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('sets status to CANCELLED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({ id: 'a1', practitionerId: user.id });
      mockPrisma.appointment.update.mockResolvedValue({});

      await service.remove('a1', user as any);

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AppointmentStatus.CANCELLED },
        }),
      );
    });
  });
});
