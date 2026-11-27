import { addMonths, addYears, format, isValid, parse } from 'date-fns';

/**
 * Typed date and time entry. Days are local calendar days as YYYY-MM-DD, times are HH:mm: no time
 * zone is involved until the form combines them.
 */

export interface DayBounds {
  min?: string;
  max?: string;
  /** The day is in the future (appointment, task): a day already past means the next one */
  upcoming?: boolean;
  /** Two-digit years may be in the 1900s */
  birthDate?: boolean;
  today?: Date;
}

const iso = (day: Date) => format(day, 'yyyy-MM-dd');

function real(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/**
 * What she typed, as a day: « 26 », « 26/11 », « 2611 », « 26/11/26 », « 26112026 », « 26.11.2026 »
 * or an ISO date. A missing month or year is the nearest that fits the field: the coming one for an
 * upcoming day, the last one when the day cannot be after `max`. Null when it is not a date.
 */
export function parseDay(text: string, bounds: DayBounds = {}): string | null {
  const input = text.trim();
  if (!input) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return real(y, m, d) ? input : null;
  }
  let parts = input.split(/[^\d]+/).filter(Boolean);
  if (parts.length === 1) {
    const digits = parts[0];
    if (digits.length <= 2) parts = [digits];
    else if (digits.length === 4) parts = [digits.slice(0, 2), digits.slice(2)];
    else if (digits.length === 6 || digits.length === 8) parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)];
    else return null;
  }
  if (parts.length > 3 || parts.some((p, i) => (i < 2 ? p.length > 2 : p.length !== 2 && p.length !== 4))) return null;

  const today = bounds.today ?? new Date();
  const [d, m, y] = parts.map(Number);
  let year = y;
  if (parts[2]?.length === 2) {
    const century = bounds.birthDate && y > today.getFullYear() % 100 ? 1900 : 2000;
    year = century + y;
  }
  if (parts.length === 3) {
    const date = real(year, m, d);
    return date ? iso(date) : null;
  }

  // Month or year left out: try the current one, then step to the one that fits the field
  const step = parts.length === 1 ? addMonths : addYears;
  const first = parts.length === 1 ? real(today.getFullYear(), today.getMonth() + 1, d) : real(today.getFullYear(), m, d);
  if (!first) {
    // 29/02 out of a leap year, 31 in a 30-day month: the next one that has it
    for (let i = 1; i <= 8; i++) {
      const next = parts.length === 1
        ? real(addMonths(today, i).getFullYear(), addMonths(today, i).getMonth() + 1, d)
        : real(today.getFullYear() + i, m, d);
      if (next) return iso(next);
    }
    return null;
  }
  let date = first;
  const todayIso = iso(today);
  if (bounds.max && iso(date) > bounds.max) date = step(date, -1);
  else if ((bounds.min && iso(date) < bounds.min) || (bounds.upcoming && iso(date) < todayIso)) date = step(date, 1);
  return iso(date);
}

/** True when the text is a whole date, so it can be taken as she types without guessing. */
export function isCompleteDay(text: string) {
  const input = text.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(input) || /^\d{8}$/.test(input) || /^\d{1,2}\D+\d{1,2}\D+\d{4}$/.test(input);
}

export const formatDay = (day: string) => (day ? format(parse(day, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '');

export function dayInBounds(day: string, { min, max }: DayBounds) {
  return !(min && day < min) && !(max && day > max);
}

export function shiftDay(day: string, by: number, unit: 'day' | 'month' = 'day') {
  const date = parse(day, 'yyyy-MM-dd', new Date());
  if (!isValid(date)) return day;
  return iso(unit === 'month' ? addMonths(date, by) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + by));
}

/** « 9 », « 930 », « 9h », « 9h30 », « 14:30 », « 14.30 » as HH:mm; null when it is not a time. */
export function parseTime(text: string): string | null {
  const input = text.trim().toLowerCase();
  const match = /^(\d{1,2})\s*(?:[h:.]\s*(\d{2})?)?$/.exec(input);
  const parts = match ? [match[1], match[2] ?? '0'] : /^\d{3,4}$/.test(input) ? [input.slice(0, -2), input.slice(-2)] : null;
  if (!parts) return null;
  const [hours, minutes] = parts.map(Number);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** A time with its minutes: complete enough to be taken as she types. */
export const isCompleteTime = (text: string) => /^\d{1,2}\s*[h:.]\s*\d{2}$|^\d{4}$/.test(text.trim().toLowerCase());

export function timeSlots(from = '07:00', to = '21:00', stepMinutes = 15) {
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots: string[] = [];
  for (let m = toMinutes(from); m <= toMinutes(to); m += stepMinutes) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
}
