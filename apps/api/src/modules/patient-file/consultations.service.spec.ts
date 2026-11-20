import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { ConsultationsService } from './consultations.service';
import { PatientFileService } from './patient-file.service';

describe('ConsultationsService', () => {
  let service: ConsultationsService;
  const user = createMockUser();
  const draft = { id: 'c1', patientId: 'p1', status: 'DRAFT', appointmentId: 'a1' };

  beforeEach(() => {
    vi.clearAllMocks();
    const file = new PatientFileService(mockPrisma as any, mockAccess as any);
    service = new ConsultationsService(mockPrisma as any, mockAccess as any, file);
  });

  describe('create', () => {
    it("starts a session on the appointment's date, for the patient's practitioner", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
        startAt: new Date('2026-11-20T09:00:00Z'),
        status: 'CONFIRMED',
      });
      mockPrisma.consultation.create.mockResolvedValue({ id: 'c1' });

      await service.create(user as any, 'p1', { appointmentId: 'a1' });

      expect(mockAccess.assertAppointment).toHaveBeenCalledWith(user, 'a1', 'p1');
      expect(mockPrisma.consultation.create).toHaveBeenCalledWith({
        data: {
          patientId: 'p1',
          practitionerId: 'user-1',
          appointmentId: 'a1',
          date: new Date('2026-11-20T09:00:00Z'),
        },
      });
    });

    it('returns the existing session when started again from the same appointment', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(draft);
      await expect(service.create(user as any, 'p1', { appointmentId: 'a1' })).resolves.toBe(draft);
      expect(mockPrisma.consultation.create).not.toHaveBeenCalled();
    });

    it('refuses a cancelled appointment', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
        startAt: new Date(),
        status: 'CANCELLED',
      });
      await expect(service.create(user as any, 'p1', { appointmentId: 'a1' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('finalize', () => {
    it('locks the session and marks its appointment as done', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(draft);
      mockPrisma.consultation.update.mockResolvedValue({ ...draft, status: 'FINALIZED' });
      mockPrisma.appointment.update.mockResolvedValue({});

      const result = await service.finalize(user as any, 'c1');

      expect(result.status).toBe('FINALIZED');
      expect(mockPrisma.consultation.update.mock.calls[0][0].data).toMatchObject({
        status: 'FINALIZED',
        finalizedAt: expect.any(Date),
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('cannot change a finalized session', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ ...draft, status: 'FINALIZED' });
      await expect(service.update(user as any, 'c1', { summary: 'x' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove(user as any, 'c1')).rejects.toThrow(BadRequestException);
    });
  });

  it('puts goals reviewed in a discarded draft back to their previous status', async () => {
    mockPrisma.consultation.findUnique.mockResolvedValue(draft);
    mockPrisma.goalReview.findMany.mockResolvedValue([{ goalId: 'g1' }, { goalId: 'g2' }]);
    mockPrisma.goalReview.findFirst
      .mockResolvedValueOnce({ status: 'PARTIAL' }) // g1 was reviewed before
      .mockResolvedValueOnce(null); // g2 never was
    await service.remove(user as any, 'c1');
    expect(mockPrisma.goal.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { status: 'PARTIAL', closedAt: null },
    });
    expect(mockPrisma.goal.update).toHaveBeenCalledWith({
      where: { id: 'g2' },
      data: { status: 'IN_PROGRESS', closedAt: null },
    });
  });

  it('discards a draft with everything recorded during it', async () => {
    mockPrisma.consultation.findUnique.mockResolvedValue(draft);
    mockPrisma.goalReview.findMany.mockResolvedValue([]);
    await service.remove(user as any, 'c1');
    for (const model of ['measurement', 'topicNote', 'lifeEvent', 'goal'] as const) {
      expect(mockPrisma[model].deleteMany).toHaveBeenCalledWith({ where: { consultationId: 'c1' } });
    }
    expect(mockPrisma.consultation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  describe('reviewGoal', () => {
    it('records the review and moves the goal to that status', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(draft);
      mockPrisma.goal.findUnique.mockResolvedValue({ id: 'g1', patientId: 'p1' });
      mockPrisma.goalReview.upsert.mockResolvedValue({ id: 'r1' });
      mockPrisma.goal.update.mockResolvedValue({});

      await service.reviewGoal(user as any, 'c1', 'g1', { status: 'ACHIEVED', comment: 'Bravo' });

      expect(mockPrisma.goalReview.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { goalId_consultationId: { goalId: 'g1', consultationId: 'c1' } },
        }),
      );
      expect(mockPrisma.goal.update.mock.calls[0][0].data).toMatchObject({
        status: 'ACHIEVED',
        closedAt: expect.any(Date),
      });
    });

    it("refuses another patient's goal", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(draft);
      mockPrisma.goal.findUnique.mockResolvedValue({ id: 'g1', patientId: 'p2' });
      await expect(
        service.reviewGoal(user as any, 'c1', 'g1', { status: 'PARTIAL' }),
      ).rejects.toThrow();
      expect(mockPrisma.goalReview.upsert).not.toHaveBeenCalled();
    });
  });
});
