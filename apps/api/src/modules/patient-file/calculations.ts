/**
 * Figures computed from the patient's data, never stored. Formulas are the ones of the
 * practitioner's Numbers sheet (docs/REFONTE.md § 3.1).
 */
import type { Sex } from '@prisma/client';

import {
  IOTF_MAX_AGE,
  IOTF_MIN_AGE,
  IOTF_SOURCES,
  IOTF_TABLE,
  type IotfClass,
  iotfClass,
  type IotfCutoffs,
  iotfCutoffs,
  type IotfRow,
} from './iotf';

/** Adult BMI categories and the Black formula apply from this age on (§ 3.1). */
export const ADULT_AGE = 18;

/** BMI categories, from the practice's reference table (adults only). */
export type BmiCategory = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY' | 'MASSIVE_OBESITY';

export interface Bmi {
  value: number;
  /** Adult category: 18 and over, or age unknown. Null under 18, where `child` applies instead. */
  category: BmiCategory | null;
  /** Under 18: where the BMI falls on the IOTF corpulence curves */
  child: ChildBmi | null;
}

export interface ChildBmi {
  /** Exact age at the measurement, in years (one decimal, rounded down) */
  ageYears: number;
  /** Null before 2 years (no IOTF cut-off) or when the sex is not known */
  class: IotfClass | null;
  /** The IOTF cut-offs at that age, when they apply */
  cutoffs: IotfCutoffs | null;
}

/** Basal metabolic rate per day. */
export interface Bmr {
  mj: number;
  kcal: number;
  /** The Black formula is an adult one: under 18 it is shown with « formule adulte » */
  adultFormulaForMinor: boolean;
}

/** A height measurement, in cm. */
export interface HeightPoint {
  value: number;
  measuredAt: Date;
}

/** What is needed for a figure and not known yet, so the screen can ask for it. */
export type MissingData = 'weight' | 'height' | 'sex' | 'age';

/** Black et al. constant: `=SI(Sexe="F";0,963;1,083)`. */
export const BMR_CONSTANT: Record<Sex, number> = { F: 0.963, M: 1.083 };

const KJ_PER_KCAL = 4.185;
const DAY_MS = 86_400_000;

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * BMI = weight (kg) / height (m)², rounded to two decimals like her sheet. From 18 years (or when
 * the age is not known) it gets the adult category:
 * < 18.5 maigreur · 18.5–24.9 normal · 25–29.9 surpoids · 30–39.9 obésité · ≥ 40 obésité massive.
 * Under 18 there is no adult category: the BMI is placed on the IOTF curves instead (`iotf.ts`).
 * Returns null when either value is missing or not usable.
 */
export function computeBmi(
  weightKg?: number | null,
  heightCm?: number | null,
  /** The patient's sex and exact age at the measurement (see `exactAgeAt`) */
  person?: { sex?: Sex | null; ageYears?: number | null },
): Bmi | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const value = round(weightKg / (heightM * heightM), 2);
  const ageYears = person?.ageYears;
  if (ageYears === null || ageYears === undefined || ageYears >= ADULT_AGE) {
    return { value, category: bmiCategory(value), child: null };
  }
  const cutoffs = person?.sex ? iotfCutoffs(person.sex, ageYears) : null;
  return {
    value,
    category: null,
    child: {
      ageYears: Math.floor(ageYears * 10) / 10,
      class: cutoffs ? iotfClass(value, cutoffs) : null,
      cutoffs,
    },
  };
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'UNDERWEIGHT';
  if (bmi < 25) return 'NORMAL';
  if (bmi < 30) return 'OVERWEIGHT';
  if (bmi < 40) return 'OBESITY';
  return 'MASSIVE_OBESITY';
}

/**
 * Black et al.: MJ = k × weight^0.48 × height(m)^0.5 × age^−0.13, and kcal = MJ × 1000 / 4.185.
 * MJ is rounded to two decimals and kcal to one, kcal being computed from the unrounded MJ
 * (as in her sheet). Returns null when anything is missing. It is an adult formula: under 18 the
 * result says so (`adultFormulaForMinor`).
 */
export function computeBmr(input: {
  sex?: Sex | null;
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
}): Bmr | null {
  const { sex, weightKg, heightCm, age } = input;
  if (!sex || !weightKg || !heightCm || !age || weightKg <= 0 || heightCm <= 0 || age <= 0) {
    return null;
  }
  const mj =
    BMR_CONSTANT[sex] * weightKg ** 0.48 * (heightCm / 100) ** 0.5 * age ** -0.13;
  return {
    mj: round(mj, 2),
    kcal: round((mj * 1000) / KJ_PER_KCAL, 1),
    adultFormulaForMinor: age < ADULT_AGE,
  };
}

