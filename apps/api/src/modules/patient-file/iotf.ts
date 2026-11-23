/**
 * Corpulence of children and teenagers (2 to 18 years): international BMI cut-offs of the IOTF
 * (International Obesity Task Force), docs/REFONTE.md § 3.1. Values are copied as printed in the
 * published tables, never computed or rounded here:
 *
 * - Overweight and obesity (curves reaching BMI 25 and 30 at 18 years):
 *   Cole TJ, Bellizzi MC, Flegal KM, Dietz WH. Establishing a standard definition for child
 *   overweight and obesity worldwide: international survey. BMJ 2000;320:1240–3, table 4.
 *   doi:10.1136/bmj.320.7244.1240 (open access: PMC27365).
 * - Thinness grades 3, 2 and 1 (curves reaching BMI 16, 17 and 18.5 at 18 years):
 *   Cole TJ, Flegal KM, Nicholls D, Jackson AA. Body mass index cut offs to define thinness in
 *   children and adolescents: international survey. BMJ 2007;335:194, table 4.
 *   doi:10.1136/bmj.39238.399444.55 (open access: PMC1934447).
 *
 * The tables give exact ages every half year. Between two of them, the cut-off is read on the
 * straight line joining them (linear interpolation), as on a printed chart.
 */
import type { Sex } from '@prisma/client';

export const IOTF_SOURCES = [
  'Cole TJ et al. BMJ 2000;320:1240 (surpoids, obésité)',
  'Cole TJ et al. BMJ 2007;335:194 (minceur)',
] as const;

/** Where a child's BMI falls among the IOTF curves (grade 3 is the most severe thinness). */
export type IotfClass = 'THINNESS_3' | 'THINNESS_2' | 'THINNESS_1' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY';

/** The five cut-offs at one age, named by the adult BMI each curve reaches at 18. */
export interface IotfCutoffs {
  /** Thinness grade 3 (BMI 16 at 18) */
  thinness3: number;
  /** Thinness grade 2 (BMI 17 at 18) */
  thinness2: number;
  /** Thinness grade 1 (BMI 18.5 at 18) */
  thinness1: number;
  /** Overweight (BMI 25 at 18) */
  overweight: number;
  /** Obesity (BMI 30 at 18) */
  obesity: number;
}

export interface IotfRow extends IotfCutoffs {
  /** Exact age in years */
  age: number;
}

export const IOTF_MIN_AGE = 2;
export const IOTF_MAX_AGE = 18;

// Age (years) | BMI 25 boys | BMI 25 girls | BMI 30 boys | BMI 30 girls — Cole 2000, table 4
const COLE_2000: readonly (readonly [number, number, number, number, number])[] = [
  [2, 18.41, 18.02, 20.09, 19.81],
  [2.5, 18.13, 17.76, 19.8, 19.55],
  [3, 17.89, 17.56, 19.57, 19.36],
  [3.5, 17.69, 17.4, 19.39, 19.23],
  [4, 17.55, 17.28, 19.29, 19.15],
  [4.5, 17.47, 17.19, 19.26, 19.12],
  [5, 17.42, 17.15, 19.3, 19.17],
  [5.5, 17.45, 17.2, 19.47, 19.34],
  [6, 17.55, 17.34, 19.78, 19.65],
  [6.5, 17.71, 17.53, 20.23, 20.08],
  [7, 17.92, 17.75, 20.63, 20.51],
  [7.5, 18.16, 18.03, 21.09, 21.01],
  [8, 18.44, 18.35, 21.6, 21.57],
  [8.5, 18.76, 18.69, 22.17, 22.18],
  [9, 19.1, 19.07, 22.77, 22.81],
  [9.5, 19.46, 19.45, 23.39, 23.46],
  [10, 19.84, 19.86, 24.0, 24.11],
  [10.5, 20.2, 20.29, 24.57, 24.77],
  [11, 20.55, 20.74, 25.1, 25.42],
  [11.5, 20.89, 21.2, 25.58, 26.05],
  [12, 21.22, 21.68, 26.02, 26.67],
  [12.5, 21.56, 22.14, 26.43, 27.24],
  [13, 21.91, 22.58, 26.84, 27.76],
  [13.5, 22.27, 22.98, 27.25, 28.2],
  [14, 22.62, 23.34, 27.63, 28.57],
  [14.5, 22.96, 23.66, 27.98, 28.87],
  [15, 23.29, 23.94, 28.3, 29.11],
  [15.5, 23.6, 24.17, 28.6, 29.29],
  [16, 23.9, 24.37, 28.88, 29.43],
  [16.5, 24.19, 24.54, 29.14, 29.56],
  [17, 24.46, 24.7, 29.41, 29.69],
  [17.5, 24.73, 24.85, 29.7, 29.84],
  [18, 25, 25, 30, 30],
];

