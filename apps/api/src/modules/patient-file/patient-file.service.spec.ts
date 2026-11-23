import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { FILE_FIELDS, PatientFileService } from './patient-file.service';

const d = (iso: string) => new Date(iso);
const dec = (n: number) => new Prisma.Decimal(n);

describe('PatientFileService', () => {
  let service: PatientFileService;
  const user = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientFileService(mockPrisma as any, mockAccess as any);
  });

  afterEach(() => vi.useRealTimers());

  describe('getBrief', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: d('2026-11-22T12:00:00Z') });
      // The test patient of docs/REFONTE.md § 3.1
      mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({
        id: 'p1',
        sex: 'F',
        dateOfBirth: d('1970-01-01'),
        birthDateEstimated: true,
      });
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'c2', date: d('2026-11-01'), advice: 'Collation à 16 h' },
        { id: 'c1', date: d('2026-10-01'), advice: 'Petit-déjeuner' },
      ]);
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'a3', startAt: d('2026-12-01') });
      mockPrisma.measurement.findMany.mockResolvedValue([
        { type: 'HEIGHT', value: dec(159), measuredAt: d('2026-10-01') },
        { type: 'WEIGHT', value: dec(80), measuredAt: d('2026-10-01') },
        { type: 'WEIGHT', value: dec(79.5), measuredAt: d('2026-10-15') },
        { type: 'WEIGHT', value: dec(79), measuredAt: d('2026-11-01') },
      ]);
      mockPrisma.fileEntry.findMany.mockResolvedValue([
        { id: 'f3', field: 'ALLERGIES', content: 'Arachides', date: d('2026-11-01') },
        { id: 'f2', field: 'HEALTH', content: 'Hypertension traitée', date: d('2026-11-01') },
        { id: 'f1', field: 'HEALTH', content: 'Hypertension', date: d('2026-10-01') },
      ]);
      mockPrisma.lifeEvent.findMany.mockResolvedValue([
        { id: 'e2', date: d('2026-11-10'), title: 'Nouveau travail' },
        { id: 'e1', date: d('2026-10-05'), title: 'Déménagement' },
      ]);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.gpReport.findFirst.mockResolvedValue({ id: 'r1', status: 'DRAFT', sentAt: null });
    });

    it('checks the patient is the user’s, with clinical access', async () => {
      await service.getBrief(user as any, 'p1');
      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
    });

    it('summarizes each measurement: first, previous and latest', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      const weight = brief.metrics.find((m) => m.type === 'WEIGHT')!;
      expect(weight.count).toBe(3);
      expect(weight.first.value).toBe(80);
      expect(weight.previous?.value).toBe(79.5);
      expect(weight.latest.value).toBe(79);
    });

    it('computes BMI and BMR now, with the age of today', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.patient.age).toBe(56);
      expect(brief.bmi.current).toEqual({ value: 31.25, category: 'OBESITY', child: null });
      expect(brief.bmi.atStart).toEqual({ value: 31.64, category: 'OBESITY', child: null });
      expect(brief.bmr).toEqual({ mj: 5.86, kcal: 1400.3, adultFormulaForMinor: false });
      expect(brief.minor).toBe(false);
      expect(brief.missing).toEqual([]);
    });

    it('says what is missing for the calculations', async () => {
      mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ id: 'p1', sex: null, dateOfBirth: null });
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.bmr).toBeNull();
      expect(brief.missing).toEqual(['sex', 'age']);
    });

    it('gives each section of the medical file in her order, with its latest version', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.file.map((f) => f.field)).toEqual(FILE_FIELDS);
      const health = brief.file.find((f) => f.field === 'HEALTH')!;
      expect(health.current?.id).toBe('f2');
      expect(health.versionCount).toBe(2);
      expect(brief.file.find((f) => f.field === 'TASTES')).toEqual({
        field: 'TASTES',
        current: null,
        versionCount: 0,
      });
    });

    it('counts the life events since the last session and the sessions done', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.newEventsSinceLastConsultation).toBe(1);
      expect(brief.consultationCount).toBe(2);
      expect(brief.lastConsultation?.id).toBe('c2');
      expect(brief.firstConsultationAt).toEqual(d('2026-10-01'));
    });

    it('gives the summary as it was before a session, for its « Rappel »', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'c3', date: d('2026-11-22'), advice: null },
        { id: 'c2', date: d('2026-11-01'), advice: 'Collation à 16 h' },
        { id: 'c1', date: d('2026-10-01'), advice: 'Petit-déjeuner' },
      ]);
      mockPrisma.measurement.findMany.mockResolvedValue([
        { type: 'HEIGHT', value: dec(159), measuredAt: d('2026-10-01'), consultationId: null },
        { type: 'WEIGHT', value: dec(79), measuredAt: d('2026-11-01'), consultationId: 'c2' },
        { type: 'WEIGHT', value: dec(78.2), measuredAt: d('2026-11-22'), consultationId: 'c3' },
      ]);

      const brief = await service.getBrief(user as any, 'p1', 'c3');

      expect(brief.lastConsultation?.id).toBe('c2');
      expect(brief.consultationCount).toBe(2);
      expect(brief.metrics.find((m) => m.type === 'WEIGHT')!.latest.value).toBe(79);
      expect(brief.bmi.current).toEqual({ value: 31.25, category: 'OBESITY', child: null });
    });

    it('counts the change from the bilan, not from a weight history entered before it', async () => {
      mockPrisma.measurement.findMany.mockResolvedValue([
        { type: 'WEIGHT', value: dec(70), measuredAt: d('2019-05-01'), consultationId: null },
        { type: 'WEIGHT', value: dec(78), measuredAt: d('2025-11-01'), consultationId: null },
        { type: 'HEIGHT', value: dec(159), measuredAt: d('2026-10-01'), consultationId: 'c1' },
        { type: 'WEIGHT', value: dec(80), measuredAt: d('2026-10-01'), consultationId: 'c1' },
        { type: 'WEIGHT', value: dec(79), measuredAt: d('2026-11-01'), consultationId: 'c2' },
      ]);

      const brief = await service.getBrief(user as any, 'p1');

      expect(brief.metrics.find((m) => m.type === 'WEIGHT')!.first.value).toBe(70);
      expect(brief.weightAtStart).toEqual({ value: 80, measuredAt: d('2026-10-01') });
      expect(brief.bmi.atStart).toMatchObject({ value: 31.64 });
    });

    it('gives a child no adult category and the BMR « formule adulte »', async () => {
      mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ id: 'p1', sex: 'F', dateOfBirth: d('2014-06-01') });
      mockPrisma.measurement.findMany.mockResolvedValue([
        { type: 'HEIGHT', value: dec(140), measuredAt: d('2026-06-01'), consultationId: null },
        { type: 'WEIGHT', value: dec(45), measuredAt: d('2026-11-01'), consultationId: 'c2' },
      ]);

      const brief = await service.getBrief(user as any, 'p1');

      expect(brief.minor).toBe(true);
      expect(brief.bmi.current).toMatchObject({ value: 22.96, category: null, child: { class: 'OVERWEIGHT' } });
      expect(brief.bmr).toMatchObject({ adultFormulaForMinor: true });
    });

    it('leaves out the later sessions when an old one is reopened', async () => {
      const brief = await service.getBrief(user as any, 'p1', 'c1');
      expect(brief.lastConsultation).toBeNull();
      expect(brief.consultationCount).toBe(0);
    });

    it('refuses a session that is not the patient’s', async () => {
      await expect(service.getBrief(user as any, 'p1', 'other')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('flags a report to the GP still to send', async () => {
      const brief = await service.getBrief(user as any, 'p1');
      expect(brief.gpReportToDo).toBe(true);
      // Any draft counts, even if a later report was sent
      expect(mockPrisma.gpReport.findFirst.mock.calls[0][0].orderBy[0]).toEqual({ status: 'asc' });
    });
  });

  describe('bmiFor', () => {
    it('uses the latest weight and height of each patient', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([
        { id: 'p1', sex: 'M', dateOfBirth: d('1980-01-01') },
        { id: 'p2', sex: 'F', dateOfBirth: null },
      ]);
      mockPrisma.measurement.findMany.mockResolvedValue([
        { patientId: 'p1', type: 'HEIGHT', value: dec(175) },
        { patientId: 'p1', type: 'WEIGHT', value: dec(70) },
        { patientId: 'p2', type: 'WEIGHT', value: dec(60) }, // no height: no BMI
      ]);
      const bmi = await service.bmiFor(['p1', 'p2']);
      expect(bmi.get('p1')).toEqual({ value: 22.86, category: 'NORMAL', child: null });
      expect(bmi.has('p2')).toBe(false);
    });

    it('does not query without patients', async () => {
      await service.bmiFor([]);
      expect(mockPrisma.measurement.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getMeasureTimeline', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: d('2026-11-22T12:00:00Z') });
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'c1', date: d('2026-09-23T09:00:00Z') },
        { id: 'c2', date: d('2026-10-23T09:00:00Z') },
      ]);
      mockPrisma.lifeEvent.findMany.mockResolvedValue([{ id: 'e1', date: d('2020-01-15'), title: 'Grossesse' }]);
    });

    it('lists every measurement latest first, each weight with the height of its date and its séance', async () => {
      mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ sex: 'F', dateOfBirth: d('1970-08-24') });
      mockPrisma.measurement.findMany.mockResolvedValue([
        { id: 'm4', type: 'WEIGHT', value: dec(78.2), measuredAt: d('2026-10-23'), consultationId: 'c2', note: null },
        { id: 'm3', type: 'WEIGHT', value: dec(79), measuredAt: d('2026-09-23'), consultationId: 'c1', note: null },
        { id: 'm2', type: 'HEIGHT', value: dec(159), measuredAt: d('2026-09-23'), consultationId: 'c1', note: null },
        { id: 'm1', type: 'WEIGHT', value: dec(70), measuredAt: d('2019-05-01'), consultationId: null, note: 'Avant sa grossesse' },
      ]);

      const timeline = await service.getMeasureTimeline(user as any, 'p1');

      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
      expect(mockPrisma.measurement.findMany.mock.calls[0][0].orderBy).toEqual([{ measuredAt: 'desc' }, { createdAt: 'desc' }]);
      expect(timeline.measurements.map((m) => m.id)).toEqual(['m4', 'm3', 'm2', 'm1']);
      expect(timeline.measurements[0]).toMatchObject({
        value: 78.2,
        session: { id: 'c2', sequence: 1 },
        figures: { bmi: { value: 30.93 }, bmr: { mj: 5.83, kcal: 1393.5 } },
      });
      expect(timeline.measurements[1]).toMatchObject({ session: { id: 'c1', sequence: 0 }, figures: { bmr: { mj: 5.86, kcal: 1400.3 } } });
      // Height: no figures
      expect(timeline.measurements[2]).toMatchObject({ value: 159, figures: null });
      // Before the bilan, with the adult's height measured at the bilan
      expect(timeline.measurements[3]).toMatchObject({
        note: 'Avant sa grossesse',
        session: null,
        figures: { age: 48, height: { value: 159 }, bmi: { value: 27.69, category: 'OVERWEIGHT' } },
      });
      expect(timeline.lifeEvents).toEqual([{ id: 'e1', date: d('2020-01-15'), title: 'Grossesse' }]);
      expect(timeline.corpulence).toBeNull();
    });

    it('follows a child’s growth and draws the corpulence chart', async () => {
      mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({ sex: 'M', dateOfBirth: d('2016-01-01') });
      mockPrisma.measurement.findMany.mockResolvedValue([
        { id: 'w2', type: 'WEIGHT', value: dec(26), measuredAt: d('2024-01-01'), consultationId: null, note: null },
        { id: 'h2', type: 'HEIGHT', value: dec(125), measuredAt: d('2024-01-01'), consultationId: null, note: null },
        { id: 'w1', type: 'WEIGHT', value: dec(19), measuredAt: d('2021-01-01'), consultationId: null, note: null },
        { id: 'h1', type: 'HEIGHT', value: dec(110), measuredAt: d('2021-01-01'), consultationId: null, note: null },
      ]);

      const timeline = await service.getMeasureTimeline(user as any, 'p1');

      const w1 = timeline.measurements.find((m) => m.id === 'w1')!;
      const w2 = timeline.measurements.find((m) => m.id === 'w2')!;
      expect(w1.figures).toMatchObject({ minor: true, height: { value: 110 }, bmi: { value: 15.7, category: null } });
      expect(w2.figures).toMatchObject({ height: { value: 125 }, bmi: { value: 16.64, child: { class: 'NORMAL' } } });
      expect(timeline.corpulence?.points.map((p) => p.measurementId)).toEqual(['w1', 'w2']);
      expect(timeline.corpulence?.cutoffs[0]).toMatchObject({ age: 2, overweight: 18.41, obesity: 20.09 });
    });
  });

  describe('measurements', () => {
    it('lists measurements of one type as numbers', async () => {
      mockPrisma.measurement.findMany.mockResolvedValue([{ id: 'm1', value: dec(70.5) }]);
      const rows = await service.listMeasurements(user as any, 'p1', 'WEIGHT');
      expect(rows[0].value).toBe(70.5);
      expect(mockPrisma.measurement.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1', type: 'WEIGHT' });
    });

    it('rejects implausible values', async () => {
      await expect(
        service.createMeasurement(user as any, 'p1', { type: 'WEIGHT', value: 720 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.measurement.create).not.toHaveBeenCalled();
    });

    it('dates a measurement taken in a session with the session date', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ patientId: 'p1', date: d('2026-11-20T10:00:00Z') });
      mockPrisma.measurement.create.mockResolvedValue({ id: 'm1', value: dec(72.5) });

      const result = await service.createMeasurement(user as any, 'p1', {
        type: 'WEIGHT',
        value: 72.5,
        consultationId: 'c1',
      });

      expect(mockPrisma.measurement.create.mock.calls[0][0].data.measuredAt).toEqual(
        d('2026-11-20T10:00:00Z'),
      );
      expect(result.value).toBe(72.5);
    });

    it("refuses a session of another patient", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValueOnce({ patientId: 'p2' });
      await expect(
        service.createMeasurement(user as any, 'p1', { type: 'WEIGHT', value: 70, consultationId: 'c1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('corrects or removes any measurement, even one of a past session', async () => {
      mockPrisma.measurement.findUnique.mockResolvedValue({ id: 'm1', patientId: 'p1', type: 'WEIGHT', consultationId: 'c1' });
      mockPrisma.measurement.update.mockResolvedValue({ id: 'm1', value: dec(71) });

      await expect(service.updateMeasurement(user as any, 'p1', 'm1', { value: 71 })).resolves.toMatchObject({ value: 71 });
      await expect(service.updateMeasurement(user as any, 'p1', 'm1', { value: 900 })).rejects.toThrow(
        BadRequestException,
      );
      await service.removeMeasurement(user as any, 'p1', 'm1');
      expect(mockPrisma.measurement.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });

    it("hides another patient's measurement", async () => {
      mockPrisma.measurement.findUnique.mockResolvedValue({ id: 'm1', patientId: 'p2' });
      await expect(service.updateMeasurement(user as any, 'p1', 'm1', { value: 70 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('medical file', () => {
    const entry = (overrides = {}) => ({
      id: 'f1',
      patientId: 'p1',
      field: 'AVERSIONS',
      content: "N'aime pas les légumes cuits",
      date: d('2026-11-10'),
      consultationId: null,
      ...overrides,
    });

    beforeEach(() => {
      vi.useFakeTimers({ now: d('2026-11-22T12:00:00Z') });
      mockPrisma.fileEntry.update.mockImplementation(({ data }) => ({ ...entry(), ...data }));
      mockPrisma.fileEntry.create.mockImplementation(({ data }) => ({ id: 'new', ...data }));
    });

    it('creates the first version of a section, dated today', async () => {
      mockPrisma.fileEntry.findFirst.mockResolvedValue(null);

      await service.saveFileField(user as any, 'p1', 'AVERSIONS', { content: '  Sauf en soupe ' });

      expect(mockPrisma.fileEntry.create).toHaveBeenCalledWith({
        data: {
          patientId: 'p1',
          field: 'AVERSIONS',
          content: 'Sauf en soupe',
          date: d('2026-11-22'),
          consultationId: undefined,
        },
      });
    });

    it('updates the entry of the day when edited again the same day', async () => {
      mockPrisma.fileEntry.findFirst.mockResolvedValue(entry({ date: d('2026-11-22') }));

      await service.saveFileField(user as any, 'p1', 'AVERSIONS', { content: 'Sauf en soupe' });

      expect(mockPrisma.fileEntry.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { content: 'Sauf en soupe', consultationId: undefined },
      });
      expect(mockPrisma.fileEntry.create).not.toHaveBeenCalled();
    });

    it('adds a new version when edited another day', async () => {
      mockPrisma.fileEntry.findFirst.mockResolvedValue(entry());

      await service.saveFileField(user as any, 'p1', 'AVERSIONS', { content: 'Sauf en soupe' });

      expect(mockPrisma.fileEntry.create.mock.calls[0][0].data).toMatchObject({
        content: 'Sauf en soupe',
        date: d('2026-11-22'),
      });
      expect(mockPrisma.fileEntry.update).not.toHaveBeenCalled();
    });

    it('adds nothing when the text is unchanged', async () => {
      mockPrisma.fileEntry.findFirst.mockResolvedValue(entry());

      const saved = await service.saveFileField(user as any, 'p1', 'AVERSIONS', {
        content: "N'aime pas les légumes cuits",
      });

      expect(saved.id).toBe('f1');
      expect(mockPrisma.fileEntry.create).not.toHaveBeenCalled();
    });

    it("updates the session's own entry when edited from that session, even later", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ patientId: 'p1', date: d('2026-11-10T10:00:00Z') });
      mockPrisma.fileEntry.findFirst.mockResolvedValueOnce(entry({ consultationId: 'c1' }));

      await service.saveFileField(user as any, 'p1', 'AVERSIONS', {
        content: 'Sauf en soupe',
        consultationId: 'c1',
      });

      expect(mockPrisma.fileEntry.findFirst.mock.calls[0][0].where).toEqual({
        patientId: 'p1',
        field: 'AVERSIONS',
        consultationId: 'c1',
      });
      expect(mockPrisma.fileEntry.update.mock.calls[0][0]).toEqual({
        where: { id: 'f1' },
        data: { content: 'Sauf en soupe', consultationId: 'c1' },
      });
    });

    it("links a new version to the session, dated with the session's day", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ patientId: 'p1', date: d('2026-11-20T10:00:00Z') });
      mockPrisma.fileEntry.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(entry());

      await service.saveFileField(user as any, 'p1', 'TASTES', { content: 'Aime le poisson', consultationId: 'c1' });

      expect(mockPrisma.fileEntry.create.mock.calls[0][0].data).toMatchObject({
        field: 'TASTES',
        date: d('2026-11-20'),
        consultationId: 'c1',
      });
    });

    it('gives the current file and the history of a section', async () => {
      mockPrisma.fileEntry.findMany.mockResolvedValue([]);
      const file = await service.getFile(user as any, 'p1');
      expect(file).toHaveLength(10);

      await service.listFileEntries(user as any, 'p1', 'HEALTH');
      expect(mockPrisma.fileEntry.findMany.mock.calls[1][0].where).toEqual({ patientId: 'p1', field: 'HEALTH' });
    });

    it('corrects or deletes a version of the history', async () => {
      mockPrisma.fileEntry.findUnique.mockResolvedValue(entry());

      await service.updateFileEntry(user as any, 'p1', 'f1', { content: ' Corrigé ', date: '2026-11-09' });
      expect(mockPrisma.fileEntry.update.mock.calls[0][0].data).toEqual({
        content: 'Corrigé',
        date: d('2026-11-09'),
      });

      await service.removeFileEntry(user as any, 'p1', 'f1');
      expect(mockPrisma.fileEntry.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
    });

    it("hides another patient's version", async () => {
      mockPrisma.fileEntry.findUnique.mockResolvedValue(entry({ patientId: 'p2' }));
      await expect(service.removeFileEntry(user as any, 'p1', 'f1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('life events', () => {
    it('adds, edits and removes life events, with an optional category', async () => {
      await service.createLifeEvent(user as any, 'p1', { date: '2026-10-01', title: ' Déménagement ' });
      expect(mockPrisma.lifeEvent.create.mock.calls[0][0].data).toMatchObject({
        title: 'Déménagement',
        category: undefined,
      });

      mockPrisma.lifeEvent.findUnique.mockResolvedValue({ id: 'e1', patientId: 'p1' });
      await service.updateLifeEvent(user as any, 'p1', 'e1', { title: 'Déménagement à Lyon', category: 'HOME' });
      expect(mockPrisma.lifeEvent.update.mock.calls[0][0].data).toMatchObject({
        title: 'Déménagement à Lyon',
        category: 'HOME',
      });

      await service.removeLifeEvent(user as any, 'p1', 'e1');
      expect(mockPrisma.lifeEvent.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });

      mockPrisma.lifeEvent.findMany.mockResolvedValue([]);
      await service.listLifeEvents(user as any, 'p1');
      expect(mockPrisma.lifeEvent.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1' });
    });
  });
});
