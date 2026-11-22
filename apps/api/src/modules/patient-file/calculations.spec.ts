import { describe, expect, it } from 'vitest';

import {
  ageAt,
  bmiCategory,
  computeBmi,
  computeBmr,
  estimatedBirthDate,
  sessionFigures,
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

  it('computes weight changes', () => {
    expect(weightDelta(78.2, 79)).toBe(-0.8);
    expect(weightDelta(76.5, 79)).toBe(-2.5);
    expect(weightDelta(null, 79)).toBeNull();
    expect(weightDelta(79, null)).toBeNull();
  });
});
