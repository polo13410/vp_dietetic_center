/**
 * Figures computed from the patient's data, never stored. Formulas are the ones of the
 * practitioner's Numbers sheet (docs/REFONTE.md § 3.1).
 */
import type { Sex } from '@prisma/client';

/** BMI categories, from the practice's reference table. */
export type BmiCategory = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY' | 'MASSIVE_OBESITY';

export interface Bmi {
  value: number;
  category: BmiCategory;
}

/** Basal metabolic rate per day. */
export interface Bmr {
  mj: number;
  kcal: number;
}

/** What is needed for a figure and not known yet, so the screen can ask for it. */
export type MissingData = 'weight' | 'height' | 'sex' | 'age';

/** Black et al. constant: `=SI(Sexe="F";0,963;1,083)`. */
export const BMR_CONSTANT: Record<Sex, number> = { F: 0.963, M: 1.083 };

const KJ_PER_KCAL = 4.185;

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * BMI = weight (kg) / height (m)², rounded to two decimals like her sheet, then classified:
 * < 18.5 maigreur · 18.5–24.9 normal · 25–29.9 surpoids · 30–39.9 obésité · ≥ 40 obésité massive.
 * Returns null when either value is missing or not usable.
 */
export function computeBmi(weightKg?: number | null, heightCm?: number | null): Bmi | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const value = round(weightKg / (heightM * heightM), 2);
  return { value, category: bmiCategory(value) };
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
 * (as in her sheet). Returns null when anything is missing.
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
  return { mj: round(mj, 2), kcal: round((mj * 1000) / KJ_PER_KCAL, 1) };
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

/**
 * When only the age is known ("56 ans"), the birth date stored is January 1st of the estimated
 * birth year: the age on `today` is then exactly the declared one.
 */
export function estimatedBirthDate(age: number, today = new Date()): Date {
  return new Date(Date.UTC(today.getUTCFullYear() - age, 0, 1));
}

/** Weight, BMI and BMR of a session, and what is missing to compute them. */
export function sessionFigures(input: {
  sex?: Sex | null;
  dateOfBirth?: Date | null;
  heightCm?: number | null;
  weightKg?: number | null;
  date: Date;
}) {
  const age = ageAt(input.dateOfBirth, input.date);
  const weight = input.weightKg ?? null;
  const height = input.heightCm ?? null;
  const missing: MissingData[] = [];
  if (!weight) missing.push('weight');
  if (!height) missing.push('height');
  if (!input.sex) missing.push('sex');
  if (age === null) missing.push('age');
  return {
    age,
    weight,
    bmi: computeBmi(weight, height),
    bmr: computeBmr({ sex: input.sex, weightKg: weight, heightCm: height, age }),
    missing,
  };
}

/** Difference between two weights, rounded to the gram range we display (0.01 kg). */
export function weightDelta(current: number | null, reference: number | null | undefined) {
  if (current === null || reference === null || reference === undefined) return null;
  return round(current - reference, 2);
}
