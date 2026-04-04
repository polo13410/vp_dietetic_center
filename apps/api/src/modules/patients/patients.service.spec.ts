import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PatientStatus, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockPrisma } from '../../test/setup';

import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  let service: PatientsService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientsService(mockPrisma as any);
  });

  describe('findAll', () => {
    it('returns paginated patients for practitioner', async () => {
      mockPrisma.patient.count.mockResolvedValue(1);
      mockPrisma.patient.findMany.mockResolvedValue([
        { id: 'p1', firstName: 'Marie', lastName: 'Dupont', tags: [], appointments: [] },
      ]);

      const result = await service.findAll(user as any, { page: 1, limit: 20 });

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('filters by search term', async () => {
      mockPrisma.patient.count.mockResolvedValue(0);
      mockPrisma.patient.findMany.mockResolvedValue([]);

      await service.findAll(user as any, { search: 'Marie' });

      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: { contains: 'Marie', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('admin sees all patients', async () => {
      const admin = createMockUser({ role: UserRole.ADMIN });
      mockPrisma.patient.count.mockResolvedValue(0);
      mockPrisma.patient.findMany.mockResolvedValue([]);

      await service.findAll(admin as any, {});

      const call = mockPrisma.patient.findMany.mock.calls[0][0];
      expect(call.where.practitionerId).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('returns patient with relations', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: 'p1',
        practitionerId: user.id,
        tags: [{ tag: { id: 't1', name: 'Tag1', color: '#000' } }],
        _count: { appointments: 3, notes: 1, documents: 0, tasks: 2 },
      });

      const result = await service.findOne('p1', user as any);
      expect(result.tags).toEqual([{ id: 't1', name: 'Tag1', color: '#000' }]);
    });

    it('throws NotFoundException for missing patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', user as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for wrong practitioner', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: 'p1',
        practitionerId: 'other-user',
        tags: [],
      });
      await expect(service.findOne('p1', user as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates patient with tags', async () => {
      mockPrisma.patient.create.mockResolvedValue({ id: 'p1', firstName: 'Marie', tags: [] });

      await service.create(
        { firstName: 'Marie', lastName: 'Dupont', tagIds: ['t1', 't2'] },
        user as any,
      );

      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            practitionerId: user.id,
            tags: { create: expect.arrayContaining([expect.objectContaining({ tag: { connect: { id: 't1' } } })]) },
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('soft deletes by setting deletedAt and ARCHIVED status', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', practitionerId: user.id });
      mockPrisma.patient.update.mockResolvedValue({});

      await service.remove('p1', user as any);

      expect(mockPrisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            status: PatientStatus.ARCHIVED,
          }),
        }),
      );
    });
  });

  describe('findAllTags', () => {
    it('returns all tags ordered by name', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([{ id: 't1', name: 'A' }]);
      const result = await service.findAllTags();
      expect(result).toHaveLength(1);
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });
  });
});
