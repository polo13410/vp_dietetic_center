import { describe, expect, it } from 'vitest';

import { bmiCategory, computeBmi } from './bmi';

describe('BMI', () => {
  it('computes weight / height² rounded to one decimal', () => {
    expect(computeBmi(70, 175)).toEqual({ value: 22.9, category: 'NORMAL' });
    expect(computeBmi(95, 170)).toEqual({ value: 32.9, category: 'OBESITY' });
  });

  it('classifies with the practice thresholds', () => {
    expect(bmiCategory(18.4)).toBe('UNDERWEIGHT');
    expect(bmiCategory(18.5)).toBe('NORMAL');
    expect(bmiCategory(24.9)).toBe('NORMAL');
    expect(bmiCategory(25)).toBe('OVERWEIGHT');
    expect(bmiCategory(29.9)).toBe('OVERWEIGHT');
    expect(bmiCategory(30)).toBe('OBESITY');
    expect(bmiCategory(39.9)).toBe('OBESITY');
    expect(bmiCategory(40)).toBe('MASSIVE_OBESITY');
  });

  it('needs both a weight and a height', () => {
    expect(computeBmi(70, null)).toBeNull();
    expect(computeBmi(undefined, 175)).toBeNull();
    expect(computeBmi(0, 175)).toBeNull();
  });
});
