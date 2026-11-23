import { describe, expect, it } from 'vitest';

import { measureTimeline } from '../test/patient-fixtures';

import { heightChanges, parseDecimal, timelineRows } from './measure-timeline';

describe('measure timeline', () => {
  it('puts measurements and life events in one list, latest first', () => {
    const rows = timelineRows(measureTimeline);
    expect(rows.map((r) => [r.date, r.id])).toEqual([
      ['2026-11-15', 'measurement-m-3'],
      ['2026-10-23', 'measurement-m-2'],
      ['2026-09-23', 'measurement-m-1'],
      ['2026-09-23', 'measurement-m-h'],
      ['2020-01-15', 'event-ev-1'],
      ['2019-05-01', 'measurement-m-0'],
    ]);
  });

  it('puts a life event before the measurements of its day', () => {
    const rows = timelineRows({
      measurements: measureTimeline.measurements.slice(0, 1),
      lifeEvents: [{ id: 'ev', date: '2026-11-15T00:00:00.000Z', title: 'Reprise du sport', category: null }],
    });
    expect(rows.map((r) => r.kind)).toEqual(['event', 'measurement']);
  });

  it('shows the height curve only when the height changed', () => {
    expect(heightChanges(measureTimeline.measurements)).toBe(false);
    expect(
      heightChanges([
        { type: 'HEIGHT', value: 120 },
        { type: 'HEIGHT', value: 126 },
      ]),
    ).toBe(true);
  });

  it('reads a value typed with a comma', () => {
    expect(parseDecimal('72,5')).toBe(72.5);
    expect(parseDecimal(' 70 ')).toBe(70);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
  });
});
