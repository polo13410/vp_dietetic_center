import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { createMockUser, mockPrisma } from '../../test/setup';

import { NutritionalService } from './nutritional.service';

const prisma = {
  ...mockPrisma,
  nutritionalProfile: { upsert: vi.fn() },
  nutritionalEntry: { findMany: vi.fn(), upsert: vi.fn() },
};

describe('NutritionalService', () => {
  let service: NutritionalService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NutritionalService(prisma as any, new PatientAccessService(prisma as any));
  });

  describe("another practitioner's patient", () => {
    beforeEach(() => {
      prisma.patient.findUnique.mockResolvedValue({ practitionerId: 'other' });
    });

    it('cannot read the profile', async () => {
      await expect(service.getProfile('p1', user as any)).rejects.toThrow(ForbiddenException);
      expect(prisma.nutritionalProfile.upsert).not.toHaveBeenCalled();
    });

    it('cannot update the profile', async () => {
      await expect(
        service.updateProfile('p1', { objectives: 'x' }, user as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.nutritionalProfile.upsert).not.toHaveBeenCalled();
    });

    it('cannot list entries', async () => {
      await expect(service.getEntries('p1', user as any)).rejects.toThrow(ForbiddenException);
      expect(prisma.nutritionalEntry.findMany).not.toHaveBeenCalled();
    });

    it('cannot create entries', async () => {
      await expect(
        service.createEntry('p1', { date: '2026-11-19' }, user as any),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.nutritionalEntry.upsert).not.toHaveBeenCalled();
    });
  });

  describe('own patient', () => {
    beforeEach(() => {
      prisma.patient.findUnique.mockResolvedValue({ practitionerId: user.id });
    });

    it('upserts the entry for the patient and day', async () => {
      prisma.nutritionalEntry.upsert.mockResolvedValue({ id: 'e1' });
      await service.createEntry('p1', { date: '2026-11-19', mood: 7 }, user as any);
      const date = new Date('2026-11-19');
      expect(prisma.nutritionalEntry.upsert).toHaveBeenCalledWith({
        where: { patientId_date: { patientId: 'p1', date } },
        update: { date, mood: 7 },
        create: { patientId: 'p1', date, mood: 7 },
      });
    });

    it('filters entries by date range', async () => {
      prisma.nutritionalEntry.findMany.mockResolvedValue([]);
      await service.getEntries('p1', user as any, '2026-01-01', '2026-02-01');
      expect(prisma.nutritionalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            patientId: 'p1',
            date: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
          },
        }),
      );
    });
  });
});
