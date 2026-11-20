/** The patient's file: types, French labels and data hooks, shared by the file and session screens. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import api from './api';

// ─── Types (as returned by the API) ──────────────────────────────────────────

export type MetricType =
  | 'WEIGHT'
  | 'HEIGHT'
  | 'WAIST'
  | 'HIP'
  | 'BODY_FAT'
  | 'MUSCLE_MASS'
  | 'ENERGY'
  | 'SLEEP_QUALITY'
  | 'STRESS'
  | 'HUNGER';
export type PatientTopic = 'EATING' | 'ACTIVITY' | 'SLEEP' | 'EMOTIONS' | 'DIGESTION' | 'HEALTH' | 'LIFE';
export type LifeEventCategory = 'HEALTH' | 'TREATMENT' | 'FAMILY' | 'WORK' | 'HOME' | 'OTHER';
export type GoalStatus = 'IN_PROGRESS' | 'ACHIEVED' | 'PARTIAL' | 'ABANDONED';
export type BmiCategory = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY' | 'MASSIVE_OBESITY';

export interface Bmi {
  value: number;
  category: BmiCategory;
}

export interface Measurement {
  id: string;
  type: MetricType;
  value: number;
  measuredAt: string;
  note?: string | null;
  consultationId?: string | null;
}

export interface TopicNote {
  id: string;
  topic: PatientTopic;
  content: string;
  createdAt: string;
  consultationId?: string | null;
  consultation?: { id: string; date: string } | null;
}

export interface LifeEvent {
  id: string;
  date: string;
  title: string;
  description?: string | null;
  category: LifeEventCategory;
  consultationId?: string | null;
}

export interface GoalReview {
  id: string;
  status: GoalStatus;
  comment?: string | null;
  createdAt: string;
  consultationId: string;
  consultation?: { id: string; date: string };
  goal?: { id: string; title: string };
}

export interface Goal {
  id: string;
  title: string;
  details?: string | null;
  status: GoalStatus;
  createdAt: string;
  closedAt?: string | null;
  consultationId?: string | null;
  consultation?: { id: string; date: string } | null;
  reviews?: GoalReview[];
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
    dateOfBirth: string | null;
    consultationReason: string | null;
    allergies: string | null;
    dietaryRestrictions: string | null;
    privateNote: string | null;
  };
  consultationCount: number;
  firstConsultationAt: string | null;
  lastConsultation: { id: string; date: string; summary: string | null; advice: string | null } | null;
  nextAppointment: { id: string; startAt: string; type: string; reason: string | null } | null;
  metrics: MetricSummary[];
  bmi: { current: Bmi | null; atStart: Bmi | null };
  topics: TopicNote[];
  recentEvents: LifeEvent[];
  newEventsSinceLastConsultation: number;
  openGoals: (Goal & { reviews: GoalReview[] })[];
  openTasks: { id: string; title: string; priority: string; dueAt: string | null }[];
}

export interface Consultation {
  id: string;
  patientId: string;
  appointmentId: string | null;
  date: string;
  summary: string | null;
  advice: string | null;
  status: 'DRAFT' | 'FINALIZED';
  finalizedAt: string | null;
  patient?: { id: string; firstName: string; lastName: string };
  appointment?: { id: string; startAt: string; duration: number; type: string; reason: string | null } | null;
  measurements?: Measurement[];
  topicNotes?: TopicNote[];
  lifeEvents?: LifeEvent[];
  goals?: Goal[];
  goalReviews?: GoalReview[];
  _count?: { measurements: number; topicNotes: number; lifeEvents: number; goals: number };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const METRICS: Record<MetricType, { label: string; unit: string; scale?: boolean; step: number }> = {
  WEIGHT: { label: 'Poids', unit: 'kg', step: 0.1 },
  HEIGHT: { label: 'Taille', unit: 'cm', step: 1 },
  WAIST: { label: 'Tour de taille', unit: 'cm', step: 0.5 },
  HIP: { label: 'Tour de hanches', unit: 'cm', step: 0.5 },
  BODY_FAT: { label: 'Masse grasse', unit: '%', step: 0.1 },
  MUSCLE_MASS: { label: 'Masse musculaire', unit: 'kg', step: 0.1 },
  ENERGY: { label: 'Énergie', unit: '/10', scale: true, step: 1 },
  SLEEP_QUALITY: { label: 'Qualité du sommeil', unit: '/10', scale: true, step: 1 },
  STRESS: { label: 'Stress', unit: '/10', scale: true, step: 1 },
  HUNGER: { label: 'Faim', unit: '/10', scale: true, step: 1 },
};
export const METRIC_TYPES = Object.keys(METRICS) as MetricType[];

export const TOPICS: Record<PatientTopic, { label: string; hint: string }> = {
  EATING: { label: 'Alimentation', hint: 'Repas, horaires, grignotage, préférences' },
  ACTIVITY: { label: 'Activité physique', hint: 'Sport, marche, sédentarité' },
  SLEEP: { label: 'Sommeil', hint: 'Durée, qualité, réveils' },
  EMOTIONS: { label: 'Stress & émotions', hint: 'Rapport à la nourriture, émotions, stress' },
  DIGESTION: { label: 'Digestion & transit', hint: 'Ballonnements, transit, inconforts' },
  HEALTH: { label: 'Santé & traitements', hint: 'Pathologies, traitements, bilans' },
  LIFE: { label: 'Contexte de vie', hint: 'Famille, travail, rythme de vie' },
};
export const TOPIC_TYPES = Object.keys(TOPICS) as PatientTopic[];

export const EVENT_CATEGORIES: Record<LifeEventCategory, string> = {
  HEALTH: 'Santé',
  TREATMENT: 'Traitement',
  FAMILY: 'Famille',
  WORK: 'Travail / études',
  HOME: 'Logement',
  OTHER: 'Autre',
};

export const GOAL_STATUSES: Record<GoalStatus, { label: string; className: string }> = {
  IN_PROGRESS: {
    label: 'En cours',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  PARTIAL: {
    label: 'Partiellement',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  ACHIEVED: {
    label: 'Atteint',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  ABANDONED: { label: 'Abandonné', className: 'bg-muted text-muted-foreground border-border' },
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
  const { unit, scale } = METRICS[type];
  const n = value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return scale ? `${n}${unit}` : `${n} ${unit}`;
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
export const useTopicNotes = (patientId?: string) => usePatientList<TopicNote>(patientId, 'topic-notes');
export const useLifeEvents = (patientId?: string) => usePatientList<LifeEvent>(patientId, 'life-events');
export const useGoals = (patientId?: string) => usePatientList<Goal>(patientId, 'goals');
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
