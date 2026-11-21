import { describe, expect, it } from 'vitest';

import { patientRef } from './audit';
import { formatDelta, formatMetric } from './patient-file';
import { homePathFor } from './roles';
import { formatDate, todayISO } from './utils';

describe('measurement formatting', () => {
  it('shows units, and scales out of 10', () => {
    expect(formatMetric('WEIGHT', 72.45)).toBe('72,5 kg');
    expect(formatMetric('ENERGY', 7)).toBe('7/10');
  });

  it('shows the change with its sign, or = when unchanged', () => {
    expect(formatDelta('WEIGHT', 1.5)).toBe('+1,5 kg');
    expect(formatDelta('WEIGHT', -2)).toBe('−2 kg');
    expect(formatDelta('WAIST', 0.01)).toBe('=');
  });
});

describe('roles', () => {
  it('sends admins to the users and everyone else to the dashboard', () => {
    expect(homePathFor('ADMIN')).toBe('/admin/users');
    expect(homePathFor('PRATICIENNE')).toBe('/dashboard');
    expect(homePathFor(undefined)).toBe('/dashboard');
  });
});

describe('audit', () => {
  it('shows a patient as a short reference, never a name', () => {
    expect(patientRef('0b6f3d4e-1c55-4a7e-9d1a-000000000001')).toBe('#0b6f3d4e');
    expect(patientRef(null)).toBe('—');
  });
});

describe('dates', () => {
  it("gives today's local date", () => {
    expect(todayISO()).toBe(formatDate(new Date(), 'yyyy-MM-dd'));
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
