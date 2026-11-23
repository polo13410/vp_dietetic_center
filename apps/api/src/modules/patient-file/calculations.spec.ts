import { describe, expect, it } from 'vitest';

import {
  ageAt,
  bmiCategory,
  computeBmi,
  computeBmr,
  corpulenceChart,
  estimatedBirthDate,
  exactAgeAt,
  heightAt,
  sessionFigures,
  sessionSeries,
  weightDelta,
} from './calculations';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('calculations (docs/REFONTE.md § 3.1)', () => {
  // Test case from her sheet: woman, 56 years old, 1.59 m
  const patient = { sex: 'F' as const, heightCm: 159, age: 56 };

  it.each([
    [79, 5.86, 1400.3],
    [78.2, 5.83, 1393.5],
    [76.5, 5.77, 1378.9],
  ])('BMR at %d kg is %d MJ and %d kcal', (weightKg, mj, kcal) => {
    expect(computeBmr({ ...patient, weightKg })).toEqual({ mj, kcal, adultFormulaForMinor: false });
  });

  it('BMI at 79 kg and 1.59 m is 31.25', () => {
    expect(computeBmi(79, 159)).toEqual({ value: 31.25, category: 'OBESITY', child: null });
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
      expect(computeBmi(70, 175)).toEqual({ value: 22.86, category: 'NORMAL', child: null });
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
      heights: [{ value: 159, measuredAt: day('2026-09-01') }],
      date: new Date('2026-11-22T10:00:00Z'),
    };

    it('computes everything for the test patient', () => {
      expect(sessionFigures({ ...base, weightKg: 79 })).toEqual({
        age: 56,
        minor: false,
        weight: 79,
        height: { value: 159, measuredAt: day('2026-09-01') },
        bmi: { value: 31.25, category: 'OBESITY', child: null },
        bmr: { mj: 5.86, kcal: 1400.3, adultFormulaForMinor: false },
        missing: [],
      });
    });

    it('says what is missing', () => {
      expect(
        sessionFigures({ date: base.date, sex: null, dateOfBirth: null, heights: [], weightKg: 79 }),
      ).toMatchObject({ bmi: null, bmr: null, missing: ['height', 'sex', 'age'] });
      expect(sessionFigures({ ...base, weightKg: null }).missing).toEqual(['weight']);
    });
  });

  describe('session series', () => {
    const woman = {
      sex: 'F' as const,
      dateOfBirth: new Date('1970-01-01'),
      heights: [{ value: 159, measuredAt: day('2026-09-01') }],
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

  describe('height known at the date', () => {
    const heights = [
      { value: 120, measuredAt: day('2022-03-01') },
      { value: 132, measuredAt: day('2024-03-01') },
      { value: 126, measuredAt: day('2023-03-01') },
    ];

    it('takes the latest height measured on or before that day, not the latest overall', () => {
      expect(heightAt(heights, day('2023-02-28'), false)?.value).toBe(120);
      expect(heightAt(heights, new Date('2023-03-01T15:00:00Z'), false)?.value).toBe(126);
      expect(heightAt(heights, day('2023-12-01'), false)?.value).toBe(126);
      expect(heightAt(heights, day('2026-01-01'), false)?.value).toBe(132);
    });

    it('uses the first height for an adult weighed before it was measured', () => {
      expect(heightAt(heights, day('2020-01-01'), true)?.value).toBe(120);
    });

    it('has no height for a child weighed before any was measured', () => {
      expect(heightAt(heights, day('2020-01-01'), false)).toBeNull();
      expect(heightAt([], day('2020-01-01'), true)).toBeNull();
    });

    it('computes an old weight with the height of the time', () => {
      const growing = { sex: 'M' as const, dateOfBirth: day('2014-06-01'), heights };
      const earlier = sessionFigures({ ...growing, weightKg: 25, date: day('2022-09-01') });
      const later = sessionFigures({ ...growing, weightKg: 25, date: day('2024-09-01') });
      expect(earlier.height?.value).toBe(120);
      expect(earlier.bmi?.value).toBe(17.36);
      expect(later.height?.value).toBe(132);
      expect(later.bmi?.value).toBe(14.35);
    });

    it('computes an adult weight history before the bilan with the height measured at the bilan', () => {
      const woman = { sex: 'F' as const, dateOfBirth: day('1970-08-24'), heights: [{ value: 159, measuredAt: day('2026-09-23') }] };
      const before = sessionFigures({ ...woman, weightKg: 70, date: day('2019-05-01') });
      expect(before).toMatchObject({ age: 48, height: { value: 159 }, bmi: { value: 27.69, category: 'OVERWEIGHT' } });
    });

    it('follows growth across the sessions of a series', () => {
      const series = sessionSeries({ sex: 'F', dateOfBirth: day('2014-06-01'), heights }, [
        { id: 'a', date: new Date('2022-06-01T09:00:00Z'), advice: null, weightKg: 24 },
        { id: 'b', date: new Date('2024-06-01T09:00:00Z'), advice: null, weightKg: 30 },
      ]);
      expect(series.get('a')?.figures.height?.value).toBe(120);
      expect(series.get('b')?.figures.height?.value).toBe(132);
    });
  });

  describe('under 18', () => {
    const girl = {
      sex: 'F' as const,
      dateOfBirth: day('2014-06-01'),
      heights: [{ value: 140, measuredAt: day('2026-06-01') }],
    };

    it('counts the exact age for the curves', () => {
      expect(exactAgeAt(day('2014-06-01'), day('2026-06-01'))).toBeCloseTo(12, 2);
      expect(exactAgeAt(day('2014-06-01'), new Date('2026-12-01T18:00:00Z'))).toBeCloseTo(12.5, 2);
      expect(exactAgeAt(day('2014-06-01'), day('2014-01-01'))).toBeNull();
    });

    it('gives no adult category but the IOTF class', () => {
      // 12 years, 140 cm, 45 kg: girls' cut-offs at 12 are 21.68 (overweight) and 26.67 (obesity)
      const figures = sessionFigures({ ...girl, weightKg: 45, date: day('2026-06-01') });
      expect(figures.minor).toBe(true);
      expect(figures.bmi).toEqual({
        value: 22.96,
        category: null,
        child: {
          ageYears: 12,
          class: 'OVERWEIGHT',
          cutoffs: { thinness3: 13.39, thinness2: 14.28, thinness1: 15.62, overweight: 21.68, obesity: 26.67 },
        },
      });
      expect(sessionFigures({ ...girl, weightKg: 36, date: day('2026-06-01') }).bmi?.child?.class).toBe('NORMAL');
    });

    it('shows the BMR with the adult formula mention', () => {
      const figures = sessionFigures({ ...girl, weightKg: 45, date: day('2026-06-01') });
      expect(figures.bmr).toMatchObject({ adultFormulaForMinor: true });
      expect(computeBmr({ sex: 'F', weightKg: 79, heightCm: 159, age: 17 })?.adultFormulaForMinor).toBe(true);
      expect(computeBmr({ sex: 'F', weightKg: 79, heightCm: 159, age: 18 })?.adultFormulaForMinor).toBe(false);
    });

    it('switches to the adult categories at 18', () => {
      expect(computeBmi(60, 165, { sex: 'F', ageYears: 17.99 })?.category).toBeNull();
      expect(computeBmi(60, 165, { sex: 'F', ageYears: 18 })).toMatchObject({ category: 'NORMAL', child: null });
    });

    it('cannot place the BMI before 2 years or without the sex', () => {
      expect(computeBmi(10, 80, { sex: 'M', ageYears: 1.5 })?.child).toEqual({ ageYears: 1.5, class: null, cutoffs: null });
      expect(computeBmi(30, 130, { sex: null, ageYears: 9 })?.child).toMatchObject({ class: null, cutoffs: null });
    });
  });

  describe('corpulence chart', () => {
    const boy = {
      sex: 'M' as const,
      dateOfBirth: day('2016-01-01'),
      heights: [
        { value: 110, measuredAt: day('2021-01-01') },
        { value: 125, measuredAt: day('2024-01-01') },
      ],
    };

    it('places each weight between 2 and 18 with the height of its date', () => {
      const chart = corpulenceChart(boy, [
        { id: 'w2', value: 26, measuredAt: day('2024-01-01') },
        { id: 'w1', value: 19, measuredAt: day('2021-01-01') },
        // Before any height: not placed
        { id: 'w0', value: 15, measuredAt: day('2020-01-01') },
      ]);
      expect(chart?.sex).toBe('M');
      expect(chart?.cutoffs).toHaveLength(33);
      expect(chart?.points).toEqual([
        { measurementId: 'w1', measuredAt: day('2021-01-01'), ageYears: 5, bmi: 15.7 },
        { measurementId: 'w2', measuredAt: day('2024-01-01'), ageYears: 8, bmi: 16.64 },
      ]);
      expect(chart?.sources[0]).toMatch(/Cole/);
    });

    it('is not drawn for an adult or without the sex', () => {
      const adult = { sex: 'F' as const, dateOfBirth: day('1970-01-01'), heights: [{ value: 159, measuredAt: day('2026-01-01') }] };
      expect(corpulenceChart(adult, [{ id: 'w', value: 79, measuredAt: day('2026-01-01') }])).toBeNull();
      expect(corpulenceChart({ ...boy, sex: null }, [{ id: 'w', value: 26, measuredAt: day('2024-01-01') }])).toBeNull();
    });
  });

  it('computes weight changes', () => {
    expect(weightDelta(78.2, 79)).toBe(-0.8);
    expect(weightDelta(76.5, 79)).toBe(-2.5);
    expect(weightDelta(null, 79)).toBeNull();
    expect(weightDelta(79, null)).toBeNull();
  });
});
