import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { PatientFileService } from './patient-file.service';

const d = (iso: string) => new Date(iso);
const dec = (n: number) => new Prisma.Decimal(n);

describe('PatientFileService', () => {
  let service: PatientFileService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientFileService(mockPrisma as any, mockAccess as any);
  });

  describe('getBrief', () => {
    beforeEach(() => {
      mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ id: 'p1', allergies: 'arachides' });
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'c2', date: d('2026-11-01'), summary: 'Séance 2' },
        { id: 'c1', date: d('2026-10-01'), summary: 'Séance 1' },
      ]);
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'a3', startAt: d('2026-12-01') });
      mockPrisma.measurement.findMany.mockResolvedValue([
        { type: 'HEIGHT', value: dec(170), measuredAt: d('2026-10-01') },
        { type: 'WEIGHT', value: dec(95), measuredAt: d('2026-10-01') },
        { type: 'WEIGHT', value: dec(92), measuredAt: d('2026-10-15') },
        { type: 'WEIGHT', value: dec(90), measuredAt: d('2026-11-01') },
      ]);
      mockPrisma.topicNote.findMany.mockResolvedValue([
        { id: 't3', topic: 'EATING', content: 'Petit-déjeuner tous les jours', createdAt: d('2026-11-01') },
        { id: 't2', topic: 'SLEEP', content: 'Dort mieux', createdAt: d('2026-10-20') },
        { id: 't1', topic: 'EATING', content: 'Saute le petit-déjeuner', createdAt: d('2026-10-01') },
      ]);
      mockPrisma.lifeEvent.findMany.mockResolvedValue([
        { id: 'e2', date: d('2026-11-10'), title: 'Nouveau travail' },
        { id: 'e1', date: d('2026-10-05'), title: 'Déménagement' },
      ]);
      mockPrisma.goal.findMany.mockResolvedValue([{ id: 'g1', title: 'Marcher 30 min' }]);
      mockPrisma.task.findMany.mockResolvedValue([]);
    });

    it('checks the patient is the user’s, with clinical access', async () => {
      await service.getBrief(user as any, 'p1');
      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
    });

    it('summarizes each measurement: first, previous and latest', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      const weight = brief.metrics.find((m) => m.type === 'WEIGHT')!;
      expect(weight.count).toBe(3);
      expect(weight.first.value).toBe(95);
      expect(weight.previous?.value).toBe(92);
      expect(weight.latest.value).toBe(90);
    });

    it('computes the BMI now and at the start, with its category', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.bmi.current).toEqual({ value: 31.1, category: 'OBESITY' });
      expect(brief.bmi.atStart).toEqual({ value: 32.9, category: 'OBESITY' });
    });

    it('keeps the latest note of each topic as its current state', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.topics.map((t) => t.id)).toEqual(['t3', 't2']);
    });

    it('only lists goals to review that were set in a finished session (or outside one)', async () => {
      await service.getBrief(user as any, 'p1');
      expect(mockPrisma.goal.findMany.mock.calls[0][0].where.OR).toEqual([
        { consultationId: null },
        { consultation: { status: 'FINALIZED' } },
      ]);
    });

    it('counts the life events since the last session and the sessions done', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.newEventsSinceLastConsultation).toBe(1);
      expect(brief.consultationCount).toBe(2);
      expect(brief.lastConsultation?.id).toBe('c2');
      expect(brief.firstConsultationAt).toEqual(d('2026-10-01'));
    });
  });

  describe('bmiFor', () => {
    it('uses the latest weight and height of each patient', async () => {
      mockPrisma.measurement.findMany.mockResolvedValue([
        { patientId: 'p1', type: 'HEIGHT', value: dec(175) },
        { patientId: 'p1', type: 'WEIGHT', value: dec(70) },
        { patientId: 'p2', type: 'WEIGHT', value: dec(60) }, // no height: no BMI
      ]);
      const bmi = await service.bmiFor(['p1', 'p2']);
      expect(bmi.get('p1')).toEqual({ value: 22.9, category: 'NORMAL' });
      expect(bmi.has('p2')).toBe(false);
    });

    it('does not query without patients', async () => {
      await service.bmiFor([]);
      expect(mockPrisma.measurement.findMany).not.toHaveBeenCalled();
    });
  });

  describe('measurements', () => {
    it('rejects implausible values', async () => {
      await expect(
        service.createMeasurement(user as any, 'p1', { type: 'WEIGHT', value: 720 } as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createMeasurement(user as any, 'p1', { type: 'ENERGY', value: 11 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.measurement.create).not.toHaveBeenCalled();
    });

    it('dates a measurement taken in a session with the session date', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        patientId: 'p1',
        status: 'DRAFT',
        date: d('2026-11-20T10:00:00Z'),
      });
      mockPrisma.measurement.create.mockResolvedValue({ id: 'm1', value: dec(72.5) });

      const result = await service.createMeasurement(user as any, 'p1', {
        type: 'WEIGHT',
        value: 72.5,
        consultationId: 'c1',
      } as any);

      expect(mockPrisma.measurement.create.mock.calls[0][0].data.measuredAt).toEqual(
        d('2026-11-20T10:00:00Z'),
      );
      expect(result.value).toBe(72.5);
    });

    it("refuses a session of another patient or a finalized one", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValueOnce({ patientId: 'p2', status: 'DRAFT' });
      await expect(
        service.createMeasurement(user as any, 'p1', {
          type: 'WEIGHT',
          value: 70,
          consultationId: 'c1',
        } as any),
      ).rejects.toThrow(BadRequestException);

      mockPrisma.consultation.findUnique.mockResolvedValueOnce({
        patientId: 'p1',
        status: 'FINALIZED',
      });
      await expect(
        service.createMeasurement(user as any, 'p1', {
          type: 'WEIGHT',
          value: 70,
          consultationId: 'c1',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('locks measurements of a finalized session', async () => {
      mockPrisma.measurement.findUnique.mockResolvedValue({
        id: 'm1',
        patientId: 'p1',
        type: 'WEIGHT',
        consultation: { status: 'FINALIZED' },
      });
      await expect(service.removeMeasurement(user as any, 'p1', 'm1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.measurement.delete).not.toHaveBeenCalled();
    });

    it("hides another patient's measurement", async () => {
      mockPrisma.measurement.findUnique.mockResolvedValue({
        id: 'm1',
        patientId: 'p2',
        consultation: null,
      });
      await expect(
        service.updateMeasurement(user as any, 'p1', 'm1', { value: 70 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('goals', () => {
    it('closes a goal when it is achieved, and reopens it', async () => {
      mockPrisma.goal.findUnique.mockResolvedValue({ id: 'g1', patientId: 'p1' });
      mockPrisma.goal.update.mockResolvedValue({});

      await service.updateGoal(user as any, 'p1', 'g1', { status: 'ACHIEVED' });
      expect(mockPrisma.goal.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);

      await service.updateGoal(user as any, 'p1', 'g1', { status: 'IN_PROGRESS' });
      expect(mockPrisma.goal.update.mock.calls[1][0].data.closedAt).toBeNull();
    });
  });
});
