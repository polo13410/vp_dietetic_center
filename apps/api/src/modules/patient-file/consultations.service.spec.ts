import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';
import { InvoicesService } from '../invoices/invoices.service';
import { PayerInvoicesService } from '../invoices/payer-invoices.service';

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
    service = new ConsultationsService(
      mockPrisma as any,
      mockAccess as any,
      new InvoicesService(mockPrisma as any, mockAccess as any, new PayerInvoicesService(mockPrisma as any, mockAccess as any)),
    );
    // The test patient of docs/REFONTE.md § 3.1: woman, 56, 1.59 m
    mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ sex: 'F', dateOfBirth: d('1970-01-01') });
    mockPrisma.measurement.findMany.mockResolvedValue([{ value: new Prisma.Decimal(159), measuredAt: d('2026-09-01') }]);
  });

  describe('create', () => {
    it("starts a session on the appointment's date and marks the appointment as done", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
        startAt: d('2026-11-20T09:00:00Z'),
        status: 'CONFIRMED',
        formulaId: null,
        practiceId: 'pr-aix',
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
          practiceId: 'pr-aix',
          paymentMethod: undefined,
          // No discount before, no price yet: no split
          discountKind: null,
          discountValue: null,
          discountReason: null,
          discountCents: null,
          netCents: null,
          payerCents: null,
          patientCents: null,
          payerId: null,
          coverageId: null,
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

    describe('from an appointment booked with a type and a practice', () => {
      const bilan = { id: 'f-bilan', practitionerId: 'user-1', label: 'Bilan', priceCents: 6000, archivedAt: null };
      beforeEach(() => {
        mockPrisma.consultation.findUnique.mockResolvedValue(null);
        mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
          startAt: d('2026-11-20T09:00:00Z'),
          status: 'SCHEDULED',
          formulaId: 'f-bilan',
          practiceId: 'pr-marseille',
        });
        mockPrisma.consultation.create.mockResolvedValue({ id: 'c1' });
        mockPrisma.consultation.count.mockResolvedValue(4);
      });

      it('inherits its type (formula and price now) and its practice', async () => {
        mockPrisma.formula.findUnique.mockResolvedValue(bilan);
        await service.create(user as any, 'p1', { appointmentId: 'a1' });
        expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({
          formulaId: 'f-bilan',
          formulaLabel: 'Bilan',
          priceCents: 6000,
          practiceId: 'pr-marseille',
        });
        // Not the « Suivi » the rule would have chosen after four sessions, nor the default practice
        expect(mockPrisma.formula.findMany).not.toHaveBeenCalled();
        expect(mockPrisma.practice.findFirst).not.toHaveBeenCalled();
      });

      it('keeps the type chosen at booking even if it is no longer offered', async () => {
        mockPrisma.formula.findUnique.mockResolvedValue({ ...bilan, archivedAt: d('2026-11-21T00:00:00Z') });
        await service.create(user as any, 'p1', { appointmentId: 'a1' });
        expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({ formulaLabel: 'Bilan' });
      });

      it('takes her default practice for a video appointment', async () => {
        mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
          startAt: d('2026-11-20T09:00:00Z'),
          status: 'SCHEDULED',
          formulaId: null,
          practiceId: null,
        });
        mockPrisma.practice.findFirst.mockResolvedValue({ id: 'pr-aix' });
        mockPrisma.formula.findMany.mockResolvedValue([]);
        await service.create(user as any, 'p1', { appointmentId: 'a1' });
        expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({ practiceId: 'pr-aix' });
      });
    });

    it('without an appointment, takes place in her default practice', async () => {
      mockPrisma.practice.findFirst.mockResolvedValue({ id: 'pr-aix' });
      mockPrisma.formula.findMany.mockResolvedValue([]);
      mockPrisma.consultation.create.mockResolvedValue({ id: 'c1' });
      await service.create(user as any, 'p1', {});
      expect(mockPrisma.practice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { practitionerId: 'user-1', archivedAt: null } }),
      );
      expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({ practiceId: 'pr-aix' });
    });

    it("refuses another practitioner's or an archived practice", async () => {
      mockPrisma.formula.findMany.mockResolvedValue([]);
      mockPrisma.practice.findUnique.mockResolvedValueOnce({ id: 'pr-x', practitionerId: 'other', archivedAt: null });
      await expect(service.create(user as any, 'p1', { practiceId: 'pr-x' })).rejects.toThrow(BadRequestException);
      mockPrisma.practice.findUnique.mockResolvedValueOnce({ id: 'pr-x', practitionerId: 'user-1', archivedAt: new Date() });
      await expect(service.create(user as any, 'p1', { practiceId: 'pr-x' })).rejects.toThrow(BadRequestException);
      expect(mockPrisma.consultation.create).not.toHaveBeenCalled();
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

    describe('prefills', () => {
      const formulas = [
        { id: 'f-bilan', label: 'Bilan', priceCents: 6000, practitionerId: 'user-1', archivedAt: null },
        { id: 'f-suivi', label: 'Suivi', priceCents: 5000, practitionerId: 'user-1', archivedAt: null },
      ];
      beforeEach(() => {
        mockPrisma.formula.findMany.mockResolvedValue(formulas.map(({ id, label }) => ({ id, label })));
        mockPrisma.formula.findUnique.mockImplementation(async ({ where }: any) =>
          formulas.find((f) => f.id === where.id),
        );
        mockPrisma.consultation.create.mockResolvedValue({ id: 'c1' });
      });

      it('chooses « Bilan » for the first session', async () => {
        mockPrisma.consultation.count.mockResolvedValue(0);
        mockPrisma.consultation.findFirst.mockResolvedValue(null);

        await service.create(user as any, 'p1', {});

        expect(mockPrisma.formula.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { practitionerId: 'user-1', archivedAt: null } }),
        );
        expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({
          formulaId: 'f-bilan',
          formulaLabel: 'Bilan',
          priceCents: 6000,
          paymentMethod: undefined,
        });
      });

      it('chooses « Suivi » after, with the patient’s last payment method', async () => {
        mockPrisma.consultation.count.mockResolvedValue(3);
        mockPrisma.consultation.findFirst.mockResolvedValue({ paymentMethod: 'CARD' });

        await service.create(user as any, 'p1', {});

        expect(mockPrisma.consultation.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ where: { patientId: 'p1', paymentMethod: { not: 'NONE' } } }),
        );
        expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({
          formulaId: 'f-suivi',
          formulaLabel: 'Suivi',
          paymentMethod: 'CARD',
        });
      });

      it('finds her formula whatever its case or accents, and leaves it empty without one', async () => {
        mockPrisma.consultation.count.mockResolvedValue(1);
        mockPrisma.formula.findMany.mockResolvedValueOnce([{ id: 'f-suivi', label: 'SUIVI (45 min)' }]);
        await service.create(user as any, 'p1', {});
        expect(mockPrisma.consultation.create.mock.calls[0][0].data.formulaId).toBe('f-suivi');

        mockPrisma.formula.findMany.mockResolvedValueOnce([{ id: 'f-x', label: 'Consultation' }]);
        await service.create(user as any, 'p1', {});
        expect(mockPrisma.consultation.create.mock.calls[1][0].data).not.toHaveProperty('formulaId');
      });

      it('keeps what is given', async () => {
        mockPrisma.consultation.count.mockResolvedValue(0);
        mockPrisma.consultation.findFirst.mockResolvedValue({ paymentMethod: 'CARD' });

        await service.create(user as any, 'p1', { formulaId: 'f-suivi', paymentMethod: 'CASH' });

        expect(mockPrisma.formula.findMany).not.toHaveBeenCalled();
        expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({
          formulaId: 'f-suivi',
          paymentMethod: 'CASH',
        });
      });
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
    it('computes each session with the height known on its date (a growing child)', async () => {
      mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ sex: 'M', dateOfBirth: d('2016-01-01') });
      mockPrisma.measurement.findMany.mockResolvedValue([
        { value: new Prisma.Decimal(125), measuredAt: d('2024-01-01') },
        { value: new Prisma.Decimal(118), measuredAt: d('2022-09-01') },
      ]);
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'bilan', date: d('2022-09-01T10:00:00Z'), advice: null, measurements: weight(22) },
        { id: 'suivi1', date: d('2024-01-10T10:00:00Z'), advice: null, measurements: weight(26) },
      ]);

      const [suivi1, bilan] = await service.list(user as any, 'p1');

      expect(bilan.figures).toMatchObject({ minor: true, height: { value: 118 }, bmi: { value: 15.8, category: null } });
      expect(suivi1.figures).toMatchObject({ height: { value: 125 }, bmi: { value: 16.64, child: { class: 'NORMAL' } } });
      expect(suivi1.figures.bmr).toMatchObject({ adultFormulaForMinor: true });
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
      mockPrisma.measurement.findMany.mockResolvedValue([]);
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
      });

      expect(mockPrisma.consultation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          habits: 'Petit-déjeuner pris tous les jours',
          sessionWork: 'Travail sur les émotions',
          advice: 'Continuer',
          paymentMethod: 'CHECK',
          date: undefined,
        },
      });
      // Texts and payment leave the split as it was
      expect(mockPrisma.patientCoverage.findMany).not.toHaveBeenCalled();
    });

    describe('discount and split (lot 16)', () => {
      const priced = { ...session, date: d('2026-11-20T09:00:00Z'), priceCents: 6000, discountKind: null, discountValue: null, discountReason: null };
      const mutuelle = {
        id: 'cov-1',
        payerId: 'payer-1',
        kind: 'PERCENT',
        value: 50,
        maxSessions: 10,
        startDate: null,
        endDate: null,
        payer: { id: 'payer-1', name: 'Mutuelle Horizon' },
      };
      beforeEach(() => mockPrisma.consultation.findUnique.mockResolvedValue(priced));

      it('a discount computes the split again, with the coverage of the session date', async () => {
        mockPrisma.patientCoverage.findMany.mockResolvedValueOnce([mutuelle]);
        mockPrisma.consultation.count.mockResolvedValueOnce(3);
        await service.update(user as any, 'c1', { discountKind: 'AMOUNT', discountValue: 1000, discountReason: 'geste' });
        expect(mockPrisma.consultation.update.mock.calls[0][0].data).toEqual({
          discountKind: 'AMOUNT',
          discountValue: 1000,
          discountReason: 'geste',
          discountCents: 1000,
          netCents: 5000,
          payerCents: 2500,
          patientCents: 2500,
          payerId: 'payer-1',
          coverageId: 'cov-1',
          date: undefined,
        });
        // The sessions already covered before this one count
        expect(mockPrisma.consultation.count).toHaveBeenCalledWith({
          where: { coverageId: 'cov-1', payerCents: { gt: 0 }, date: { lte: priced.date }, id: { not: 'c1' } },
        });
      });

      it('no kind removes the discount, its value and its reason', async () => {
        mockPrisma.consultation.findUnique.mockResolvedValue({ ...priced, discountKind: 'PERCENT', discountValue: 20, discountReason: 'geste' });
        await service.update(user as any, 'c1', { discountKind: null });
        expect(mockPrisma.consultation.update.mock.calls[0][0].data).toMatchObject({
          discountKind: null,
          discountValue: null,
          discountReason: null,
          discountCents: 0,
          netCents: 6000,
          patientCents: 6000,
        });
      });

      it('refuses more than 100 %', async () => {
        await expect(service.update(user as any, 'c1', { discountKind: 'PERCENT', discountValue: 120 })).rejects.toThrow(
          BadRequestException,
        );
      });

      it('a new session takes the discount of the previous one', async () => {
        mockPrisma.formula.findUnique.mockResolvedValue(formula);
        mockPrisma.consultation.findFirst.mockResolvedValue({ discountKind: 'PERCENT', discountValue: 100, discountReason: 'séance offerte', paymentMethod: 'CASH' });
        mockPrisma.consultation.create.mockResolvedValue({ id: 'c2' });
        await service.create(user as any, 'p1', { formulaId: 'f1' });
        expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({
          discountKind: 'PERCENT',
          discountValue: 100,
          discountReason: 'séance offerte',
          discountCents: 5000,
          netCents: 0,
          patientCents: 0,
          payerCents: 0,
        });
      });
    });

    it('moves the session to another of her practices', async () => {
      mockPrisma.practice.findUnique.mockResolvedValue({ id: 'pr-marseille', practitionerId: 'user-1', archivedAt: null });
      await service.update(user as any, 'c1', { practiceId: 'pr-marseille' });
      expect(mockPrisma.consultation.update.mock.calls[0][0].data).toMatchObject({ practiceId: 'pr-marseille' });
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
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

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
