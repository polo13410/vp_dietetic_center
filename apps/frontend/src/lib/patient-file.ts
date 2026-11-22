/** The patient's file: types, French labels and data hooks, shared by the file and session screens. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BmiCategory,
  BmiDto as Bmi,
  ConsultationDto,
  FileEntryDto,
  FileField as FileFieldEnum,
  FileSectionDto,
  GpReportStatus,
  MissingData,
  PatientDto,
  PaymentMethod as PaymentMethodEnum,
} from '@vp/types';

import type { BadgeTone } from '../components/shared/StatusBadge';

import api from './api';

// ─── Types (as returned by the API) ──────────────────────────────────────────

export type { Bmi, BmiCategory, FileEntryDto, FileSectionDto, MissingData };

/** The patient as returned by GET /patients/:id (clinical fields only for the practitioner). */
export interface Patient extends PatientDto {
  bmi?: Bmi | null;
  _count?: { appointments: number; consultations: number; documents: number; tasks: number };
}
/** The enums' values as plain strings, so labels and literals can be used without the enum */
export type FileField = `${FileFieldEnum}`;
export type PaymentMethod = `${PaymentMethodEnum}`;

export type MetricType = 'WEIGHT' | 'HEIGHT' | 'WAIST' | 'HIP' | 'BODY_FAT' | 'MUSCLE_MASS';
export type LifeEventCategory = 'HEALTH' | 'TREATMENT' | 'FAMILY' | 'WORK' | 'HOME' | 'OTHER';

export interface Measurement {
  id: string;
  type: MetricType;
  value: number;
  measuredAt: string;
  note?: string | null;
  consultationId?: string | null;
}

export interface LifeEvent {
  id: string;
  date: string;
  title: string;
  category: LifeEventCategory | null;
  consultationId?: string | null;
}

export interface MetricSummary {
  type: MetricType;
  count: number;
  first: { value: number; measuredAt: string };
  previous: { value: number; measuredAt: string } | null;
  latest: { value: number; measuredAt: string };
}

export interface Brief {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    sex: 'F' | 'M' | null;
    dateOfBirth: string | null;
    birthDateEstimated: boolean;
    age: number | null;
    phone: string | null;
    email: string | null;
    familySituation: string | null;
    profession: string | null;
    gpName: string | null;
    consultationReason: string | null;
    referralSource: string | null;
    createdAt: string;
  };
  consultationCount: number;
  firstConsultationAt: string | null;
  lastConsultation: {
    id: string;
    date: string;
    habits: string | null;
    sessionWork: string | null;
    advice: string | null;
  } | null;
  nextAppointment: { id: string; startAt: string; type: string; reason: string | null } | null;
  metrics: MetricSummary[];
  bmi: { current: Bmi | null; atStart: Bmi | null };
  bmr: { mj: number; kcal: number } | null;
  missing: MissingData[];
  file: FileSectionDto[];
  recentEvents: LifeEvent[];
  newEventsSinceLastConsultation: number;
  openTasks: { id: string; title: string; priority: string; dueAt: string | null }[];
  latestGpReport: { id: string; date: string; status: `${GpReportStatus}`; sentAt: string | null } | null;
  /** The latest report to the GP is a draft */
  gpReportToDo: boolean;
}

/** An appointment, as listed in the patient's file. */
export interface PatientAppointment {
  id: string;
  startAt: string;
  duration: number;
  reason?: string | null;
  type: string;
  status: string;
}

/** Today's appointment a session can be started from (« Démarrer la séance du jour »). */
export function todaysAppointment(appointments: PatientAppointment[], now = new Date()) {
  const today = now.toDateString();
  return appointments.find(
    (a) => new Date(a.startAt).toDateString() === today && ['SCHEDULED', 'CONFIRMED'].includes(a.status),
  );
}

export function usePatientAppointments(patientId: string | undefined) {
  return useQuery({
    queryKey: ['appointments', { patientId }],
    queryFn: async () => {
      const { data } = await api.get('/appointments', { params: { patientId, limit: 50 } });
      return (data.data ?? data) as PatientAppointment[];
    },
    enabled: !!patientId,
  });
}

