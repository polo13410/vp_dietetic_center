import { ConflictException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { GpReportsService } from './gp-reports.service';

describe('GpReportsService', () => {
  let service: GpReportsService;
  const user = createMockUser();
  const report = { id: 'r1', patientId: 'p1', status: 'DRAFT', sentAt: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date('2026-11-22T12:00:00Z') });
    service = new GpReportsService(mockPrisma as any, mockAccess as any);
  });

  afterEach(() => vi.useRealTimers());

  it("lists the patient's reports, latest first", async () => {
    mockPrisma.gpReport.findMany.mockResolvedValue([report]);
    await expect(service.list(user as any, 'p1')).resolves.toEqual([report]);
    expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
    expect(mockPrisma.gpReport.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1' });
  });

  it('creates a draft dated today, written by the user', async () => {
    await service.create(user as any, 'p1', { content: 'Cher confrère,' });
    expect(mockPrisma.gpReport.create).toHaveBeenCalledWith({
      data: { patientId: 'p1', authorId: 'user-1', date: new Date('2026-11-22'), content: 'Cher confrère,' },
    });
  });

  /** The § 3.1 test patient, as the database returns her. */
  function mockMartine() {
    mockPrisma.patient.findUniqueOrThrow.mockResolvedValue({
      firstName: 'Martine',
      lastName: 'Roux',
      sex: 'F',
      dateOfBirth: new Date('1970-08-24'),
      gpName: 'Dr Laurent Garnier',
      consultationReason: 'Perte de poids.',
      practitionerId: 'user-1',
    });
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      firstName: 'Valérie',
      lastName: 'Perrot',
      phone: null,
      email: 'v@example.fr',
      practice: { practiceName: 'Valérie Perrot, diététicienne', adeliRpps: '139512345' },
    });
    // The letterhead takes the address of her default practice
    mockPrisma.practice.findFirst.mockResolvedValue({ address: null, zipCode: null, city: 'Aix-en-Provence' });
    mockPrisma.measurement.findMany.mockResolvedValue([
      { type: 'HEIGHT', value: '159', measuredAt: new Date('2026-09-23') },
      { type: 'WEIGHT', value: '79', measuredAt: new Date('2026-09-23') },
      { type: 'WEIGHT', value: '76.5', measuredAt: new Date('2026-11-15') },
    ]);
    mockPrisma.consultation.findMany.mockResolvedValue([
      { date: new Date('2026-09-23T09:00:00Z'), sessionWork: 'Bilan.', advice: 'Petit-déjeuner.' },
      { date: new Date('2026-11-15T09:00:00Z'), sessionWork: null, advice: null },
    ]);
    mockPrisma.fileEntry.findMany.mockResolvedValue([{ field: 'HEALTH', content: 'Hypertension traitée.' }]);
  }

  it('pre-fills a new report from the file when no text is given', async () => {
    mockMartine();
    mockPrisma.gpReport.create.mockImplementation(({ data }: any) => Promise.resolve(data));
    const created = await service.create(user as any, 'p1', {});
    expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
    expect(created.content).toMatch(/^Dr Laurent Garnier\n\nAix-en-Provence, le 22 novembre 2026/);
    expect(created.content).toContain('79 kg (IMC 31,25)');
    expect(created.content).toContain('76,5 kg (IMC 30,26), soit une perte de 2,5 kg');
    expect(created.content).toContain('5,86 MJ (1 400,3 kcal) par jour au bilan, est aujourd’hui de 5,77 MJ (1 378,9 kcal)');
    expect(created.content).toContain('j’ai relevé : Santé : hypertension traitée.');
    expect(created.content).toMatch(/Valérie Perrot\nDiététicienne$/);
    // The current value of each section: its latest entry
    expect(mockPrisma.fileEntry.findMany.mock.calls[0][0]).toMatchObject({
      where: { patientId: 'p1' },
      distinct: ['field'],
    });
  });

  it('regenerates a draft, dated today', async () => {
    mockMartine();
    mockPrisma.gpReport.findUnique.mockResolvedValue({ ...report, date: new Date('2026-11-01') });
    await service.regenerate(user as any, 'p1', 'r1');
    const { where, data } = mockPrisma.gpReport.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'r1' });
    expect(data.date).toEqual(new Date('2026-11-22'));
    expect(data.content).toContain('Objet : suivi diététique de Mme Martine Roux');
  });

  it('refuses to regenerate a report already sent', async () => {
    mockPrisma.gpReport.findUnique.mockResolvedValue({ ...report, status: 'SENT', sentAt: new Date() });
    await expect(service.regenerate(user as any, 'p1', 'r1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.gpReport.update).not.toHaveBeenCalled();
  });

  it('gives the report with the practice letterhead for the PDF', async () => {
    mockMartine();
    mockPrisma.gpReport.findUnique.mockResolvedValue(report);
    const doc = await service.document(user as any, 'p1', 'r1');
    expect(doc).toMatchObject({
      id: 'r1',
      patient: { firstName: 'Martine', lastName: 'Roux' },
      letterhead: ['Valérie Perrot, diététicienne', 'Aix-en-Provence', 'v@example.fr', 'N° ADELI : 139512345'],
    });
    expect(mockPrisma.user.findUniqueOrThrow.mock.calls[0][0].where).toEqual({ id: 'user-1' });
  });

  it('records the sending date once, and clears it back to draft', async () => {
    mockPrisma.gpReport.findUnique.mockResolvedValue(report);
    await service.update(user as any, 'p1', 'r1', { status: 'SENT' });
    expect(mockPrisma.gpReport.update.mock.calls[0][0].data).toMatchObject({
      status: 'SENT',
      sentAt: new Date('2026-11-22T12:00:00Z'),
    });

    const sentAt = new Date('2026-11-01');
    mockPrisma.gpReport.findUnique.mockResolvedValue({ ...report, status: 'SENT', sentAt });
    await service.update(user as any, 'p1', 'r1', { status: 'SENT', content: 'Corrigé' });
    expect(mockPrisma.gpReport.update.mock.calls[1][0].data).toMatchObject({ content: 'Corrigé', sentAt });

    await service.update(user as any, 'p1', 'r1', { status: 'DRAFT', date: '2026-11-20' });
    expect(mockPrisma.gpReport.update.mock.calls[2][0].data).toMatchObject({
      status: 'DRAFT',
      sentAt: null,
      date: new Date('2026-11-20'),
    });
  });

  it('reads and deletes a report', async () => {
    mockPrisma.gpReport.findUnique.mockResolvedValue(report);
    mockMartine();
    await expect(service.findOne(user as any, 'p1', 'r1')).resolves.toMatchObject({ ...report, patient: { lastName: 'Roux' } });
    await service.remove(user as any, 'p1', 'r1');
    expect(mockPrisma.gpReport.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it("hides another patient's report", async () => {
    mockPrisma.gpReport.findUnique.mockResolvedValue({ ...report, patientId: 'p2' });
    await expect(service.findOne(user as any, 'p1', 'r1')).rejects.toThrow(NotFoundException);
    await expect(service.remove(user as any, 'p1', 'r1')).rejects.toThrow(NotFoundException);
    await expect(service.document(user as any, 'p1', 'r1')).rejects.toThrow(NotFoundException);
    await expect(service.regenerate(user as any, 'p1', 'r1')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.gpReport.delete).not.toHaveBeenCalled();
  });
});
