import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockPrisma } from '../../test/setup';

import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentsService(mockPrisma as any);
  });

  describe('findAll', () => {
    it('returns documents filtered by patientId', async () => {
      mockPrisma.document.findMany.mockResolvedValue([{ id: 'd1' }]);
      const result = await service.findAll('p1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientId: 'p1', deletedAt: null }),
        }),
      );
    });

    it('returns all documents when no patientId', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      await service.findAll();
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
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
      mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1' });
      mockPrisma.document.update.mockResolvedValue({});
      await service.remove('d1');
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
