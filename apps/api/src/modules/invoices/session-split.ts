import { BadRequestException } from '@nestjs/common';
import { Prisma, ShareKind } from '@prisma/client';

import { coverageGap, sessionSplit } from './split';

type Db = Pick<Prisma.TransactionClient, 'patientCoverage' | 'consultation'>;

/** The split columns of a session (Consultation), as saved. */
export interface SplitColumns {
  payerOverrideCents: number | null;
  discountCents: number | null;
  netCents: number | null;
  payerCents: number | null;
  patientCents: number | null;
  payerId: string | null;
  coverageId: string | null;
}

export const NO_SPLIT: SplitColumns = {
  payerOverrideCents: null,
  discountCents: null,
  netCents: null,
  payerCents: null,
  patientCents: null,
  payerId: null,
  coverageId: null,
};

export interface SessionToSplit {
  /** Left out for a session being created */
  id?: string;
  coverageId?: string | null;
  payerId?: string | null;
  payerOverrideCents?: number | null;
  /** A newly entered amount must still match this coverage and fit the net price. */
  editingOverride?: boolean;
  patientId: string;
  date: Date;
  priceCents: number | null;
  discountKind: ShareKind | null;
  discountValue: number | null;
}

/**
 * The patient's coverage for a session on `date`: the latest one, with an active payer, whose
 * period contains the day. Its number of sessions is checked by the split.
 */
export async function coverageOn(db: Db, patientId: string, date: Date) {
  const coverages = await db.patientCoverage.findMany({
    where: { patientId, payer: { archivedAt: null } },
    orderBy: { createdAt: 'desc' },
    include: { payer: { select: { id: true, name: true } } },
  });
  return coverages.find((c) => coverageGap({ ...c, maxSessions: null }, date, 0) === null) ?? null;
}

/**
 * Computes a session's split from its price, its discount and the patient's coverage on its
 * date (docs/REFONTE.md lot 16). The sessions already paid in part by that coverage, before this
 * one, count towards its number of sessions. The result is saved on the session and kept: a
 * later change of the coverage does not touch it.
 */
export async function splitColumns(db: Db, session: SessionToSplit): Promise<SplitColumns> {
  const requested = session.payerOverrideCents ?? null;
  const validating = session.editingOverride && requested !== null;
  if (session.priceCents == null) {
    if (validating) throw new BadRequestException('Indiquez d’abord le prix de la séance.');
    return NO_SPLIT;
  }
  const coverage = await coverageOn(db, session.patientId, session.date);
  const coveredBefore = coverage?.maxSessions
    ? await db.consultation.count({
        where: {
          coverageId: coverage.id,
          payerCents: { gt: 0 },
          ...(session.editingOverride ? {} : { date: { lte: session.date } }),
          ...(session.id && { id: { not: session.id } }),
        },
      })
    : 0;
  const split = sessionSplit({
    priceCents: session.priceCents,
    discount:
      session.discountKind && session.discountValue !== null
        ? { kind: session.discountKind, value: session.discountValue }
        : null,
    coverage,
    date: session.date,
    coveredBefore,
  });
  const sameCoverage = coverage && coverage.id === session.coverageId &&
    (!session.payerId || coverage.payerId === session.payerId) && !split.uncovered;
  if (validating && !sameCoverage) {
    throw new BadRequestException('La prise en charge a changé ou ne couvre plus cette séance.');
  }
  if (validating && requested > split.netCents) {
    throw new BadRequestException('La part de l’organisme dépasse le prix après remise.');
  }
  const payerOverrideCents = sameCoverage ? requested : null;
  const payerCents = Math.min(payerOverrideCents ?? split.payerCents, split.netCents);
  return {
    payerOverrideCents,
    discountCents: split.discountCents,
    netCents: split.netCents,
    payerCents,
    patientCents: split.netCents - payerCents,
    // The payer only when it pays something; the coverage also when it no longer applies
    payerId: payerCents > 0 ? coverage!.payerId : null,
    coverageId: coverage?.id ?? null,
  };
}

/** The split of a session saved before lot 16 (or in a test): the patient pays the price. */
export function splitOf(session: {
  priceCents: number | null;
  discountCents?: number | null;
  netCents?: number | null;
  payerCents?: number | null;
  patientCents?: number | null;
}) {
  const price = session.priceCents;
  if (price === null) return null;
  if (session.netCents === null || session.netCents === undefined) {
    return { priceCents: price, discountCents: 0, netCents: price, payerCents: 0, patientCents: price };
  }
  return {
    priceCents: price,
    discountCents: session.discountCents ?? 0,
    netCents: session.netCents,
    payerCents: session.payerCents ?? 0,
    patientCents: session.patientCents ?? session.netCents,
  };
}
