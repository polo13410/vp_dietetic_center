/** The patient's file: types, French labels and data hooks, shared by the file and session screens. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BmiCategory,
  BmiDto as Bmi,
  ConsultationDto,
  FileEntryDto,
  FileField as FileFieldEnum,
  FileSectionDto,
  MissingData,
  PaymentMethod as PaymentMethodEnum,
} from '@vp/types';

import api from './api';

// ─── Types (as returned by the API) ──────────────────────────────────────────

export type { Bmi, BmiCategory, FileEntryDto, FileSectionDto };
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
    familySituation: string | null;
    profession: string | null;
    gpName: string | null;
    consultationReason: string | null;
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

/** BMI categories (thresholds are computed by the API). */
export const BMI_CATEGORIES: Record<BmiCategory, { label: string; className: string }> = {
  UNDERWEIGHT: {
    label: 'Maigreur',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  NORMAL: {
    label: 'Normal',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  OVERWEIGHT: {
    label: 'Surpoids',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  OBESITY: {
    label: 'Obésité',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
  MASSIVE_OBESITY: {
    label: 'Obésité massive',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
  },
};

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

export function usePatientBrief(patientId: string | undefined) {
  return useQuery({
    queryKey: [...fileKey(patientId ?? ''), 'brief'],
    queryFn: async () => (await api.get<Brief>(`/patients/${patientId}/brief`)).data,
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
