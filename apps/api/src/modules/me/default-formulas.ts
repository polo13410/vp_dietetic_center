import type { Prisma } from '@prisma/client';

/**
 * Formulas every new practitioner starts with, without a price: the settings page asks her to
 * fill them in. They are also her types of appointment, hence the duration. Keep in sync with
 * prisma/create-user.cjs (plain JavaScript, cannot import this).
 */
export const DEFAULT_FORMULAS = [
  { label: 'Bilan', durationMinutes: 60 },
  { label: 'Suivi', durationMinutes: 45 },
] as const;

/** Creates the default formulas, unless the practitioner already has some. */
export async function ensureDefaultFormulas(
  db: Pick<Prisma.TransactionClient, 'formula'>,
  practitionerId: string,
) {
  const existing = await db.formula.count({ where: { practitionerId } });
  if (existing > 0) return;
  await db.formula.createMany({
    data: DEFAULT_FORMULAS.map((formula, position) => ({ practitionerId, ...formula, position })),
  });
}
