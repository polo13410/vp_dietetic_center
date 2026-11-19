import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockPrisma } from '../../test/setup';

import { PatientAccessService } from './patient-access.service';

describe('PatientAccessService', () => {
  let service: PatientAccessService;
  const user = createMockUser();
  const admin = createMockUser({ id: 'admin-1', role: 'ADMIN' });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientAccessService(mockPrisma as any);
  });

  describe('patientScope', () => {
    it('restricts non-admins to their own patients', () => {
      expect(service.patientScope(user as any)).toEqual({ practitionerId: user.id });
    });

    it('does not restrict admins', () => {
      expect(service.patientScope(admin as any)).toEqual({});
    });
  });

  describe('assistants', () => {
    const assistant = createMockUser({ id: 'assist-1', role: 'ASSISTANTE' });

    it('can read every patient record', async () => {
      expect(service.patientScope(assistant as any, 'record')).toEqual({});
      mockPrisma.patient.findUnique.mockResolvedValue({ practitionerId: 'other' });
      await expect(service.assertPatient(assistant as any, 'p1', 'record')).resolves.toEqual({
        practitionerId: 'other',
      });
    });

    it('manages appointments of every practitioner', async () => {
      expect(service.appointmentScope(assistant as any)).toEqual({});
      expect(service.canManageAppointment(assistant as any, 'other')).toBe(true);
      mockPrisma.appointment.findUnique.mockResolvedValue({
        practitionerId: 'other',
        patientId: 'p1',
      });
      await expect(
        service.assertAppointment(assistant as any, 'a1', 'p1'),
      ).resolves.toBeUndefined();
    });

    it('never gets full (clinical / write) access', async () => {
      expect(service.patientScope(assistant as any)).toEqual({ id: { in: [] } });
      expect(service.canAccess(assistant as any, assistant.id, 'full')).toBe(false);
      mockPrisma.patient.findUnique.mockResolvedValue({ practitionerId: 'other' });
      await expect(service.assertPatient(assistant as any, 'p1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertPatient', () => {
    it('passes for the owning practitioner', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ practitionerId: user.id });
      await expect(service.assertPatient(user as any, 'p1')).resolves.toEqual({
        practitionerId: user.id,
      });
      expect(mockPrisma.patient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p1', deletedAt: null } }),
      );
    });

    it("rejects another practitioner's patient", async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ practitionerId: 'other' });
      await expect(service.assertPatient(user as any, 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('lets admins access any patient', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ practitionerId: 'other' });
      await expect(service.assertPatient(admin as any, 'p1')).resolves.toEqual({
        practitionerId: 'other',
      });
    });

    it('throws NotFound for missing or deleted patients', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      await expect(service.assertPatient(user as any, 'p1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('appointmentScope', () => {
    it("restricts practitioners to their own appointments", () => {
      expect(service.appointmentScope(user as any)).toEqual({ practitionerId: user.id });
      expect(service.canManageAppointment(user as any, 'other')).toBe(false);
    });
  });

  describe('assertAppointment', () => {
    it('passes for an own appointment of the given patient', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        practitionerId: user.id,
        patientId: 'p1',
      });
      await expect(service.assertAppointment(user as any, 'a1', 'p1')).resolves.toBeUndefined();
    });

    it("rejects another practitioner's appointment", async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        practitionerId: 'other',
        patientId: 'p1',
      });
      await expect(service.assertAppointment(user as any, 'a1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects an appointment that belongs to a different patient', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        practitionerId: user.id,
        patientId: 'p2',
      });
      await expect(service.assertAppointment(user as any, 'a1', 'p1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFound for missing appointments', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);
      await expect(service.assertAppointment(user as any, 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
