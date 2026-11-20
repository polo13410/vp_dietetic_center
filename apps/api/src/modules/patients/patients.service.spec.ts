import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PatientStatus, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { createMockUser, mockPrisma } from '../../test/setup';

import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  let service: PatientsService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientsService(mockPrisma as any, new PatientAccessService(mockPrisma as any));
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

    it('admin sees no patient', async () => {
      const admin = createMockUser({ role: UserRole.ADMIN });
      mockPrisma.patient.count.mockResolvedValue(0);
      mockPrisma.patient.findMany.mockResolvedValue([]);

      await service.findAll(admin as any, {});

      const call = mockPrisma.patient.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ in: [] });
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
      // The ownership check needs practitionerId; without it every non-admin got a 403
      expect(mockPrisma.patient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ practitionerId: true }),
        }),
      );
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

  describe('assistant (record-only access)', () => {
    const assistant = createMockUser({ id: 'assist-1', role: UserRole.ASSISTANTE });
    const patientRow = {
      id: 'p1',
      practitionerId: 'pract-1',
      privateNote: 'secret',
      nutritionalProfile: { allergies: 'x' },
      tags: [],
      appointments: [],
    };

    it('lists all patients without the private note', async () => {
      mockPrisma.patient.count.mockResolvedValue(1);
      mockPrisma.patient.findMany.mockResolvedValue([patientRow]);

      const result = await service.findAll(assistant as any, {});

      const call = mockPrisma.patient.findMany.mock.calls[0][0];
      expect(call.where.practitionerId).toBeUndefined();
      expect(result.data[0]).not.toHaveProperty('privateNote');
      expect(result.data[0]).toHaveProperty('id', 'p1');
    });

    it('reads any patient record without clinical fields', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(patientRow);

      const result = await service.findOne('p1', assistant as any);

      expect(result).not.toHaveProperty('privateNote');
      expect(result).not.toHaveProperty('nutritionalProfile');
    });

    it('keeps clinical fields for the owning practitioner', async () => {
      const owner = createMockUser({ id: 'pract-1' });
      mockPrisma.patient.findUnique.mockResolvedValue(patientRow);

      const result = await service.findOne('p1', owner as any);

      expect(result).toHaveProperty('privateNote', 'secret');
      expect(result).toHaveProperty('nutritionalProfile');
    });

    it('cannot update or archive a patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(patientRow);
      await expect(service.update('p1', { firstName: 'X' }, assistant as any)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove('p1', assistant as any)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.patient.update).not.toHaveBeenCalled();
    });

    it('does not see clinical notes in the timeline', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(patientRow);
      mockPrisma.appointment.findMany.mockResolvedValue([]);
      mockPrisma.clinicalNote.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);

      await service.getTimeline('p1', assistant as any);

      expect(mockPrisma.clinicalNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [] } } }),
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
