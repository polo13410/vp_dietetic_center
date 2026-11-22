import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { ConsultationsService } from './consultations.service';

const d = (iso: string) => new Date(iso);
const weight = (kg: number) => [{ value: new Prisma.Decimal(kg) }];

describe('ConsultationsService', () => {
  let service: ConsultationsService;
  const user = createMockUser();
  const session = {
    id: 'c1',
    patientId: 'p1',
    practitionerId: 'user-1',
    appointmentId: 'a1',
    formulaId: null,
  };
  const formula = { id: 'f1', practitionerId: 'user-1', label: 'Suivi', priceCents: 5000, archivedAt: null };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConsultationsService(mockPrisma as any, mockAccess as any);
    // The test patient of docs/REFONTE.md § 3.1: woman, 56, 1.59 m
    mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ sex: 'F', dateOfBirth: d('1970-01-01') });
    mockPrisma.measurement.findFirst.mockResolvedValue({ value: new Prisma.Decimal(159) });
  });

  describe('create', () => {
    it("starts a session on the appointment's date and marks the appointment as done", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
        startAt: d('2026-11-20T09:00:00Z'),
        status: 'CONFIRMED',
      });
      mockPrisma.consultation.create.mockResolvedValue({ id: 'c1' });
      mockPrisma.appointment.update.mockResolvedValue({});

      const result = await service.create(user as any, 'p1', { appointmentId: 'a1' });

      expect(result).toEqual({ id: 'c1' });
      expect(mockAccess.assertAppointment).toHaveBeenCalledWith(user, 'a1', 'p1');
      expect(mockPrisma.consultation.create).toHaveBeenCalledWith({
        data: {
          patientId: 'p1',
          practitionerId: 'user-1',
          appointmentId: 'a1',
          date: d('2026-11-20T09:00:00Z'),
          paymentMethod: undefined,
        },
      });
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'COMPLETED' },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('copies the formula label and price, and the payment method', async () => {
      mockPrisma.formula.findUnique.mockResolvedValue(formula);
      mockPrisma.consultation.create.mockResolvedValue({ id: 'c1' });

      await service.create(user as any, 'p1', { formulaId: 'f1', paymentMethod: 'CARD' });

      expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({
        formulaId: 'f1',
        formulaLabel: 'Suivi',
        priceCents: 5000,
        paymentMethod: 'CARD',
      });
      expect(mockPrisma.appointment.update).not.toHaveBeenCalled();
    });

    it("refuses another practitioner's or an archived formula", async () => {
      mockPrisma.formula.findUnique.mockResolvedValueOnce({ ...formula, practitionerId: 'other' });
      await expect(service.create(user as any, 'p1', { formulaId: 'f1' })).rejects.toThrow(
        BadRequestException,
      );
      mockPrisma.formula.findUnique.mockResolvedValueOnce({ ...formula, archivedAt: new Date() });
      await expect(service.create(user as any, 'p1', { formulaId: 'f1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns the existing session when started again from the same appointment', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(session);
      await expect(service.create(user as any, 'p1', { appointmentId: 'a1' })).resolves.toBe(session);
      expect(mockPrisma.consultation.create).not.toHaveBeenCalled();
    });

    it('refuses a cancelled appointment', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({ startAt: new Date(), status: 'CANCELLED' });
      await expect(service.create(user as any, 'p1', { appointmentId: 'a1' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('list', () => {
    it('gives the follow-up sheet with figures, weight changes and previous advice', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'bilan', date: d('2026-09-01T10:00:00Z'), advice: 'Petit-déjeuner', measurements: weight(79) },
        { id: 'suivi1', date: d('2026-10-01T10:00:00Z'), advice: 'Collation', measurements: weight(78.2) },
        { id: 'suivi2', date: d('2026-11-01T10:00:00Z'), advice: null, measurements: weight(76.5) },
      ]);

      const rows = await service.list(user as any, 'p1');

      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
      // Latest first, without the raw weight rows
      expect(rows.map((r) => r.id)).toEqual(['suivi2', 'suivi1', 'bilan']);
      expect(rows[2]).not.toHaveProperty('measurements');
      expect(rows[2]).toMatchObject({
        sequence: 0,
        figures: { age: 56, weight: 79, bmi: { value: 31.25 }, bmr: { mj: 5.86, kcal: 1400.3 } },
        previousAdvice: null,
      });
      expect(rows[1]).toMatchObject({
        sequence: 1,
        figures: { bmr: { mj: 5.83, kcal: 1393.5 } },
        weightChange: { sincePrevious: -0.8, sinceFirst: -0.8 },
        previousAdvice: 'Petit-déjeuner',
      });
      expect(rows[0]).toMatchObject({
        figures: { bmr: { mj: 5.77, kcal: 1378.9 } },
        weightChange: { sincePrevious: -1.7, sinceFirst: -2.5 },
        previousAdvice: 'Collation',
      });
    });
  });

  describe('findOne', () => {
    it('opens a session with its figures and the advice of the previous one', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ ...session, id: 'suivi1' });
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'bilan', date: d('2026-09-01T10:00:00Z'), advice: 'Petit-déjeuner', measurements: weight(79) },
        { id: 'suivi1', date: d('2026-10-01T10:00:00Z'), advice: null, measurements: weight(78.2) },
      ]);

      const result = await service.findOne(user as any, 'suivi1');

      expect(result).toMatchObject({
        id: 'suivi1',
        patientId: 'p1',
        sequence: 1,
        figures: { weight: 78.2, bmr: { mj: 5.83, kcal: 1393.5 } },
        weightChange: { sincePrevious: -0.8 },
        previousAdvice: 'Petit-déjeuner',
      });
    });

    it('says what is missing when the height is unknown', async () => {
      mockPrisma.measurement.findFirst.mockResolvedValue(null);
      mockPrisma.consultation.findUnique.mockResolvedValue(session);
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'c1', date: d('2026-09-01T10:00:00Z'), advice: null, measurements: [] },
      ]);

      const result = await service.findOne(user as any, 'c1');

      expect(result.figures).toMatchObject({ bmi: null, bmr: null, missing: ['weight', 'height'] });
    });

    it('is not found when missing', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      await expect(service.findOne(user as any, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    beforeEach(() => mockPrisma.consultation.findUnique.mockResolvedValue(session));

    it('changes any session, even a past one', async () => {
      await service.update(user as any, 'c1', {
        habits: 'Petit-déjeuner pris tous les jours',
        sessionWork: 'Travail sur les émotions',
        advice: 'Continuer',
        paymentMethod: 'CHECK',
        date: '2026-11-20T10:00:00Z',
      });

      expect(mockPrisma.consultation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          habits: 'Petit-déjeuner pris tous les jours',
          sessionWork: 'Travail sur les émotions',
          advice: 'Continuer',
          paymentMethod: 'CHECK',
          date: d('2026-11-20T10:00:00Z'),
        },
      });
    });

    it('copies a newly chosen formula, keeps the copy for the same one, and can remove it', async () => {
      mockPrisma.formula.findUnique.mockResolvedValue(formula);
      await service.update(user as any, 'c1', { formulaId: 'f1' });
      expect(mockPrisma.consultation.update.mock.calls[0][0].data).toMatchObject({
        formulaLabel: 'Suivi',
        priceCents: 5000,
      });

      mockPrisma.consultation.findUnique.mockResolvedValue({ ...session, formulaId: 'f1' });
      await service.update(user as any, 'c1', { formulaId: 'f1' });
      expect(mockPrisma.formula.findUnique).toHaveBeenCalledTimes(1);

      await service.update(user as any, 'c1', { formulaId: null });
      expect(mockPrisma.consultation.update.mock.calls[2][0].data).toMatchObject({
        formulaId: null,
        formulaLabel: null,
        priceCents: null,
      });
    });
  });

  describe('remove', () => {
    it('deletes the session and its measurements', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(session);

      await expect(service.remove(user as any, 'c1')).resolves.toEqual({ patientId: 'p1' });

      expect(mockPrisma.measurement.deleteMany).toHaveBeenCalledWith({ where: { consultationId: 'c1' } });
      expect(mockPrisma.consultation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('checks the patient is the user’s', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(session);
      mockAccess.assertPatient.mockRejectedValueOnce(new NotFoundException());
      await expect(service.remove(user as any, 'c1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.consultation.delete).not.toHaveBeenCalled();
    });
  });
});
