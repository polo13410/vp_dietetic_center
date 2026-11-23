import { BillingRhythm } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { lastOfMonth, nextPeriod } from './payer-periods';

const monthly = { billingRhythm: BillingRhythm.MONTHLY, rhythmMonths: null };
const quarterly = { billingRhythm: BillingRhythm.EVERY_N_MONTHS, rhythmMonths: 3 };
const onDemand = { billingRhythm: BillingRhythm.ON_DEMAND, rhythmMonths: null };
const TODAY = '2026-11-23';

describe('nextPeriod', () => {
  it('monthly: the month of the earliest session not billed yet', () => {
    expect(nextPeriod(monthly, { lastEnd: null, earliestUnbilled: '2026-10-14', today: TODAY })).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      ended: true,
    });
  });

  it('monthly: the current month is not ended yet', () => {
    expect(nextPeriod(monthly, { lastEnd: '2026-10-31', earliestUnbilled: '2026-11-05', today: TODAY })).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      ended: false,
    });
  });

  it('starts right after the last invoice when it ended within the month', () => {
    expect(nextPeriod(monthly, { lastEnd: '2026-10-15', earliestUnbilled: '2026-10-20', today: TODAY })).toMatchObject({
      from: '2026-10-16',
      to: '2026-10-31',
    });
  });

  it('a session forgotten in an already billed month comes first', () => {
    expect(nextPeriod(monthly, { lastEnd: '2026-10-31', earliestUnbilled: '2026-09-12', today: TODAY })).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
      ended: true,
    });
  });

  it('with nothing to bill: the month after the last invoice, or this month', () => {
    expect(nextPeriod(monthly, { lastEnd: '2026-10-31', earliestUnbilled: null, today: TODAY })).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(nextPeriod(monthly, { lastEnd: null, earliestUnbilled: null, today: TODAY })).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });

  it('every N months: N months from the first one, across the year', () => {
    expect(nextPeriod(quarterly, { lastEnd: null, earliestUnbilled: '2026-11-03', today: TODAY })).toEqual({
      from: '2026-11-01',
      to: '2027-01-31',
      ended: false,
    });
  });

  it('on demand: up to today, never « ended »', () => {
    expect(nextPeriod(onDemand, { lastEnd: '2026-09-30', earliestUnbilled: '2026-10-08', today: TODAY })).toEqual({
      from: '2026-10-01',
      to: TODAY,
      ended: false,
    });
  });
});

describe('lastOfMonth', () => {
  it('knows February and leap years', () => {
    expect(lastOfMonth('2027-02-10')).toBe('2027-02-28');
    expect(lastOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(lastOfMonth('2026-12-01', 2)).toBe('2027-02-28');
  });
});