/** A session, as listed (follow-up sheet) or opened (with what was recorded in it). */
export interface Consultation extends ConsultationDto {
  patient?: { id: string; firstName: string; lastName: string };
  appointment?: { id: string; startAt: string; duration?: number; type: string; reason?: string | null } | null;
  measurements?: Measurement[];
  fileEntries?: FileEntryDto[];
  lifeEvents?: LifeEvent[];
  _count?: { measurements: number; fileEntries: number; lifeEvents: number };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const METRICS: Record<MetricType, { label: string; unit: string; step: number }> = {
  WEIGHT: { label: 'Poids', unit: 'kg', step: 0.1 },
  HEIGHT: { label: 'Taille', unit: 'cm', step: 1 },
  WAIST: { label: 'Tour de taille', unit: 'cm', step: 0.5 },
  HIP: { label: 'Tour de hanches', unit: 'cm', step: 0.5 },
  BODY_FAT: { label: 'Masse grasse', unit: '%', step: 0.1 },
  MUSCLE_MASS: { label: 'Masse musculaire', unit: 'kg', step: 0.1 },
};
export const METRIC_TYPES = Object.keys(METRICS) as MetricType[];

/** Sections of the medical file, with her labels, in her order. */
export const FILE_FIELDS: Record<FileField, string> = {
  HEALTH: 'Santé, maladies',
  FAMILY_HISTORY: 'Antécédents familiaux',
  PSYCHOLOGY: 'Psy',
  PHYSICAL_ACTIVITY: 'Activité physique et sportive',
  WEIGHT_HISTORY: 'Histoire du poids et régimes',
  ALLERGIES: 'Allergies',
  BLOOD_GLUCOSE: 'Glycémie',
  CHOLESTEROL_TRIGLYCERIDES: 'Cholestérol et triglycérides',
  AVERSIONS: 'Aversions',
  TASTES: 'Goûts',
};
export const FILE_FIELD_TYPES = Object.keys(FILE_FIELDS) as FileField[];

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CHECK: 'Chèque',
  CARD: 'Carte',
  TRANSFER: 'Virement',
  NONE: 'Non réglé',
};

/** « Bilan » for the first session, then « Suivi 1 », « Suivi 2 »… */
export function sessionName(sequence: number): string {
  return sequence === 0 ? 'Bilan' : `Suivi ${sequence}`;
}

export const EVENT_CATEGORIES: Record<LifeEventCategory, string> = {
  HEALTH: 'Santé',
  TREATMENT: 'Traitement',
  FAMILY: 'Famille',
  WORK: 'Travail / études',
  HOME: 'Logement',
  OTHER: 'Autre',
};

/** BMI categories (thresholds are computed by the API), shown with the semantic tones. */
export const BMI_CATEGORIES: Record<BmiCategory, { label: string; tone: BadgeTone }> = {
  UNDERWEIGHT: { label: 'Maigreur', tone: 'info' },
  NORMAL: { label: 'Normal', tone: 'success' },
  OVERWEIGHT: { label: 'Surpoids', tone: 'warning' },
  OBESITY: { label: 'Obésité', tone: 'warning' },
  MASSIVE_OBESITY: { label: 'Obésité massive', tone: 'danger' },
};

/** The constant of her BMR formula (§ 3.1), shown « 0,96 » like on her sheet. */
export function bmrConstant(sex: 'F' | 'M' | null | undefined): number | null {
  if (sex === 'F') return 0.963;
  if (sex === 'M') return 1.083;
  return null;
}

const MISSING_LABELS: Record<MissingData, string> = {
  weight: 'le poids',
  height: 'la taille',
  sex: 'le sexe',
  age: 'l’âge',
};

/**
 * What to add for a figure, in her words: « Ajoutez la taille pour calculer l’IMC ».
 * Null when nothing is missing for that figure.
 */
