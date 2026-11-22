/** The seed's test patient (docs/REFONTE.md § 3.1): woman, 56, 1.59 m, 79 → 78.2 → 76.5 kg. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import type { Brief, Consultation, FileSectionDto, Measurement, Patient } from '../lib/patient-file';

export const PATIENT_ID = 'p-1';

export const patient: Patient = {
  id: PATIENT_ID,
  practitionerId: 'u-1',
  firstName: 'Martine',
  lastName: 'Roux',
  sex: 'F' as Patient['sex'],
  dateOfBirth: '1970-08-24T00:00:00.000Z',
  birthDateEstimated: false,
  email: 'martine.roux@example.com',
  phone: '06 21 43 65 87',
  address: '12 rue des Lilas',
  city: 'Montpellier',
  zipCode: '34000',
  familySituation: 'Mariée, deux enfants adultes',
  profession: 'Secrétaire médicale',
  gpName: 'Dr Laurent Garnier',
  consultationReason: 'Perte de poids',
  referralSource: 'Médecin traitant',
  archivedAt: null,
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-18T10:00:00.000Z',
};

const entry = (field: FileSectionDto['field'], content: string, date = '2026-09-23T00:00:00.000Z') => ({
  field,
  versionCount: 1,
  current: { id: `e-${field}`, field, content, date, updatedAt: date, consultationId: null },
});

export const sections: FileSectionDto[] = [
  entry('HEALTH' as FileSectionDto['field'], 'Hypertension traitée.'),
  { ...entry('PSYCHOLOGY' as FileSectionDto['field'], 'Grignotage lié au stress.', '2026-11-15T00:00:00.000Z'), versionCount: 2 },
  entry('ALLERGIES' as FileSectionDto['field'], 'Arachide.'),
  entry('AVERSIONS' as FileSectionDto['field'], 'Pas de poisson.'),
  entry('TASTES' as FileSectionDto['field'], 'Aime les fruits.'),
];

export const brief: Brief = {
  patient: {
    id: PATIENT_ID,
    firstName: 'Martine',
    lastName: 'Roux',
    sex: 'F',
    dateOfBirth: patient.dateOfBirth,
    birthDateEstimated: false,
    age: 56,
    phone: patient.phone,
    email: patient.email,
    familySituation: patient.familySituation,
    profession: patient.profession,
    gpName: patient.gpName,
    consultationReason: 'Perte de poids',
    referralSource: patient.referralSource,
    createdAt: patient.createdAt,
  },
  consultationCount: 3,
  firstConsultationAt: '2026-09-23T09:00:00.000Z',
  lastConsultation: {
    id: 'c-3',
    date: '2026-11-15T09:00:00.000Z',
    habits: 'Plus de grignotage.',
    sessionWork: 'Point sur les repas au restaurant.',
    advice: 'Une entrée ou un dessert, pas les deux.',
  },
  nextAppointment: null,
  metrics: [
    {
      type: 'WEIGHT',
      count: 3,
      first: { value: 79, measuredAt: '2026-09-23T00:00:00.000Z' },
      previous: { value: 78.2, measuredAt: '2026-10-23T00:00:00.000Z' },
      latest: { value: 76.5, measuredAt: '2026-11-15T00:00:00.000Z' },
    },
  ],
  bmi: { current: { value: 30.26, category: 'OBESITY' }, atStart: { value: 31.25, category: 'OBESITY' } },
  bmr: { mj: 5.77, kcal: 1378.9 },
  missing: [],
  file: sections,
  recentEvents: [],
  newEventsSinceLastConsultation: 0,
  openTasks: [],
  latestGpReport: { id: 'g-1', date: '2026-11-21T00:00:00.000Z', status: 'DRAFT', sentAt: null },
  gpReportToDo: true,
};

export const measurements: Measurement[] = [
  { id: 'm-h', type: 'HEIGHT', value: 159, measuredAt: '2026-09-23T00:00:00.000Z' },
  { id: 'm-1', type: 'WEIGHT', value: 79, measuredAt: '2026-09-23T00:00:00.000Z', consultationId: 'c-1' },
  { id: 'm-2', type: 'WEIGHT', value: 78.2, measuredAt: '2026-10-23T00:00:00.000Z', consultationId: 'c-2' },
  { id: 'm-3', type: 'WEIGHT', value: 76.5, measuredAt: '2026-11-15T00:00:00.000Z', consultationId: 'c-3' },
];

const session = (
  id: string,
  sequence: number,
  date: string,
  weight: number,
  bmi: number,
  mj: number,
  kcal: number,
  extra: Partial<Consultation> = {},
): Consultation => ({
  id,
  patientId: PATIENT_ID,
  practitionerId: 'u-1',
  appointmentId: null,
  date,
  formulaId: 'f',
  formulaLabel: sequence === 0 ? 'Bilan' : 'Suivi',
  priceCents: sequence === 0 ? 6000 : 5000,
  paymentMethod: 'CHECK' as Consultation['paymentMethod'],
  habits: null,
  sessionWork: null,
  advice: null,
  createdAt: date,
  updatedAt: date,
  sequence,
  figures: { age: 56, weight, bmi: { value: bmi, category: 'OBESITY' }, bmr: { mj, kcal }, missing: [] },
  weightChange: { sincePrevious: null, sinceFirst: null },
  previousAdvice: null,
  ...extra,
});

/** Latest first, as the API lists them. */
export const sessions: Consultation[] = [
  session('c-3', 2, '2026-11-15T09:00:00.000Z', 76.5, 30.26, 5.77, 1378.9, {
    paymentMethod: 'NONE' as Consultation['paymentMethod'],
    weightChange: { sincePrevious: -1.7, sinceFirst: -2.5 },
  }),
  session('c-2', 1, '2026-10-23T09:00:00.000Z', 78.2, 30.93, 5.83, 1393.5, {
    habits: 'Petit-déjeuner pris 5 jours sur 7.',
    sessionWork: 'Travail sur la faim.',
    advice: 'Préparer la collation la veille.',
    weightChange: { sincePrevious: -0.8, sinceFirst: -0.8 },
  }),
  session('c-1', 0, '2026-09-23T09:00:00.000Z', 79, 31.25, 5.86, 1400.3),
];

/** Answers GET requests by path, like the API would. */
export function apiGet(routes: Record<string, unknown>) {
  return async (url: string) => {
    const path = url.split('?')[0];
    if (!(path in routes)) throw new Error(`Unexpected GET ${url}`);
    return { data: routes[path] };
  };
}

export const ROUTES = {
  [`/patients/${PATIENT_ID}`]: patient,
  [`/patients/${PATIENT_ID}/brief`]: brief,
  [`/patients/${PATIENT_ID}/file`]: sections,
  [`/patients/${PATIENT_ID}/measurements`]: measurements,
  [`/patients/${PATIENT_ID}/life-events`]: [],
  [`/patients/${PATIENT_ID}/consultations`]: sessions,
  [`/patients/${PATIENT_ID}/file-entries`]: [
    { id: 'e-psy-2', field: 'PSYCHOLOGY', content: 'Grignotage lié au stress.', date: '2026-11-15T00:00:00.000Z' },
    { id: 'e-psy-1', field: 'PSYCHOLOGY', content: 'Grignote le soir.', date: '2026-09-23T00:00:00.000Z' },
  ],
};

/** Renders with a fresh query cache, inside a router (other paths show their name). */
export function renderWithProviders(ui: ReactNode, path = '/'): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function CurrentPath() {
  return <p>Page : {useLocation().pathname}</p>;
}
