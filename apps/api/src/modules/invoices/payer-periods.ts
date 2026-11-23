import { BillingRhythm } from '@prisma/client';

/** Days are Paris days, "2026-11-01". */
export interface BillingPeriod {
  from: string;
  to: string;
  /** Its last day is past: time to bill it (never for a payer billed on demand) */
  ended: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-01" for "2026-11-20" */
export const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

/** The last day of the month `months` after the month of `day` ("2026-11-30" for 0). */
export function lastOfMonth(day: string, months = 0): string {
  const [year, month] = day.split('-').map(Number);
  const last = new Date(Date.UTC(year, month + months, 0));
  return `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
}

export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/**
 * The next period to bill a payer, from its rhythm (docs/REFONTE.md lot 16):
 * - it starts on the first day of the month of its earliest session not billed yet (a session
 *   forgotten in an old month comes first), or right after its last invoice when that one ended
 *   within that month; with nothing to bill, right after its last invoice (or this month);
 * - monthly, it ends with that month; every N months, with the N-th month; on demand, today.
 */
export function nextPeriod(
  rhythm: { billingRhythm: BillingRhythm; rhythmMonths: number | null },
  context: { lastEnd: string | null; earliestUnbilled: string | null; today: string },
): BillingPeriod {
  const { lastEnd, earliestUnbilled, today } = context;
  const afterLast = lastEnd ? addDays(lastEnd, 1) : null;
  const anchor = earliestUnbilled ?? afterLast ?? today;
  let from = firstOfMonth(anchor);
  if (afterLast && afterLast > from && afterLast <= anchor) from = afterLast;

  if (rhythm.billingRhythm === BillingRhythm.ON_DEMAND) {
    return { from, to: today > from ? today : from, ended: false };
  }
  const months = rhythm.billingRhythm === BillingRhythm.EVERY_N_MONTHS ? Math.max(rhythm.rhythmMonths ?? 1, 1) : 1;
  const to = lastOfMonth(from, months - 1);
  return { from, to, ended: to < today };
}
