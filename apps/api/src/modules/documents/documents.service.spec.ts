import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { createMockUser, mockPrisma } from '../../test/setup';

import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  const user = createMockUser();
  const admin = createMockUser({ id: 'admin-1', role: 'ADMIN' });

  beforeEach(() => {
    vi.clearAllMocks();
    // Real access rules on top of the mocked Prisma client
    service = new DocumentsService(
      mockPrisma as any,
      new PatientAccessService(mockPrisma as any),
    );
  });

  describe('findAll', () => {
    it("scopes documents to the practitioner's patients", async () => {
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1' }]);
      const result = await service.findAll(user as any, 'p1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            patientId: 'p1',
            patient: { deletedAt: null, practitionerId: user.id },
          },
        }),
      );
    });

    it('gives admins no documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      await service.findAll(admin as any);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, patient: { deletedAt: null, id: { in: [] } } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', user as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejects a document of another practitioner's patient", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        patient: { practitionerId: 'other' },
      });
      await expect(service.findOne('d1', user as any)).rejects.toThrow(ForbiddenException);
    });

    it('returns the document without the ownership join', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        patient: { practitionerId: user.id },
      });
      await expect(service.findOne('d1', user as any)).resolves.toEqual({ id: 'd1' });
    });
  });

  describe('assertCanUpload', () => {
    it("rejects uploads to another practitioner's patient", async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ practitionerId: 'other' });
      await expect(service.assertCanUpload(user as any, 'p1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('creates document with uploadedById', async () => {
      mockPrisma.document.create.mockResolvedValue({ id: 'd1' });
      await service.create(
        { patientId: 'p1', name: 'Test', originalName: 'test.pdf', type: 'OTHER' as any, mimeType: 'application/pdf', sizeBytes: 1024, gcsPath: 'path/file.pdf' },
        user as any,
      );
      expect(mockPrisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ uploadedById: user.id }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('soft deletes by setting deletedAt', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        patient: { practitionerId: user.id },
      });
      mockPrisma.document.update.mockResolvedValue({});
      await service.remove('d1', user as any);
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it("refuses to delete another practitioner's document", async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'd1',
        patient: { practitionerId: 'other' },
      });
      await expect(service.remove('d1', user as any)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.document.update).not.toHaveBeenCalled();
    });
  });
});
