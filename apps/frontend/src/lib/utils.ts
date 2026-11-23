import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null, format = 'dd/MM/yyyy'): string {
  if (!date) return '—';
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return format
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', year.toString())
    .replace('HH', hours)
    .replace('mm', minutes);
}

export function calculateAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—';
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return `${age} ans`;
}

/** Today's date as YYYY-MM-DD in local time (toISOString would give the UTC date). */
export function todayISO(): string {
  return formatDate(new Date(), 'yyyy-MM-dd');
}

/** Age in whole years today, or null without a birth date. */
export function ageInYears(dateOfBirth: string | null | undefined, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** « 12 mars 2026 », or « 12 mars » for a date of the current year when `short`. */
export function formatLongDate(date: string | Date | null | undefined, short = false): string {
  if (!date) return '—';
  const d = new Date(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(short && sameYear ? {} : { year: 'numeric' }),
  });
}

/** « 14 h 32 » (docs/DESIGN.md § 7). */
export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return `${d.getHours()} h ${d.getMinutes().toString().padStart(2, '0')}`;
}

/** A number in French (« 1 400,3 »), with at most `digits` decimals. */
export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: digits });
}
