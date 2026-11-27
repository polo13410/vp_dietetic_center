import { describe, expect, it } from 'vitest';

import { formatDay, isCompleteDay, isCompleteTime, parseDay, parseTime, shiftDay, timeSlots } from './date-entry';

const today = new Date(2026, 10, 27); // 27/11/2026

describe('parseDay', () => {
  it.each([
    ['27/11/2026', '2026-11-27'],
    ['27.11.2026', '2026-11-27'],
    ['27 11 2026', '2026-11-27'],
    ['27112026', '2026-11-27'],
    ['271126', '2026-11-27'],
    ['27/11/26', '2026-11-27'],
    ['2026-11-27', '2026-11-27'],
    ['3/2/2027', '2027-02-03'],
    ['  27/11  ', '2026-11-27'],
  ])('reads %s', (text, day) => expect(parseDay(text, { today })).toBe(day));

  it.each(['', 'demain', '31/02/2026', '32/01/2026', '1/13', '123', '2026-02-30', '1/2/3/4'])('refuses « %s »', (text) =>
    expect(parseDay(text, { today })).toBeNull(),
  );

  it('fills the month and year with the nearest one that fits the field', () => {
    expect(parseDay('3', { today })).toBe('2026-11-03');
    expect(parseDay('3', { today, upcoming: true })).toBe('2026-12-03');
    expect(parseDay('2/1', { today, upcoming: true })).toBe('2027-01-02');
    expect(parseDay('28', { today, max: '2026-11-27' })).toBe('2026-10-28');
    expect(parseDay('15/12', { today, max: '2026-11-27' })).toBe('2025-12-15');
    expect(parseDay('27', { today, upcoming: true })).toBe('2026-11-27');
  });

  it('skips to a month that has the day', () => {
    expect(parseDay('31', { today: new Date(2026, 10, 2) })).toBe('2026-12-31');
    expect(parseDay('29/02', { today })).toBe('2028-02-29');
  });

  it('reads a two-digit birth year in the right century', () => {
    expect(parseDay('12/05/84', { today, birthDate: true })).toBe('1984-05-12');
    expect(parseDay('12/05/19', { today, birthDate: true })).toBe('2019-05-12');
  });
});

describe('date helpers', () => {
  it('formats, completes and shifts days', () => {
    expect(formatDay('2026-11-27')).toBe('27/11/2026');
    expect(formatDay('')).toBe('');
    expect(isCompleteDay('27/11/2026')).toBe(true);
    expect(isCompleteDay('27/11/20')).toBe(false);
    expect(isCompleteDay('27/11')).toBe(false);
    expect(shiftDay('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDay('2026-01-31', 1, 'month')).toBe('2026-02-28');
  });
});

describe('parseTime', () => {
  it.each([
    ['9', '09:00'],
    ['14', '14:00'],
    ['930', '09:30'],
    ['1430', '14:30'],
    ['9h', '09:00'],
    ['9h30', '09:30'],
    ['14:30', '14:30'],
    ['14.45', '14:45'],
    ['14 H 15', '14:15'],
  ])('reads %s', (text, time) => expect(parseTime(text)).toBe(time));

  it.each(['', '24', '9h3', '960', '12345', 'midi'])('refuses « %s »', (text) => expect(parseTime(text)).toBeNull());

  it('takes only a time with its minutes as typed', () => {
    expect(isCompleteTime('14')).toBe(false);
    expect(isCompleteTime('14h3')).toBe(false);
    expect(isCompleteTime('14h30')).toBe(true);
    expect(isCompleteTime('1430')).toBe(true);
  });

  it('lists the slots of the day', () => {
    const slots = timeSlots('08:00', '09:00', 15);
    expect(slots).toEqual(['08:00', '08:15', '08:30', '08:45', '09:00']);
  });
});
