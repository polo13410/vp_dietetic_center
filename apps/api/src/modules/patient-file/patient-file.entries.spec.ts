import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { ConsultationsService } from './consultations.service';
import { PatientFileService } from './patient-file.service';

/** The everyday reads and writes of the file: each one checks the patient and keeps its rules. */
describe('Patient file entries', () => {
  let file: PatientFileService;
  let sessions: ConsultationsService;
  const user = createMockUser();
  const free = { patientId: 'p1', consultation: null };
  const draftSession = { patientId: 'p1', status: 'DRAFT', date: new Date('2026-11-20') };

  beforeEach(() => {
    vi.clearAllMocks();
    file = new PatientFileService(mockPrisma as any, mockAccess as any);
    sessions = new ConsultationsService(mockPrisma as any, mockAccess as any, file);
  });

  it('lists measurements of one type as numbers', async () => {
    mockPrisma.measurement.findMany.mockResolvedValue([{ id: 'm1', value: new Prisma.Decimal(70.5) }]);
    const rows = await file.listMeasurements(user as any, 'p1', 'WEIGHT');
    expect(rows[0].value).toBe(70.5);
    expect(mockPrisma.measurement.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1', type: 'WEIGHT' });
    expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
  });

  it('corrects a measurement recorded outside a session', async () => {
    mockPrisma.measurement.findUnique.mockResolvedValue({ ...free, type: 'WEIGHT' });
    mockPrisma.measurement.update.mockResolvedValue({ id: 'm1', value: new Prisma.Decimal(71) });
    await expect(file.updateMeasurement(user as any, 'p1', 'm1', { value: 71 })).resolves.toMatchObject({ value: 71 });
    await expect(file.updateMeasurement(user as any, 'p1', 'm1', { value: 900 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('adds, edits and removes topic notes', async () => {
    mockPrisma.consultation.findUnique.mockResolvedValue(draftSession);
    await file.createTopicNote(user as any, 'p1', { topic: 'EATING', content: '  Saute le petit-déj  ', consultationId: 'c1' });
    expect(mockPrisma.topicNote.create.mock.calls[0][0].data).toMatchObject({
      topic: 'EATING',
      content: 'Saute le petit-déj',
      consultationId: 'c1',
    });

    mockPrisma.topicNote.findUnique.mockResolvedValue(free);
    await file.updateTopicNote(user as any, 'p1', 't1', { content: 'Petit-déj pris' });
    await file.removeTopicNote(user as any, 'p1', 't1');
    expect(mockPrisma.topicNote.delete).toHaveBeenCalledWith({ where: { id: 't1' } });

    await file.listTopicNotes(user as any, 'p1', 'SLEEP');
    expect(mockPrisma.topicNote.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1', topic: 'SLEEP' });
  });

  it('adds, edits and removes life events', async () => {
    await file.createLifeEvent(user as any, 'p1', { date: '2026-10-01', title: ' Déménagement ', category: 'HOME' });
    expect(mockPrisma.lifeEvent.create.mock.calls[0][0].data).toMatchObject({
      title: 'Déménagement',
      date: new Date('2026-10-01'),
      category: 'HOME',
    });

    mockPrisma.lifeEvent.findUnique.mockResolvedValue(free);
    await file.updateLifeEvent(user as any, 'p1', 'e1', { date: '2026-10-02' });
    expect(mockPrisma.lifeEvent.update.mock.calls[0][0].data.date).toEqual(new Date('2026-10-02'));
    await file.removeLifeEvent(user as any, 'p1', 'e1');
    expect(mockPrisma.lifeEvent.delete).toHaveBeenCalled();

    await file.listLifeEvents(user as any, 'p1');
    expect(mockPrisma.lifeEvent.findMany).toHaveBeenCalled();
  });

  it('adds, lists and removes goals', async () => {
    await file.createGoal(user as any, 'p1', { title: ' Marcher ' });
    expect(mockPrisma.goal.create.mock.calls[0][0].data).toMatchObject({ patientId: 'p1', title: 'Marcher' });

    await file.listGoals(user as any, 'p1');
    expect(mockPrisma.goal.findMany.mock.calls[0][0].include.reviews).toBeDefined();

    mockPrisma.goal.findUnique.mockResolvedValue({ ...free, consultation: { status: 'FINALIZED' } });
    await expect(file.removeGoal(user as any, 'p1', 'g1')).rejects.toThrow(BadRequestException);
  });

  describe('sessions', () => {
    it("lists the patient's sessions with what was recorded", async () => {
      await sessions.list(user as any, 'p1');
      expect(mockPrisma.consultation.findMany.mock.calls[0][0]).toMatchObject({
        where: { patientId: 'p1' },
        orderBy: { date: 'desc' },
      });
    });

    it('opens a session with its measurements as numbers', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        id: 'c1',
        patientId: 'p1',
        measurements: [{ id: 'm1', value: new Prisma.Decimal(64.5) }],
      });
      const s = await sessions.findOne(user as any, 'c1');
      expect(s.measurements[0].value).toBe(64.5);
      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
    });

    it('saves the report of a draft', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ id: 'c1', ...draftSession });
      await sessions.update(user as any, 'c1', { summary: 'Bonne séance', advice: 'Continuer' });
      expect(mockPrisma.consultation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { summary: 'Bonne séance', advice: 'Continuer', date: undefined },
      });
    });

    it('starts a session without appointment, dated now', async () => {
      await sessions.create(user as any, 'p1', {});
      const data = mockPrisma.consultation.create.mock.calls[0][0].data;
      expect(data.appointmentId).toBeUndefined();
      expect(data.date).toBeInstanceOf(Date);
    });
  });
});
