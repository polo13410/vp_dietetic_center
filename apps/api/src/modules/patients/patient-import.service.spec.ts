import { createRequire } from 'node:module';

import { BadRequestException, ConflictException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { mockPrisma } from '../../test/setup';
import { AUDITED_KEY } from '../audit/audited.decorator';

import { ImportPatientDto } from './dto/import-patient.dto';
import { PatientImportController } from './patient-import.controller';
import { PatientImportService, formulaOf } from './patient-import.service';

const FORMULAS = [
  { id: 'f-bilan', label: 'Bilan' },
  { id: 'f-suivi', label: 'Suivi' },
];

const session = (over: Partial<ImportPatientDto['sessions'][number]> = {}) => ({
  label: 'Suivi 1',
  date: '2025-04-01',
  priceCents: 5000,
  paymentMethod: 'CHECK' as const,
  weightKg: 78.5,
  habits: 'Moins de pain',
  sessionWork: null,
  advice: null,
  aversions: null,
  tastes: null,
  ...over,
});

const draft = (over: Partial<ImportPatientDto> = {}): ImportPatientDto => ({
  firstName: 'Marie',
  lastName: 'Durand',
  sex: 'F',
  age: 42,
  ageOn: '2025-03-04',
  phone: '06 12 34 56 78',
  email: null,
  address: null,
  city: null,
  zipCode: null,
  familySituation: 'Mariée',
  profession: null,
  gpName: 'Dr Martin',
  consultationReason: null,
  referralSource: null,
  heightCm: 165,
  weightKg: 80,
  file: { HEALTH: 'HTA traitée', PSYCHOLOGY: '  ' },
  sessions: [
    session(),
    session({ label: 'Bilan ', date: '2025-03-04', priceCents: 6000, weightKg: 80, aversions: 'Épinards', tastes: 'Fruits', habits: null }),
  ],
  ...over,
});

describe('PatientImportService', () => {
  let service: PatientImportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientImportService(mockPrisma as any);
    mockPrisma.patient.findMany.mockResolvedValue([]);
    mockPrisma.patient.create.mockResolvedValue({ id: 'p1' });
    mockPrisma.formula.findMany.mockResolvedValue(FORMULAS);
    mockPrisma.patientCoverage.findMany.mockResolvedValue([]);
    let n = 0;
    mockPrisma.consultation.create.mockImplementation(async () => ({ id: `c${++n}` }));
  });

  describe('import', () => {
    it('saves the patient, the file and her sessions in date order, in one transaction', async () => {
      const result = await service.import('user-1', draft());

      expect(result).toEqual({ id: 'p1', sessions: 2 });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          practitionerId: 'user-1',
          firstName: 'Marie',
          lastName: 'Durand',
          sex: 'F',
          // 42 in 2025: born in 1983, estimated
          dateOfBirth: new Date('1983-01-01'),
          birthDateEstimated: true,
          gpName: 'Dr Martin',
        }),
        select: { id: true },
      });

      const created = mockPrisma.consultation.create.mock.calls.map(([arg]) => arg.data);
      expect(created).toEqual([
        expect.objectContaining({
          date: new Date('2025-03-04'),
          formulaId: 'f-bilan',
          formulaLabel: 'Bilan',
          priceCents: 6000,
          paymentMethod: 'CHECK',
          habits: null,
          // No coverage: she paid it all
          netCents: 6000,
          patientCents: 6000,
          payerCents: 0,
        }),
        expect.objectContaining({ date: new Date('2025-04-01'), formulaId: 'f-suivi', priceCents: 5000, habits: 'Moins de pain' }),
      ]);

      expect(mockPrisma.measurement.createMany).toHaveBeenCalledWith({
        data: [
          { patientId: 'p1', type: 'HEIGHT', value: 165, measuredAt: new Date('2025-03-04') },
          // The « Dossier médical » weight is the Bilan's: not saved twice
          { patientId: 'p1', consultationId: 'c1', type: 'WEIGHT', value: 80, measuredAt: new Date('2025-03-04') },
          { patientId: 'p1', consultationId: 'c2', type: 'WEIGHT', value: 78.5, measuredAt: new Date('2025-04-01') },
        ],
      });
      expect(mockPrisma.fileEntry.createMany).toHaveBeenCalledWith({
        data: [
          { patientId: 'p1', field: 'HEALTH', content: 'HTA traitée', date: new Date('2025-03-04') },
          { patientId: 'p1', consultationId: 'c1', field: 'AVERSIONS', content: 'Épinards', date: new Date('2025-03-04') },
          { patientId: 'p1', consultationId: 'c1', field: 'TASTES', content: 'Fruits', date: new Date('2025-03-04') },
        ],
      });
    });

    it('keeps the file weight without sessions, and the row label without a matching formula', async () => {
      mockPrisma.formula.findMany.mockResolvedValue([]);
      await service.import('user-1', draft({ sessions: [], age: null, heightCm: null, file: {} }));
      expect(mockPrisma.patient.create.mock.calls[0][0].data).not.toHaveProperty('dateOfBirth');
      expect(mockPrisma.measurement.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ type: 'WEIGHT', value: 80 })],
      });
      expect(mockPrisma.fileEntry.createMany).not.toHaveBeenCalled();

      vi.clearAllMocks();
      mockPrisma.patient.findMany.mockResolvedValue([]);
      mockPrisma.patient.create.mockResolvedValue({ id: 'p2' });
      mockPrisma.formula.findMany.mockResolvedValue([]);
      mockPrisma.consultation.create.mockResolvedValue({ id: 'c9' });
      await service.import('user-1', draft({ sessions: [session({ label: 'Atelier', priceCents: null, weightKg: null })] }));
      expect(mockPrisma.consultation.create.mock.calls[0][0].data).toMatchObject({
        formulaId: null,
        formulaLabel: 'Atelier',
        priceCents: null,
        netCents: null,
      });
    });

    it('refuses a patient she already has, unless she says to import anyway', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([{ id: 'old', firstName: 'Marie', lastName: 'Durand' }]);
      await expect(service.import('user-1', draft())).rejects.toThrow(ConflictException);
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
      expect(mockPrisma.patient.findMany.mock.calls[0][0].where).toEqual({
        practitionerId: 'user-1',
        deletedAt: null,
        firstName: { equals: 'Marie', mode: 'insensitive' },
        lastName: { equals: 'Durand', mode: 'insensitive' },
      });

      await service.import('user-1', draft({ allowDuplicate: true }));
      expect(mockPrisma.patient.create).toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    const numbersFile = () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet([
          [null, 'Patient', 'Tel'],
          ['Administratif', 'Polo', '06'],
        ]),
        'Récapitulatif',
      );
      return XLSX.write(wb, {
        type: 'buffer',
        bookType: 'numbers',
        numbers: createRequire(__filename)('xlsx/dist/xlsx.zahl.js'),
      }) as Buffer;
    };

    it('reads the file and lists her patients with that name, saving nothing', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p0', firstName: 'Polo', lastName: 'Martin' }]);
      const result = await service.preview('user-1', { buffer: numbersFile(), originalname: 'Polo.numbers' });

      expect(result.draft).toMatchObject({ firstName: '', lastName: 'Polo', phone: '06' });
      expect(result.warnings).toContain('Téléphone incomplet : « 06 ».');
      expect(result.duplicates).toEqual([{ id: 'p0', firstName: 'Polo', lastName: 'Martin' }]);
      // One word: a patient with it as first or last name
      expect(mockPrisma.patient.findMany.mock.calls[0][0].where.OR).toEqual([
        { firstName: { equals: 'Polo', mode: 'insensitive' } },
        { lastName: { equals: 'Polo', mode: 'insensitive' } },
      ]);
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
    });

    it('turns a file without her tables into a clear error', async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Courses'], ['Pain']]), 'Liste');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      await expect(service.preview('user-1', { buffer, originalname: 'liste.xlsx' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

describe('formulaOf', () => {
  it.each([
    ['Bilan ', 'f-bilan'],
    ['bilan initial', 'f-bilan'],
    ['Suivi 3', 'f-suivi'],
    ['SUIVI', 'f-suivi'],
    ['Atelier', undefined],
  ])('%s', (label, id) => {
    expect(formulaOf(FORMULAS, label)?.id).toBe(id);
  });
});

describe('PatientImportController', () => {
  const proto = PatientImportController.prototype as unknown as Record<string, () => unknown>;
  const service = { preview: vi.fn(), import: vi.fn() };
  const controller = new PatientImportController(service as any);
  const user = { id: 'user-1' } as any;

  it('routes: preview saves nothing, the import is logged as a patient creation', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PatientImportController)).toBe('patients/import');
    expect(Reflect.getMetadata(PATH_METADATA, proto.preview)).toBe('preview');
    expect(Reflect.getMetadata(METHOD_METADATA, proto.import)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(AUDITED_KEY, proto.preview)).toBeUndefined();
    expect(Reflect.getMetadata(AUDITED_KEY, proto.import)).toMatchObject({
      action: 'CREATE',
      entity: 'patient',
      patientId: 'result:id',
    });
  });

  it('refuses no file, and a file that is not a zip (a Numbers package folder)', () => {
    expect(() => controller.preview(undefined, user)).toThrow(BadRequestException);
    expect(() =>
      controller.preview({ buffer: Buffer.from('not a zip'), originalname: 'x.numbers' } as any, user),
    ).toThrow(/Enregistrer en un seul fichier/);
    expect(service.preview).not.toHaveBeenCalled();

    const file = { buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]), originalname: 'x.numbers' } as any;
    controller.preview(file, user);
    expect(service.preview).toHaveBeenCalledWith('user-1', file);
  });
});