export function missingMessage(missing: MissingData[], figure: 'bmi' | 'bmr'): string | null {
  const needed: MissingData[] = figure === 'bmi' ? ['weight', 'height'] : ['weight', 'height', 'sex', 'age'];
  const lacking = needed.filter((m) => missing.includes(m)).map((m) => MISSING_LABELS[m]);
  if (lacking.length === 0) return null;
  const list = lacking.length === 1 ? lacking[0] : `${lacking.slice(0, -1).join(', ')} et ${lacking.at(-1)}`;
  return `Ajoutez ${list} pour calculer ${figure === 'bmi' ? 'l’IMC' : 'le MB'}`;
}

/** A price in cents as « 50 € ». */
export function formatPrice(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
}

export function formatMetric(type: MetricType, value: number): string {
  const n = value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return `${n} ${METRICS[type].unit}`;
}

/** "+1,5 kg" / "−2 kg" / "=" */
export function formatDelta(type: MetricType, delta: number): string {
  if (Math.abs(delta) < 0.05) return '=';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${formatMetric(type, Math.abs(delta))}`;
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

const fileKey = (patientId: string) => ['patient-file', patientId] as const;

export function usePatient(patientId: string | undefined) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => (await api.get<Patient>(`/patients/${patientId}`)).data,
    enabled: !!patientId,
  });
}

/** The current value of each section of the medical file, in her order. */
export function useFileSections(patientId: string | undefined) {
  return useQuery({
    queryKey: [...fileKey(patientId ?? ''), 'file'],
    queryFn: async () => (await api.get<FileSectionDto[]>(`/patients/${patientId}/file`)).data,
    enabled: !!patientId,
  });
}

/**
 * The summary before a session. With `beforeSessionId`, as it was before that session (its
 * « Rappel »): the session itself and later ones are left out.
 */
export function usePatientBrief(patientId: string | undefined, beforeSessionId?: string) {
  return useQuery({
    queryKey: [...fileKey(patientId ?? ''), 'brief', ...(beforeSessionId ? [beforeSessionId] : [])],
    queryFn: async () =>
      (
        await api.get<Brief>(`/patients/${patientId}/brief`, {
          params: beforeSessionId ? { before: beforeSessionId } : undefined,
        })
      ).data,
    enabled: !!patientId,
  });
}

export function usePatientList<T>(patientId: string | undefined, resource: string) {
  return useQuery({
    queryKey: [...fileKey(patientId ?? ''), resource],
    queryFn: async () => (await api.get<T[]>(`/patients/${patientId}/${resource}`)).data,
    enabled: !!patientId,
  });
}

export const useMeasurements = (patientId?: string) => usePatientList<Measurement>(patientId, 'measurements');
export const useFileEntries = (patientId?: string) => usePatientList<FileEntryDto>(patientId, 'file-entries');
export const useLifeEvents = (patientId?: string) => usePatientList<LifeEvent>(patientId, 'life-events');
export const useConsultations = (patientId?: string) => usePatientList<Consultation>(patientId, 'consultations');

export function useConsultation(id: string | undefined) {
  return useQuery({
    queryKey: ['consultation', id],
    queryFn: async () => (await api.get<Consultation>(`/consultations/${id}`)).data,
    enabled: !!id,
  });
}

/** Refreshes everything shown about a patient (file, brief, sessions, patient header/list). */
export function useInvalidatePatientFile() {
  const queryClient = useQueryClient();
  return (patientId: string) => {
    queryClient.invalidateQueries({ queryKey: fileKey(patientId) });
    queryClient.invalidateQueries({ queryKey: ['consultation'] });
    queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
    queryClient.invalidateQueries({ queryKey: ['patients'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    // An invoice may no longer match its session
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };
}

type Method = 'post' | 'patch' | 'delete' | 'put';

/** A write to the patient's file that refreshes what depends on it. */
export function usePatientFileMutation<TVars>(
  patientId: string,
  request: (vars: TVars) => { method: Method; url: string; body?: unknown },
) {
  const invalidate = useInvalidatePatientFile();
  return useMutation({
    mutationFn: async (vars: TVars) => {
      const { method, url, body } = request(vars);
      return (await api.request({ method, url, data: body })).data;
    },
    onSuccess: () => invalidate(patientId),
  });
}
