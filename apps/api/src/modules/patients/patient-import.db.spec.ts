/*
 * The import against a real PostgreSQL database: one transaction for the whole file, and the
 * imported sessions read back like typed ones (figures, weight change, medical file history).
 * Runs when TEST_DATABASE_URL points to a migrated database (CI does); skipped otherwise.
 */
import { randomUUID } from 'node:crypto';

import { PrismaClient, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PayerInvoicesService } from '../invoices/payer-invoices.service';
import { ConsultationsService } from '../patient-file/consultations.service';
import { PatientFileService } from '../patient-file/patient-file.service';

import { ImportPatientDto } from './dto/import-patient.dto';
import { PatientImportService } from './patient-import.service';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('patient import on a real database', () => {
  let prisma: PrismaClient;
  let service: PatientImportService;
  let sessions: ConsultationsService;
  let file: PatientFileService;
  const practitionerId = randomUUID();
  const user = { id: practitionerId, role: UserRole.PRATICIENNE };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: url });
    const access = new PatientAccessService(prisma as any);
    service = new PatientImportService(prisma as any);
    sessions = new ConsultationsService(
      prisma as any,
      access,
      new InvoicesService(prisma as any, access, new PayerInvoicesService(prisma as any, access)),
    );
    file = new PatientFileService(prisma as any, access);
    await prisma.user.create({
      data: { id: practitionerId, email: `${practitionerId}@test.local`, firstName: 'V', lastName: 'P', role: UserRole.PRATICIENNE },
    });
    await prisma.formula.createMany({
      data: [
        { practitionerId, label: 'Bilan', priceCents: 7000, position: 0 },
        { practitionerId, label: 'Suivi', priceCents: 5500, position: 1 },
        // An older « Suivi » she no longer offers: her active one is preferred
        { practitionerId, label: 'Suivi (ancien)', priceCents: 4000, position: 2, archivedAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$transaction([
      prisma.measurement.deleteMany({ where: { patient: { practitionerId } } }),
      prisma.fileEntry.deleteMany({ where: { patient: { practitionerId } } }),
      prisma.consultation.deleteMany({ where: { practitionerId } }),
      prisma.patient.deleteMany({ where: { practitionerId } }),
      prisma.formula.deleteMany({ where: { practitionerId } }),
      prisma.user.deleteMany({ where: { id: practitionerId } }),
    ]);
    await prisma.$disconnect();
  });

  const dto = (over: Partial<ImportPatientDto> = {}): ImportPatientDto => ({
    firstName: 'Paul',
    lastName: 'Testeur',
    sex: 'M',
    age: 57,
    ageOn: '2025-08-18',
    phone: null,
    email: null,
    address: null,
    city: null,
    zipCode: null,
    familySituation: 'Marié, 2 enf',
    profession: null,
    gpName: null,
    consultationReason: null,
    referralSource: null,
    heightCm: 177,
    weightKg: 115,
    file: { HEALTH: 'HTA traitée', AVERSIONS: 'Choux' },
    sessions: [
      { label: 'Bilan', date: '2025-08-18', priceCents: 6000, paymentMethod: 'NONE', weightKg: 115, habits: 'Pain', sessionWork: null, advice: 'Légumes', aversions: null, tastes: null },
      { label: 'Suivi 1', date: '2025-09-10', priceCents: 5000, paymentMethod: 'CHECK', weightKg: 107.4, habits: null, sessionWork: null, advice: null, aversions: 'Choux, poivrons', tastes: 'Fruits' },
    ],
    ...over,
  });

  it('saves the whole file, and the sessions read back like typed ones', async () => {
    const { id } = await service.import(practitionerId, dto());

    const patient = await prisma.patient.findUniqueOrThrow({ where: { id } });
    expect(patient).toMatchObject({ firstName: 'Paul', birthDateEstimated: true, dateOfBirth: new Date('1968-01-01') });

    const list = await sessions.list(user, id);
    expect(list.map((s) => [s.formulaLabel, s.priceCents, s.paymentMethod])).toEqual([
      ['Suivi', 5000, 'CHECK'], // latest first; the price is the one she charged then
      ['Bilan', 6000, 'NONE'],
    ]);
    // Weight, BMI from the imported height, change since the previous session
    expect(list[0]).toMatchObject({
      sequence: 1,
      figures: { weight: 107.4, bmi: { value: 34.28 }, missing: [] },
      weightChange: { sincePrevious: -7.6 },
      previousAdvice: 'Légumes',
    });

    // « Aversions »: the file's version first, then the session's
    const entries = await file.listFileEntries(user, id, 'AVERSIONS');
    expect(entries.map((e: { content: string }) => e.content).sort()).toEqual(['Choux', 'Choux, poivrons']);
  });

  it('saves nothing when one row cannot be saved', async () => {
    const before = await prisma.patient.count({ where: { practitionerId } });
    const broken = dto({ lastName: 'Cassé', sessions: [dto().sessions[0], { ...dto().sessions[1], paymentMethod: 'BITCOIN' as any }] });
    await expect(service.import(practitionerId, broken)).rejects.toThrow();
    expect(await prisma.patient.count({ where: { practitionerId } })).toBe(before);
  });
});
