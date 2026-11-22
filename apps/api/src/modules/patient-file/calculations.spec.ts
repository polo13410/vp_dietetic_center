import { describe, expect, it } from 'vitest';

import {
  ageAt,
  bmiCategory,
  computeBmi,
  computeBmr,
  estimatedBirthDate,
  sessionFigures,
  sessionSeries,
  weightDelta,
} from './calculations';

describe('calculations (docs/REFONTE.md § 3.1)', () => {
  // Test case from her sheet: woman, 56 years old, 1.59 m
  const patient = { sex: 'F' as const, heightCm: 159, age: 56 };

  it.each([
    [79, 5.86, 1400.3],
    [78.2, 5.83, 1393.5],
    [76.5, 5.77, 1378.9],
  ])('BMR at %d kg is %d MJ and %d kcal', (weightKg, mj, kcal) => {
    expect(computeBmr({ ...patient, weightKg })).toEqual({ mj, kcal });
  });

  it('BMI at 79 kg and 1.59 m is 31.25', () => {
    expect(computeBmi(79, 159)).toEqual({ value: 31.25, category: 'OBESITY' });
  });

  it('uses the male constant', () => {
    const woman = computeBmr({ ...patient, weightKg: 79 })!;
    const man = computeBmr({ ...patient, sex: 'M', weightKg: 79 })!;
    expect(man.mj / woman.mj).toBeCloseTo(1.083 / 0.963, 2);
  });

  it('needs sex, weight, height and age for the BMR', () => {
    expect(computeBmr({ ...patient, sex: null, weightKg: 79 })).toBeNull();
    expect(computeBmr({ ...patient, weightKg: null })).toBeNull();
    expect(computeBmr({ ...patient, heightCm: undefined, weightKg: 79 })).toBeNull();
    expect(computeBmr({ ...patient, age: null, weightKg: 79 })).toBeNull();
  });

  describe('BMI', () => {
    it('rounds to two decimals', () => {
      expect(computeBmi(70, 175)).toEqual({ value: 22.86, category: 'NORMAL' });
    });

    it('classifies with the practice thresholds', () => {
      expect(bmiCategory(18.4)).toBe('UNDERWEIGHT');
      expect(bmiCategory(18.5)).toBe('NORMAL');
      expect(bmiCategory(24.99)).toBe('NORMAL');
      expect(bmiCategory(25)).toBe('OVERWEIGHT');
      expect(bmiCategory(29.99)).toBe('OVERWEIGHT');
      expect(bmiCategory(30)).toBe('OBESITY');
      expect(bmiCategory(39.99)).toBe('OBESITY');
      expect(bmiCategory(40)).toBe('MASSIVE_OBESITY');
    });

    it('needs both a weight and a height', () => {
      expect(computeBmi(70, null)).toBeNull();
      expect(computeBmi(undefined, 175)).toBeNull();
      expect(computeBmi(0, 175)).toBeNull();
    });
  });

  describe('age', () => {
    const born = new Date('1970-06-15');

    it('is counted on the given date', () => {
      expect(ageAt(born, new Date('2026-06-14T10:00:00Z'))).toBe(55);
      expect(ageAt(born, new Date('2026-06-15T10:00:00Z'))).toBe(56);
      expect(ageAt(born, new Date('2027-01-10T10:00:00Z'))).toBe(56);
    });

    it('is unknown without a birth date', () => {
      expect(ageAt(null, new Date())).toBeNull();
    });

    it('turns a declared age into January 1st of the estimated birth year', () => {
      const today = new Date('2026-11-22T10:00:00Z');
      const birth = estimatedBirthDate(56, today);
      expect(birth.toISOString()).toBe('1970-01-01T00:00:00.000Z');
      expect(ageAt(birth, today)).toBe(56);
    });
  });

  describe('session figures', () => {
    const base = {
      sex: 'F' as const,
      dateOfBirth: estimatedBirthDate(56, new Date('2026-11-22T00:00:00Z')),
      heightCm: 159,
      date: new Date('2026-11-22T10:00:00Z'),
    };

    it('computes everything for the test patient', () => {
      expect(sessionFigures({ ...base, weightKg: 79 })).toEqual({
        age: 56,
        weight: 79,
        bmi: { value: 31.25, category: 'OBESITY' },
        bmr: { mj: 5.86, kcal: 1400.3 },
        missing: [],
      });
    });

    it('says what is missing', () => {
      expect(
        sessionFigures({ date: base.date, sex: null, dateOfBirth: null, heightCm: null, weightKg: 79 }),
      ).toMatchObject({ bmi: null, bmr: null, missing: ['height', 'sex', 'age'] });
      expect(sessionFigures({ ...base, weightKg: null }).missing).toEqual(['weight']);
    });
  });

  describe('session series', () => {
    const woman = {
      sex: 'F' as const,
      dateOfBirth: new Date('1970-01-01'),
      heightCm: 159,
    };
    const session = (id: string, date: string, weightKg: number | null, advice: string | null) => ({
      id,
      date: new Date(date),
      weightKg,
      advice,
    });

    it('follows her sheet: bilan, then each follow-up with its change in weight', () => {
      const series = sessionSeries(woman, [
        session('bilan', '2026-09-01T10:00:00Z', 79, 'Petit-déjeuner'),
        session('suivi1', '2026-10-01T10:00:00Z', 78.2, 'Collation à 16 h'),
        session('suivi2', '2026-11-01T10:00:00Z', null, null),
        session('suivi3', '2026-11-22T10:00:00Z', 76.5, 'Continuer'),
      ]);

      expect(series.get('bilan')).toMatchObject({
        sequence: 0,
        figures: { age: 56, weight: 79, bmi: { value: 31.25 }, bmr: { mj: 5.86, kcal: 1400.3 } },
        weightChange: { sincePrevious: null, sinceFirst: null },
        previousAdvice: null,
      });
      expect(series.get('suivi1')).toMatchObject({
        sequence: 1,
        figures: { bmr: { mj: 5.83, kcal: 1393.5 } },
        weightChange: { sincePrevious: -0.8, sinceFirst: -0.8 },
        previousAdvice: 'Petit-déjeuner',
      });
      // Not weighed: nothing to compute, the advice still follows
      expect(series.get('suivi2')).toMatchObject({
        figures: { weight: null, bmi: null, bmr: null, missing: ['weight'] },
        weightChange: { sincePrevious: null, sinceFirst: null },
        previousAdvice: 'Collation à 16 h',
      });
      // Compared with the latest weighed session
      expect(series.get('suivi3')).toMatchObject({
        sequence: 3,
        figures: { bmr: { mj: 5.77, kcal: 1378.9 } },
        weightChange: { sincePrevious: -1.7, sinceFirst: -2.5 },
        previousAdvice: null,
      });
    });
  });

  it('computes weight changes', () => {
    expect(weightDelta(78.2, 79)).toBe(-0.8);
    expect(weightDelta(76.5, 79)).toBe(-2.5);
    expect(weightDelta(null, 79)).toBeNull();
    expect(weightDelta(79, null)).toBeNull();
  });
});
