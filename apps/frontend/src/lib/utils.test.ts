import { describe, expect, it } from 'vitest';

import { calculateAge, cn, formatDate, formatDateTime, getInitials } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('formatDate', () => {
  it('formats date as dd/MM/yyyy', () => {
    expect(formatDate('2024-06-15T10:30:00Z')).toMatch(/15\/06\/2024/);
  });

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('supports custom format', () => {
    expect(formatDate('2024-06-15', 'yyyy')).toBe('2024');
  });
});

describe('formatDateTime', () => {
  it('includes time', () => {
    const result = formatDateTime('2024-06-15T14:30:00Z');
    expect(result).toContain('15/06/2024');
  });
});

describe('getInitials', () => {
  it('returns first letters uppercased', () => {
    expect(getInitials('Marie', 'Dupont')).toBe('MD');
  });

  it('handles empty strings', () => {
    expect(getInitials('', '')).toBe('');
  });
});

describe('calculateAge', () => {
  it('returns dash for null', () => {
    expect(calculateAge(null)).toBe('—');
  });

  it('calculates age in years', () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const result = calculateAge(tenYearsAgo.toISOString());
    expect(result).toBe('10 ans');
  });
});
