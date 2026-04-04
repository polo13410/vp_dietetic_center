import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NoteStatus, NoteType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockNotifications, mockPrisma } from '../../test/setup';

import { NotesService } from './notes.service';

describe('NotesService', () => {
  let service: NotesService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotesService(mockPrisma as any, mockNotifications as any);
  });

  describe('create', () => {
    it('creates a draft note', async () => {
      mockPrisma.clinicalNote.create.mockResolvedValue({ id: 'n1', status: NoteStatus.DRAFT });

      await service.create(
        { patientId: 'p1', type: NoteType.FREE, content: 'Test content' },
        user as any,
      );

      expect(mockPrisma.clinicalNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorId: user.id,
            status: NoteStatus.DRAFT,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('allows updating a draft note', async () => {
      mockPrisma.clinicalNote.findUnique.mockResolvedValue({
        id: 'n1',
        authorId: user.id,
        status: NoteStatus.DRAFT,
      });
      mockPrisma.clinicalNote.update.mockResolvedValue({});

      await service.update('n1', { content: 'Updated' }, user as any);
      expect(mockPrisma.clinicalNote.update).toHaveBeenCalled();
    });

    it('throws when updating a finalized note', async () => {
      mockPrisma.clinicalNote.findUnique.mockResolvedValue({
        id: 'n1',
        authorId: user.id,
        status: NoteStatus.FINALIZED,
      });

      await expect(service.update('n1', { content: 'Updated' }, user as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('finalize', () => {
    it('locks the note and sets finalizedAt', async () => {
      mockPrisma.clinicalNote.findUnique.mockResolvedValue({
        id: 'n1',
        authorId: user.id,
        status: NoteStatus.DRAFT,
        title: 'Test',
      });
      mockPrisma.clinicalNote.update.mockResolvedValue({});

      await service.finalize('n1', user as any);

      expect(mockPrisma.clinicalNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: NoteStatus.FINALIZED,
            finalizedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws when already finalized', async () => {
      mockPrisma.clinicalNote.findUnique.mockResolvedValue({
        id: 'n1',
        authorId: user.id,
        status: NoteStatus.FINALIZED,
      });

      await expect(service.finalize('n1', user as any)).rejects.toThrow(BadRequestException);
    });

    it('creates a notification on finalize', async () => {
      mockPrisma.clinicalNote.findUnique.mockResolvedValue({
        id: 'n1',
        authorId: user.id,
        status: NoteStatus.DRAFT,
        title: 'Session 1',
      });
      mockPrisma.clinicalNote.update.mockResolvedValue({});

      await service.finalize('n1', user as any);
      expect(mockNotifications.create).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws when deleting a finalized note', async () => {
      mockPrisma.clinicalNote.findUnique.mockResolvedValue({
        id: 'n1',
        authorId: user.id,
        status: NoteStatus.FINALIZED,
      });

      await expect(service.remove('n1', user as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.clinicalNote.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', user as any)).rejects.toThrow(NotFoundException);
    });
  });
});
