import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AppointmentsService(mockPrisma as any, mockAccess as any);
  });

  describe('findAll', () => {
    it('returns paginated appointments', async () => {
      mockPrisma.appointment.count.mockResolvedValue(5);
      mockPrisma.appointment.findMany.mockResolvedValue([{ id: 'a1' }]);

      const result = await service.findAll(user as any, { page: 1, limit: 10 });
      expect(result.meta.total).toBe(5);
      expect(result.data).toHaveLength(1);
    });

    it('filters by date range', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0);
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      await service.findAll(user as any, { from: '2024-01-01', to: '2024-12-31' });

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it("refuses to book for another practitioner's patient", async () => {
      mockAccess.assertPatient.mockRejectedValueOnce(new ForbiddenException());
      await expect(
        service.create(
          { patientId: 'p1', startAt: '2026-12-01T10:00:00.000Z', duration: 60, type: 'IN_PERSON' as any },
          user as any,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1', 'record');
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('computes endAt from startAt + duration', async () => {
      const patient = { id: 'p1', firstName: 'Marie', lastName: 'Dupont' };
      mockPrisma.appointment.create.mockResolvedValue({ id: 'a1', patient });

      await service.create(
        { patientId: 'p1', startAt: '2024-06-15T10:00:00Z', duration: 45, type: 'IN_PERSON' as any },
        user as any,
      );

      const call = mockPrisma.appointment.create.mock.calls[0][0];
      const startAt = new Date('2024-06-15T10:00:00Z');
      const expectedEnd = new Date(startAt.getTime() + 45 * 60 * 1000);
      expect(call.data.endAt).toEqual(expectedEnd);
    });
  });

  describe('assistant', () => {
    const assistant = createMockUser({ id: 'assist-1', role: 'ASSISTANTE' });

    it("books for the patient's practitioner", async () => {
      mockAccess.assertPatient.mockResolvedValueOnce({ practitionerId: 'pract-1' });
      mockPrisma.appointment.create.mockResolvedValue({
        id: 'a1',
        patient: { id: 'p1', firstName: 'M', lastName: 'D' },
      });

      await service.create(
        { patientId: 'p1', startAt: '2026-12-01T10:00:00Z', duration: 30, type: 'IN_PERSON' as any },
        assistant as any,
      );

      expect(mockAccess.assertPatient).toHaveBeenCalledWith(assistant, 'p1', 'record');
      expect(mockPrisma.appointment.create.mock.calls[0][0].data.practitionerId).toBe('pract-1');
    });

    it('lists every appointment without the session link', async () => {
      mockPrisma.appointment.count.mockResolvedValue(1);
      mockPrisma.appointment.findMany.mockResolvedValue([
        { id: 'a1', practitionerId: 'pract-1', consultation: { id: 'c1' } },
      ]);

      const result = await service.findAll(assistant as any, {});

      expect(mockPrisma.appointment.findMany.mock.calls[0][0].where.practitionerId).toBeUndefined();
      expect(result.data[0]).not.toHaveProperty('consultation');
    });

    it('sees an appointment without its session record', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        practitionerId: 'pract-1',
        consultation: { id: 'c1' },
      });

      const result = await service.findOne('a1', assistant as any);

      expect(result).not.toHaveProperty('consultation');
    });

    it('can reschedule', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        practitionerId: 'pract-1',
        patientId: 'p1',
        duration: 30,
      });
      mockPrisma.appointment.update.mockResolvedValue({});

      await service.update('a1', { startAt: '2026-12-02T10:00:00Z' }, assistant as any);
      expect(mockPrisma.appointment.update).toHaveBeenCalled();
    });

    it("moves the appointment to the new patient's practitioner", async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'a1',
        practitionerId: 'pract-1',
        patientId: 'p1',
        startAt: new Date('2026-12-02T10:00:00Z'),
        duration: 30,
        type: 'IN_PERSON',
        formulaId: 'f-of-pract-1',
        practiceId: 'pr-of-pract-1',
      });
      mockAccess.assertPatient.mockResolvedValueOnce({ practitionerId: 'pract-2' });
      mockPrisma.practice.findFirst.mockResolvedValue({ id: 'pr-of-pract-2' });
      mockPrisma.appointment.update.mockResolvedValue({});

      await service.update('a1', { patientId: 'p2' }, assistant as any);

      // Her own type and practice, not the previous practitioner's
      expect(mockPrisma.appointment.update.mock.calls[0][0].data).toMatchObject({
        practitionerId: 'pract-2',
        formulaId: null,
        practiceId: 'pr-of-pract-2',
      });
    });
  });

  describe('type of appointment and practice', () => {
    const suivi = { id: 'f-suivi', practitionerId: 'user-1', label: 'Suivi', durationMinutes: 45, archivedAt: null };
    const marseille = { id: 'pr-marseille', practitionerId: 'user-1', archivedAt: null };
    const base = { patientId: 'p1', startAt: '2026-12-01T10:00:00.000Z', type: 'IN_PERSON' as any };
    const created = () => mockPrisma.appointment.create.mock.calls[0][0].data;

    beforeEach(() => {
      mockPrisma.appointment.create.mockResolvedValue({ id: 'a1' });
      mockPrisma.formula.findUnique.mockResolvedValue(suivi);
      mockPrisma.practice.findUnique.mockResolvedValue(marseille);
      mockPrisma.practice.findFirst.mockResolvedValue({ id: 'pr-aix' });
    });

    it('takes the duration of the type, and places it in her default practice', async () => {
      await service.create({ ...base, formulaId: 'f-suivi' }, user as any);
      expect(created()).toMatchObject({
        formulaId: 'f-suivi',
        duration: 45,
        endAt: new Date('2026-12-01T10:45:00.000Z'),
        practiceId: 'pr-aix',
        reason: null,
      });
    });

    it('keeps a duration changed by hand, the practice chosen and the note', async () => {
      await service.create(
        { ...base, formulaId: 'f-suivi', duration: 60, practiceId: 'pr-marseille', reason: 'Apporter ses analyses' },
        user as any,
      );
      expect(created()).toMatchObject({
        duration: 60,
        practiceId: 'pr-marseille',
        reason: 'Apporter ses analyses',
      });
    });

    it('takes place in no practice by video or phone', async () => {
      await service.create({ ...base, type: 'VIDEO' as any, formulaId: 'f-suivi', practiceId: 'pr-marseille' }, user as any);
      expect(created()).toMatchObject({ type: 'VIDEO', practiceId: null });
      expect(mockPrisma.practice.findFirst).not.toHaveBeenCalled();
    });

    it("refuses another practitioner's or an archived type or practice", async () => {
      mockPrisma.formula.findUnique.mockResolvedValueOnce({ ...suivi, practitionerId: 'other' });
      await expect(service.create({ ...base, formulaId: 'f-suivi' }, user as any)).rejects.toThrow(BadRequestException);
      mockPrisma.formula.findUnique.mockResolvedValueOnce({ ...suivi, archivedAt: new Date() });
      await expect(service.create({ ...base, formulaId: 'f-suivi' }, user as any)).rejects.toThrow(BadRequestException);
      mockPrisma.practice.findUnique.mockResolvedValueOnce({ ...marseille, practitionerId: 'other' });
      await expect(
        service.create({ ...base, duration: 45, practiceId: 'pr-marseille' }, user as any),
      ).rejects.toThrow(BadRequestException);
      mockPrisma.practice.findUnique.mockResolvedValueOnce({ ...marseille, archivedAt: new Date() });
      await expect(
        service.create({ ...base, duration: 45, practiceId: 'pr-marseille' }, user as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.appointment.create).not.toHaveBeenCalled();
    });

    it('asks for a duration when there is neither a type nor one typed', async () => {
      await expect(service.create(base, user as any)).rejects.toThrow('Indiquez la durée en minutes.');
    });

    describe('update', () => {
      const booked = {
        id: 'a1',
        practitionerId: 'user-1',
        patientId: 'p1',
        startAt: new Date('2026-12-01T10:00:00.000Z'),
        duration: 60,
        type: 'IN_PERSON',
        formulaId: 'f-bilan',
        practiceId: 'pr-marseille',
      };
      const updated = () => mockPrisma.appointment.update.mock.calls[0][0].data;
      beforeEach(() => {
        mockPrisma.appointment.findUnique.mockResolvedValue(booked);
        mockPrisma.appointment.update.mockResolvedValue({});
      });

      it('another type gives its duration and the new end', async () => {
        await service.update('a1', { formulaId: 'f-suivi' }, user as any);
        expect(updated()).toMatchObject({ formulaId: 'f-suivi', duration: 45, endAt: new Date('2026-12-01T10:45:00.000Z') });
      });

      it('keeps its type, duration and practice when only moved, even if no longer offered', async () => {
        await service.update('a1', { startAt: '2026-12-03T14:00:00.000Z' }, user as any);
        expect(updated()).toMatchObject({
          formulaId: 'f-bilan',
          duration: 60,
          practiceId: 'pr-marseille',
          endAt: new Date('2026-12-03T15:00:00.000Z'),
        });
        expect(mockPrisma.formula.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.practice.findUnique).not.toHaveBeenCalled();
      });

      it('leaves the practice when it becomes a phone appointment, and gets the default one back in person', async () => {
        await service.update('a1', { type: 'PHONE' as any }, user as any);
        expect(updated()).toMatchObject({ type: 'PHONE', practiceId: null });

        mockPrisma.appointment.findUnique.mockResolvedValue({ ...booked, type: 'PHONE', practiceId: null });
        await service.update('a1', { type: 'IN_PERSON' as any }, user as any);
        expect(mockPrisma.appointment.update.mock.calls[1][0].data).toMatchObject({ practiceId: 'pr-aix' });
      });
    });
  });

  describe('options', () => {
    it("gives her offered types (with their duration) and active practices, default first", async () => {
      mockPrisma.formula.findMany.mockResolvedValue([{ id: 'f1' }]);
      mockPrisma.practice.findMany.mockResolvedValue([{ id: 'pr1' }]);
      await expect(service.options(user as any)).resolves.toEqual({ formulas: [{ id: 'f1' }], practices: [{ id: 'pr1' }] });
      expect(mockPrisma.formula.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { practitionerId: 'user-1', archivedAt: null } }),
      );
      expect(mockPrisma.practice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { practitionerId: 'user-1', archivedAt: null },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        }),
      );
    });

    it("gives an assistant those of the patient's practitioner, nothing before a patient is chosen", async () => {
      const assistant = createMockUser({ id: 'assist-1', role: 'ASSISTANTE' });
      await expect(service.options(assistant as any)).resolves.toEqual({ formulas: [], practices: [] });
      mockAccess.assertPatient.mockResolvedValueOnce({ practitionerId: 'pract-1' });
      mockPrisma.formula.findMany.mockResolvedValue([]);
      mockPrisma.practice.findMany.mockResolvedValue([]);
      await service.options(assistant as any, 'p1');
      expect(mockAccess.assertPatient).toHaveBeenCalledWith(assistant, 'p1', 'record');
      expect(mockPrisma.formula.findMany.mock.calls[0][0].where.practitionerId).toBe('pract-1');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', user as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('sets status to CANCELLED', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({ id: 'a1', practitionerId: user.id });
      mockPrisma.appointment.update.mockResolvedValue({});

      await service.remove('a1', user as any);

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AppointmentStatus.CANCELLED },
        }),
      );
    });
  });
});