// Age (years) | boys 16 | boys 17 | boys 18.5 | girls 16 | girls 17 | girls 18.5 — Cole 2007, table 4
const COLE_2007: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [2, 13.37, 14.12, 15.14, 13.24, 13.9, 14.83],
  [2.5, 13.22, 13.94, 14.92, 13.1, 13.74, 14.63],
  [3, 13.09, 13.79, 14.74, 12.98, 13.6, 14.47],
  [3.5, 12.97, 13.64, 14.57, 12.86, 13.47, 14.32],
  [4, 12.86, 13.52, 14.43, 12.73, 13.34, 14.19],
  [4.5, 12.76, 13.41, 14.31, 12.61, 13.21, 14.06],
  [5, 12.66, 13.31, 14.21, 12.5, 13.09, 13.94],
  [5.5, 12.58, 13.22, 14.13, 12.4, 12.99, 13.86],
  [6, 12.5, 13.15, 14.07, 12.32, 12.93, 13.82],
  [6.5, 12.45, 13.1, 14.04, 12.28, 12.9, 13.82],
  [7, 12.42, 13.08, 14.04, 12.26, 12.91, 13.86],
  [7.5, 12.41, 13.09, 14.08, 12.27, 12.95, 13.93],
  [8, 12.42, 13.11, 14.15, 12.31, 13.0, 14.02],
  [8.5, 12.45, 13.17, 14.24, 12.37, 13.08, 14.14],
  [9, 12.5, 13.24, 14.35, 12.44, 13.18, 14.28],
  [9.5, 12.57, 13.34, 14.49, 12.53, 13.29, 14.43],
  [10, 12.66, 13.45, 14.64, 12.64, 13.43, 14.61],
  [10.5, 12.77, 13.58, 14.8, 12.78, 13.59, 14.81],
  [11, 12.89, 13.72, 14.97, 12.95, 13.79, 15.05],
  [11.5, 13.03, 13.87, 15.16, 13.15, 14.01, 15.32],
  [12, 13.18, 14.05, 15.35, 13.39, 14.28, 15.62],
  [12.5, 13.37, 14.25, 15.58, 13.65, 14.56, 15.93],
  [13, 13.59, 14.48, 15.84, 13.92, 14.85, 16.26],
  [13.5, 13.83, 14.74, 16.12, 14.2, 15.14, 16.57],
  [14, 14.09, 15.01, 16.41, 14.48, 15.43, 16.88],
  [14.5, 14.35, 15.28, 16.69, 14.75, 15.72, 17.18],
  [15, 14.6, 15.55, 16.98, 15.01, 15.98, 17.45],
  [15.5, 14.86, 15.82, 17.26, 15.25, 16.22, 17.69],
  [16, 15.12, 16.08, 17.54, 15.46, 16.44, 17.91],
  [16.5, 15.36, 16.34, 17.8, 15.63, 16.62, 18.09],
  [17, 15.6, 16.58, 18.05, 15.78, 16.77, 18.25],
  [17.5, 15.81, 16.8, 18.28, 15.9, 16.89, 18.38],
  [18, 16, 17, 18.5, 16, 17, 18.5],
];

function buildTable(sex: Sex): IotfRow[] {
  return COLE_2000.map(([age, owBoys, owGirls, obBoys, obGirls], i) => {
    const [thinAge, b16, b17, b185, g16, g17, g185] = COLE_2007[i];
    if (thinAge !== age) throw new Error('IOTF tables are not aligned');
    return sex === 'M'
      ? { age, thinness3: b16, thinness2: b17, thinness1: b185, overweight: owBoys, obesity: obBoys }
      : { age, thinness3: g16, thinness2: g17, thinness1: g185, overweight: owGirls, obesity: obGirls };
  });
}

/** The published cut-offs of one sex, every half year from 2 to 18 years. */
export const IOTF_TABLE: Record<Sex, readonly IotfRow[]> = { M: buildTable('M'), F: buildTable('F') };

const KEYS = ['thinness3', 'thinness2', 'thinness1', 'overweight', 'obesity'] as const;

/** The cut-offs at an exact age between 2 and 18, or null outside the tables. */
export function iotfCutoffs(sex: Sex, ageYears: number): IotfCutoffs | null {
  if (!Number.isFinite(ageYears) || ageYears < IOTF_MIN_AGE || ageYears > IOTF_MAX_AGE) return null;
  const table = IOTF_TABLE[sex];
  const index = Math.min(Math.floor((ageYears - IOTF_MIN_AGE) * 2), table.length - 2);
  const low = table[index];
  const high = table[index + 1];
  const t = (ageYears - low.age) / (high.age - low.age);
  const at = (key: (typeof KEYS)[number]) => Math.round((low[key] + (high[key] - low[key]) * t) * 100) / 100;
  return {
    thinness3: at('thinness3'),
    thinness2: at('thinness2'),
    thinness1: at('thinness1'),
    overweight: at('overweight'),
    obesity: at('obesity'),
  };
}

/** Places a BMI among the cut-offs: below a curve is the class under it. */
export function iotfClass(bmi: number, cutoffs: IotfCutoffs): IotfClass {
  if (bmi < cutoffs.thinness3) return 'THINNESS_3';
  if (bmi < cutoffs.thinness2) return 'THINNESS_2';
  if (bmi < cutoffs.thinness1) return 'THINNESS_1';
  if (bmi < cutoffs.overweight) return 'NORMAL';
  if (bmi < cutoffs.obesity) return 'OVERWEIGHT';
  return 'OBESITY';
}
