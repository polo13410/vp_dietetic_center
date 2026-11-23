import { describe, expect, it } from 'vitest';

import { IOTF_TABLE, iotfClass, iotfCutoffs } from './iotf';

const KEYS = ['thinness3', 'thinness2', 'thinness1', 'overweight', 'obesity'] as const;

describe('IOTF cut-offs (Cole 2000 and 2007)', () => {
  it.each(['M', 'F'] as const)('has every half year from 2 to 18 (%s)', (sex) => {
    expect(IOTF_TABLE[sex].map((r) => r.age)).toEqual(Array.from({ length: 33 }, (_, i) => 2 + i / 2));
  });

  it.each(['M', 'F'] as const)('reaches the adult thresholds at 18 (%s)', (sex) => {
    expect(IOTF_TABLE[sex].at(-1)).toEqual({
      age: 18,
      thinness3: 16,
      thinness2: 17,
      thinness1: 18.5,
      overweight: 25,
      obesity: 30,
    });
  });

  // Spot checks against the printed tables
  it('reads the published values', () => {
    expect(iotfCutoffs('M', 2)).toEqual({ thinness3: 13.37, thinness2: 14.12, thinness1: 15.14, overweight: 18.41, obesity: 20.09 });
    expect(iotfCutoffs('F', 2)).toEqual({ thinness3: 13.24, thinness2: 13.9, thinness1: 14.83, overweight: 18.02, obesity: 19.81 });
    expect(iotfCutoffs('M', 10)).toEqual({ thinness3: 12.66, thinness2: 13.45, thinness1: 14.64, overweight: 19.84, obesity: 24 });
    expect(iotfCutoffs('F', 12.5)).toEqual({ thinness3: 13.65, thinness2: 14.56, thinness1: 15.93, overweight: 22.14, obesity: 27.24 });
  });

  // Catches a value typed in the wrong column or row: the curves never cross and stay smooth
  it.each(['M', 'F'] as const)('has curves in order and without jumps (%s)', (sex) => {
    const rows = IOTF_TABLE[sex];
    for (const row of rows) {
      KEYS.slice(1).forEach((key, i) => expect(row[key]).toBeGreaterThan(row[KEYS[i]]));
    }
    for (let i = 1; i < rows.length - 1; i++) {
      for (const key of KEYS) {
        expect(Math.abs(rows[i + 1][key] - 2 * rows[i][key] + rows[i - 1][key])).toBeLessThan(0.15);
      }
    }
  });

  it('reads between two half years on the line joining them', () => {
    // Boys 10 → 10.5: overweight 19.84 → 20.20
    expect(iotfCutoffs('M', 10.25)?.overweight).toBe(20.02);
  });

  it('has no cut-off before 2 or after 18', () => {
    expect(iotfCutoffs('F', 1.9)).toBeNull();
    expect(iotfCutoffs('F', 18.1)).toBeNull();
  });

  it('places a BMI between the curves', () => {
    const at10 = iotfCutoffs('M', 10)!;
    expect(iotfClass(12.5, at10)).toBe('THINNESS_3');
    expect(iotfClass(13, at10)).toBe('THINNESS_2');
    expect(iotfClass(14, at10)).toBe('THINNESS_1');
    expect(iotfClass(14.64, at10)).toBe('NORMAL');
    expect(iotfClass(19.84, at10)).toBe('OVERWEIGHT');
    expect(iotfClass(24, at10)).toBe('OBESITY');
  });
});
