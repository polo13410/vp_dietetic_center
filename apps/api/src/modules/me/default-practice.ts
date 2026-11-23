import type { Prisma } from '@prisma/client';

/**
 * Name of the practice every new practitioner starts with, without an address: « Mes cabinets »
 * asks her to fill it in. Keep in sync with prisma/create-user.cjs (plain JavaScript, cannot
 * import this).
 */
export const DEFAULT_PRACTICE_NAME = 'Mon cabinet';

type Db = Pick<Prisma.TransactionClient, 'practice'>;

/** Creates her first practice (the default one), unless she already has one. */
export async function ensureDefaultPractice(db: Db, practitionerId: string) {
  const existing = await db.practice.count({ where: { practitionerId } });
  if (existing > 0) return;
  await db.practice.create({ data: { practitionerId, name: DEFAULT_PRACTICE_NAME, isDefault: true } });
}

/**
 * Her default practice: where a session takes place when nothing else says so. Falls back on
 * her first active one should the default be missing, and on none if she has no practice.
 */
export function defaultPractice(db: Db, practitionerId: string) {
  return db.practice.findFirst({
    where: { practitionerId, archivedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}
