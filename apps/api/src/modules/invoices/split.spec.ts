import { ShareKind } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { type CoverageTerms, discountCents, sessionSplit } from './split';

const DATE = new Date('2026-11-20T09:00:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const coverage = (over: Partial<CoverageTerms> = {}): CoverageTerms => ({
  kind: ShareKind.AMOUNT,
  value: 3000,
  maxSessions: null,
  startDate: null,
  endDate: null,
  ...over,
});
const split = (over: Partial<Parameters<typeof sessionSplit>[0]> = {}) =>
  sessionSplit({ priceCents: 5000, discount: null, coverage: null, date: DATE, coveredBefore: 0, ...over });

describe('sessionSplit', () => {
  it('without discount nor payer, the patient pays the price', () => {
    expect(split()).toEqual({ discountCents: 0, netCents: 5000, payerCents: 0, patientCents: 5000, uncovered: null });
  });

  describe('discount', () => {
    it('in euros', () => {
      expect(split({ discount: { kind: ShareKind.AMOUNT, value: 1000 } })).toMatchObject({
        discountCents: 1000,
        netCents: 4000,
        patientCents: 4000,
      });
    });

    it('in %, rounded to the cent', () => {
      expect(discountCents(5000, { kind: ShareKind.PERCENT, value: 30 })).toBe(1500);
      expect(discountCents(4999, { kind: ShareKind.PERCENT, value: 33 })).toBe(1650);
    });

    it('never more than the price: 100 % or a bigger amount makes the session free', () => {
      expect(split({ discount: { kind: ShareKind.PERCENT, value: 100 } })).toMatchObject({ netCents: 0, patientCents: 0 });
      expect(split({ discount: { kind: ShareKind.AMOUNT, value: 9000 } })).toMatchObject({
        discountCents: 5000,
        netCents: 0,
      });
    });
  });

  describe('payer part', () => {
    it('a fixed amount per session', () => {
      expect(split({ coverage: coverage() })).toMatchObject({ netCents: 5000, payerCents: 3000, patientCents: 2000 });
    });

    it('a percentage of the net price, after the discount', () => {
      expect(
        split({
          discount: { kind: ShareKind.AMOUNT, value: 1000 },
          coverage: coverage({ kind: ShareKind.PERCENT, value: 60 }),
        }),
      ).toEqual({ discountCents: 1000, netCents: 4000, payerCents: 2400, patientCents: 1600, uncovered: null });
    });

    it('capped by the net price: an amount above it is the whole net', () => {
      expect(
        split({ discount: { kind: ShareKind.AMOUNT, value: 3000 }, coverage: coverage({ value: 3000 }) }),
      ).toMatchObject({ netCents: 2000, payerCents: 2000, patientCents: 0 });
    });

    it('100 % paid by the payer leaves nothing to the patient', () => {
      expect(split({ coverage: coverage({ kind: ShareKind.PERCENT, value: 100 }) })).toMatchObject({
        payerCents: 5000,
        patientCents: 0,
      });
    });

    it('nothing for a free session', () => {
      expect(
        split({ discount: { kind: ShareKind.PERCENT, value: 100 }, coverage: coverage() }),
      ).toMatchObject({ netCents: 0, payerCents: 0, patientCents: 0, uncovered: null });
    });

    it('stops once the number of covered sessions is reached', () => {
      const terms = coverage({ maxSessions: 3 });
      expect(split({ coverage: terms, coveredBefore: 2 }).payerCents).toBe(3000);
      expect(split({ coverage: terms, coveredBefore: 3 })).toMatchObject({
        payerCents: 0,
        patientCents: 5000,
        uncovered: 'maxSessions',
      });
    });

    it('only within its period, both days included (Paris days)', () => {
      const terms = coverage({ startDate: day('2026-11-01'), endDate: day('2026-11-30') });
      expect(split({ coverage: terms, date: new Date('2026-11-01T08:00:00Z') }).payerCents).toBe(3000);
      // 30 November, 23:30 in Paris
      expect(split({ coverage: terms, date: new Date('2026-11-30T22:30:00Z') }).payerCents).toBe(3000);
      // 1 December, 0:30 in Paris
      expect(split({ coverage: terms, date: new Date('2026-11-30T23:30:00Z') })).toMatchObject({
        payerCents: 0,
        uncovered: 'period',
      });
      expect(split({ coverage: terms, date: new Date('2026-10-31T12:00:00Z') }).uncovered).toBe('period');
    });

    it('an open period: only a start, or only an end', () => {
      expect(split({ coverage: coverage({ startDate: day('2026-12-01') }) }).uncovered).toBe('period');
      expect(split({ coverage: coverage({ endDate: day('2026-12-31') }) }).payerCents).toBe(3000);
    });
  });
});
