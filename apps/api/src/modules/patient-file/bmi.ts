/** BMI categories, from the practice's reference table. */
export type BmiCategory = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY' | 'MASSIVE_OBESITY';

export interface Bmi {
  value: number;
  category: BmiCategory;
}

/**
 * BMI = weight (kg) / height (m)², rounded to one decimal, then classified:
 * < 18.5 maigreur · 18.5–24.9 normal · 25–29.9 surpoids · 30–39.9 obésité · ≥ 40 obésité massive.
 * Returns null when either value is missing or not usable.
 */
export function computeBmi(weightKg?: number | null, heightCm?: number | null): Bmi | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const value = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  return { value, category: bmiCategory(value) };
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'UNDERWEIGHT';
  if (bmi < 25) return 'NORMAL';
  if (bmi < 30) return 'OVERWEIGHT';
  if (bmi < 40) return 'OBESITY';
  return 'MASSIVE_OBESITY';
}
