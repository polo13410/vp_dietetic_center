import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { createMockUser, mockPrisma } from '../../test/setup';
import { PatientFileService } from '../patient-file/patient-file.service';

import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  let service: PatientsService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    const access = new PatientAccessService(mockPrisma as any);
    mockPrisma.measurement.findMany.mockResolvedValue([]);
    service = new PatientsService(
      mockPrisma as any,
      access,
      new PatientFileService(mockPrisma as any, access),
      { forPatient: vi.fn() } as any,
    );
  });

  describe('findAll', () => {
    it('returns paginated patients for practitioner', async () => {
      mockPrisma.patient.count.mockResolvedValue(1);
      mockPrisma.patient.findMany.mockResolvedValue([
        { id: 'p1', firstName: 'Marie', lastName: 'Dupont', appointments: [] },
      ]);

      const result = await service.findAll(user as any, { page: 1, limit: 20 });

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
      // Current patients only by default
      expect(mockPrisma.patient.findMany.mock.calls[0][0].where.archivedAt).toBeNull();
    });

    it('lists archived patients apart', async () => {
      mockPrisma.patient.count.mockResolvedValue(0);
      mockPrisma.patient.findMany.mockResolvedValue([]);

      await service.findAll(user as any, { archived: true });

      expect(mockPrisma.patient.findMany.mock.calls[0][0].where.archivedAt).toEqual({ not: null });
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
        _count: { appointments: 3, consultations: 1, documents: 0, tasks: 2 },
      });

      const result = await service.findOne('p1', user as any);
      expect(result).toHaveProperty('bmi', null);
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
      });
      await expect(service.findOne('p1', user as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it("creates the patient for the practitioner, with her sheet's fields", async () => {
      mockPrisma.patient.create.mockResolvedValue({ id: 'p1' });

      await service.create(
        {
          firstName: 'Marie',
          lastName: 'Dupont',
          sex: 'F',
          dateOfBirth: '1970-06-15',
          familySituation: 'Mariée, deux enfants',
          profession: 'Infirmière',
          gpName: 'Dr Martin',
        },
        user as any,
      );

      expect(mockPrisma.patient.create.mock.calls[0][0].data).toEqual({
        firstName: 'Marie',
        lastName: 'Dupont',
        sex: 'F',
        dateOfBirth: new Date('1970-06-15'),
        birthDateEstimated: false,
        familySituation: 'Mariée, deux enfants',
        profession: 'Infirmière',
        gpName: 'Dr Martin',
        practitionerId: user.id,
      });
    });

    it('stores an estimated birth year when only the age is known', async () => {
      vi.useFakeTimers({ now: new Date('2026-11-22T10:00:00Z') });
      mockPrisma.patient.create.mockResolvedValue({ id: 'p1' });

      await service.create({ firstName: 'Marie', lastName: 'Dupont', age: 56 }, user as any);

      expect(mockPrisma.patient.create.mock.calls[0][0].data).toMatchObject({
        dateOfBirth: new Date('1970-01-01T00:00:00Z'),
        birthDateEstimated: true,
      });
      vi.useRealTimers();
    });

    it('refuses both a birth date and an age', async () => {
      await expect(
        service.create(
          { firstName: 'M', lastName: 'D', dateOfBirth: '1970-06-15', age: 56 },
          user as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('clears an estimated birth date when the real one is given', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', practitionerId: user.id });
      mockPrisma.patient.update.mockResolvedValue({});

      await service.update('p1', { dateOfBirth: '1970-06-15' }, user as any);

      expect(mockPrisma.patient.update.mock.calls[0][0].data).toEqual({
        dateOfBirth: new Date('1970-06-15'),
        birthDateEstimated: false,
      });
    });

    it('can remove the birth date', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', practitionerId: user.id });
      mockPrisma.patient.update.mockResolvedValue({});

      await service.update('p1', { dateOfBirth: null }, user as any);

      expect(mockPrisma.patient.update.mock.calls[0][0].data).toEqual({
        dateOfBirth: null,
        birthDateEstimated: false,
      });
    });
  });

  describe('archive', () => {
    it('archives, keeping the first archiving date', async () => {
      const archivedAt = new Date('2026-01-01');
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', practitionerId: user.id, archivedAt });
      mockPrisma.patient.update.mockResolvedValue({});

      await service.setArchived('p1', true, user as any);

      expect(mockPrisma.patient.update.mock.calls[0][0].data).toEqual({ archivedAt });
    });

    it('archives and unarchives', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', practitionerId: user.id, archivedAt: null });
      mockPrisma.patient.update.mockResolvedValue({});

      await service.setArchived('p1', true, user as any);
      await service.setArchived('p1', false, user as any);

      expect(mockPrisma.patient.update.mock.calls[0][0].data).toEqual({ archivedAt: expect.any(Date) });
      expect(mockPrisma.patient.update.mock.calls[1][0].data).toEqual({ archivedAt: null });
    });
  });

  describe('remove', () => {
    it('soft deletes by setting deletedAt', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'p1', practitionerId: user.id });
      mockPrisma.patient.update.mockResolvedValue({});

      await service.remove('p1', user as any);

      expect(mockPrisma.patient.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('assistant (record-only access)', () => {
    const assistant = createMockUser({ id: 'assist-1', role: UserRole.ASSISTANTE });
    const patientRow = {
      id: 'p1',
      practitionerId: 'pract-1',
      consultationReason: 'Perte de poids',
      appointments: [],
    };

    it('lists all patients without clinical fields', async () => {
      mockPrisma.patient.count.mockResolvedValue(1);
      mockPrisma.patient.findMany.mockResolvedValue([patientRow]);

      const result = await service.findAll(assistant as any, {});

      const call = mockPrisma.patient.findMany.mock.calls[0][0];
      expect(call.where.practitionerId).toBeUndefined();
      expect(result.data[0]).not.toHaveProperty('consultationReason');
      expect(result.data[0]).toHaveProperty('id', 'p1');
    });

    it('reads any patient record without clinical fields', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(patientRow);

      const result = await service.findOne('p1', assistant as any);

      expect(result).not.toHaveProperty('consultationReason');
      expect(result).not.toHaveProperty('bmi');
    });

    it('keeps clinical fields for the owning practitioner', async () => {
      const owner = createMockUser({ id: 'pract-1' });
      mockPrisma.patient.findUnique.mockResolvedValue(patientRow);

      const result = await service.findOne('p1', owner as any);

      expect(result).toHaveProperty('consultationReason', 'Perte de poids');
    });

    it('cannot update or archive a patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(patientRow);
      await expect(service.update('p1', { firstName: 'X' }, assistant as any)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove('p1', assistant as any)).rejects.toThrow(ForbiddenException);
      await expect(service.setArchived('p1', true, assistant as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.patient.update).not.toHaveBeenCalled();
    });
  });
});