/** Age in whole years on the given date (the session's date, for a long follow-up). */
export function ageAt(dateOfBirth: Date | null | undefined, at: Date): number | null {
  if (!dateOfBirth) return null;
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (at.getUTCMonth() === dateOfBirth.getUTCMonth() && at.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/** Exact age in years on the given day (for the IOTF curves, given every half year). */
export function exactAgeAt(dateOfBirth: Date | null | undefined, at: Date): number | null {
  if (!dateOfBirth) return null;
  const day = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const days = (day - dateOfBirth.getTime()) / DAY_MS;
  return days >= 0 ? days / 365.25 : null;
}

/** The calendar day of a date, as stored in a date-only column (« 2026-11-23 »). */
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The height to use on a date (§ 3.1): the latest one measured on or before that day, not the
 * latest overall, so a child's height follows growth and an old weight is computed with the
 * height of the time. An adult's height no longer changes: when nothing was measured before (a
 * weight history entered at the bilan), the first height measured is used. Under 18 there is no
 * such fallback. Heights may be given in any order.
 */
export function heightAt(
  heights: readonly HeightPoint[],
  at: Date,
  /** The patient is an adult on that date (18 or over, or age unknown) */
  adult: boolean,
): HeightPoint | null {
  const day = dayKey(at);
  let before: HeightPoint | null = null;
  let first: HeightPoint | null = null;
  for (const h of heights) {
    if (!first || h.measuredAt < first.measuredAt) first = h;
    if (dayKey(h.measuredAt) <= day && (!before || h.measuredAt >= before.measuredAt)) before = h;
  }
  return before ?? (adult ? first : null);
}

/**
 * When only the age is known ("56 ans"), the birth date stored is January 1st of the estimated
 * birth year: the age on `today` is then exactly the declared one.
 */
export function estimatedBirthDate(age: number, today = new Date()): Date {
  return new Date(Date.UTC(today.getUTCFullYear() - age, 0, 1));
}

/** What the figures of a patient are computed from: sex, birth date and every height measured. */
export interface PatientBasis {
  sex?: Sex | null;
  dateOfBirth?: Date | null;
  heights: readonly HeightPoint[];
}

/**
 * Weight, BMI and BMR on a date (a session, or any weight measurement), with the age and the
 * height known on that date, and what is missing to compute them.
 */
export function sessionFigures(input: PatientBasis & { weightKg?: number | null; date: Date }) {
  const age = ageAt(input.dateOfBirth, input.date);
  const minor = age !== null && age < ADULT_AGE;
  const weight = input.weightKg ?? null;
  const height = heightAt(input.heights, input.date, !minor);
  const missing: MissingData[] = [];
  if (!weight) missing.push('weight');
  if (!height) missing.push('height');
  if (!input.sex) missing.push('sex');
  if (age === null) missing.push('age');
  return {
    age,
    /** Under 18 on that date: no adult BMI category, BMR « formule adulte » */
    minor,
    weight,
    /** The height used, with its date */
    height,
    bmi: computeBmi(weight, height?.value, {
      sex: input.sex,
      ageYears: exactAgeAt(input.dateOfBirth, input.date),
    }),
    bmr: computeBmr({ sex: input.sex, weightKg: weight, heightCm: height?.value, age }),
    missing,
  };
}

/** Difference between two weights, rounded to 0.01 kg. */
export function weightDelta(current: number | null, reference: number | null | undefined) {
  if (current === null || reference === null || reference === undefined) return null;
  return round(current - reference, 2);
}

export type SessionFigures = ReturnType<typeof sessionFigures>;

export interface SessionInSeries {
  /** 0 for the first session ("Bilan"), then 1, 2… ("Suivi 1", "Suivi 2"…) */
  sequence: number;
  figures: SessionFigures;
  weightChange: {
    /** Since the latest earlier session with a weight */
    sincePrevious: number | null;
    /** Since the first session with a weight (normally the "Bilan") */
    sinceFirst: number | null;
  };
  /** Advice given at the session before this one, to review it */
  previousAdvice: string | null;
}

/**
 * The patient's follow-up sheet, one row per session: figures computed with the patient's sex,
 * age and height known at each session, and the change in weight. Sessions must be given
 * in chronological order; the result has one entry per session, by id.
 */
export function sessionSeries(
  patient: PatientBasis,
  sessions: { id: string; date: Date; advice: string | null; weightKg: number | null }[],
): Map<string, SessionInSeries> {
  const series = new Map<string, SessionInSeries>();
  let firstWeight: number | null = null;
  let previousWeight: number | null = null;
  sessions.forEach((session, index) => {
    const figures = sessionFigures({ ...patient, weightKg: session.weightKg, date: session.date });
    series.set(session.id, {
      sequence: index,
      figures,
      weightChange: {
        sincePrevious: weightDelta(figures.weight, previousWeight),
        sinceFirst: weightDelta(figures.weight, firstWeight),
      },
      previousAdvice: index > 0 ? (sessions[index - 1].advice ?? null) : null,
    });
    if (figures.weight !== null) {
      firstWeight ??= figures.weight;
      previousWeight = figures.weight;
    }
  });
  return series;
}

// ─── Corpulence chart (under 18) ──────────────────────────────────────────────

export interface CorpulenceChart {
  sex: Sex;
  /** The IOTF cut-offs of the patient's sex, every half year from 2 to 18 */
  cutoffs: readonly IotfRow[];
  /** The patient's BMI at each weight measured between 2 and 18 years, oldest first */
  points: { measurementId: string; measuredAt: Date; ageYears: number; bmi: number }[];
  sources: readonly string[];
}

/**
 * The corpulence chart of § 3.1: the patient's BMI against age on the IOTF curves, when the sex
 * is known and the patient was weighed between 2 and 18 years with a height known at the time.
 * Null otherwise.
 */
export function corpulenceChart(
  patient: PatientBasis,
  weights: readonly { id: string; value: number; measuredAt: Date }[],
): CorpulenceChart | null {
  if (!patient.sex || !patient.dateOfBirth) return null;
  const points = [...weights]
    .sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime())
    .flatMap((w) => {
      const ageYears = exactAgeAt(patient.dateOfBirth, w.measuredAt);
      if (ageYears === null || ageYears < IOTF_MIN_AGE || ageYears >= IOTF_MAX_AGE) return [];
      const bmi = computeBmi(w.value, heightAt(patient.heights, w.measuredAt, false)?.value);
      if (!bmi) return [];
      return [{ measurementId: w.id, measuredAt: w.measuredAt, ageYears: round(ageYears, 2), bmi: bmi.value }];
    });
  if (points.length === 0) return null;
  return { sex: patient.sex, cutoffs: IOTF_TABLE[patient.sex], points, sources: IOTF_SOURCES };
}
