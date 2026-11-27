import type { PatientImportDraftDto, PatientImportSessionDto } from '../lib/patient-import';

/** A file like Polo.numbers, made up: one-word name, a « Bilan » dated after « Suivi 1 ». */
export const importSession = (label: string, date: string): PatientImportSessionDto => ({
  label,
  date,
  priceCents: 5000,
  paymentMethod: 'NONE' as PatientImportSessionDto['paymentMethod'],
  weightKg: 80,
  habits: null,
  sessionWork: null,
  advice: null,
  aversions: null,
  tastes: null,
});

export const DRAFT: PatientImportDraftDto = {
  firstName: '',
  lastName: 'Polo',
  sex: 'M' as PatientImportDraftDto['sex'],
  age: 57,
  ageOn: '2025-09-10',
  phone: '06',
  email: ' ',
  address: null,
  city: null,
  zipCode: null,
  familySituation: 'Marié, 2 enf',
  profession: null,
  gpName: 'Dr Martin',
  consultationReason: null,
  referralSource: null,
  heightCm: 177,
  weightKg: 115,
  file: { HEALTH: 'HTA traitée', PSYCHOLOGY: '' } as PatientImportDraftDto['file'],
  sessions: [importSession('Bilan', '2026-08-18'), importSession('Suivi 1', '2025-09-10'), importSession('Suivi 2', '2025-10-15')],
};

