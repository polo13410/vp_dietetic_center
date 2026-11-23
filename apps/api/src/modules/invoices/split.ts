import { ShareKind } from '@prisma/client';

import { parisDay } from './numbering';

/** A discount or a coverage: cents (AMOUNT) or percent (PERCENT). */
export interface Share {
  kind: ShareKind;
  value: number;
}

/** What a payer covers for the patient (PatientCoverage), as the split needs it. */
export interface CoverageTerms extends Share {
  /** Covered sessions at most */
  maxSessions: number | null;
  /** Paris days, both included */
  startDate: Date | null;
  endDate: Date | null;
}

/** Why a coverage gives nothing to a session. */
export type UncoveredReason = 'maxSessions' | 'period';

export interface SessionSplit {
  discountCents: number;
  /** price − discount */
  netCents: number;
  /** The payer's part of the net price */
  payerCents: number;
  /** What the patient pays: the rest */
  patientCents: number;
  /** Set when there is a coverage but it does not apply to this session */
  uncovered: UncoveredReason | null;
}

/** A percentage of an amount in cents, rounded to the cent. */
const percentOf = (cents: number, percent: number) => Math.round((cents * percent) / 100);

/** The discount in cents: never more than the price. */
export function discountCents(priceCents: number, discount: Share | null): number {
  if (!discount || discount.value <= 0) return 0;
  const cents = discount.kind === ShareKind.PERCENT ? percentOf(priceCents, Math.min(discount.value, 100)) : discount.value;
  return Math.min(cents, priceCents);
}

/**
 * Whether a coverage applies to a session on `date`, the patient having already had
 * `coveredBefore` sessions paid in part by it: within its period (Paris days, both included)
 * and under its number of sessions.
 */
export function coverageGap(coverage: CoverageTerms, date: Date, coveredBefore: number): UncoveredReason | null {
  const day = parisDay(date);
  if (coverage.startDate && day < isoDay(coverage.startDate)) return 'period';
  if (coverage.endDate && day > isoDay(coverage.endDate)) return 'period';
  if (coverage.maxSessions !== null && coveredBefore >= coverage.maxSessions) return 'maxSessions';
  return null;
}

/**
 * The split of a session's price (docs/REFONTE.md lot 16): net = price − discount; the payer
 * pays its amount or its percentage of the net, never more than the net, and nothing once its
 * number of sessions or its period is over; the patient pays the rest.
 */
export function sessionSplit(input: {
  priceCents: number;
  discount: Share | null;
  coverage: CoverageTerms | null;
  date: Date;
  /** Sessions of the patient already paid in part by this coverage, before this one */
  coveredBefore: number;
}): SessionSplit {
  const discount = discountCents(input.priceCents, input.discount);
  const netCents = input.priceCents - discount;
  const { coverage } = input;
  const uncovered = coverage ? coverageGap(coverage, input.date, input.coveredBefore) : null;
  let payerCents = 0;
  if (coverage && !uncovered && netCents > 0) {
    payerCents = Math.min(
      coverage.kind === ShareKind.PERCENT ? percentOf(netCents, Math.min(coverage.value, 100)) : coverage.value,
      netCents,
    );
  }
  return { discountCents: discount, netCents, payerCents, patientCents: netCents - payerCents, uncovered };
}

/** A @db.Date value ("2026-11-01" at midnight UTC) as its day. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
