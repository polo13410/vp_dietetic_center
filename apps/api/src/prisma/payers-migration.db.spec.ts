/*
 * The lot 16 migration on a database filled before it (staging has real accounts): existing
 * sessions get their split (no discount, no payer: the patient pays the price), sessions without
 * a price get none, issued invoices are untouched and stay guarded, new copies included.
 * Builds a scratch database at the previous migration, fills it, then applies the new one.
 * Runs when TEST_DATABASE_URL is set (CI does; its user may create databases); skipped otherwise.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
const MIGRATION = '20261125120000_discount_and_third_party_payers';
const prismaDir = resolve(__dirname, '../../prisma');

/** The same server, another database. */
function databaseUrl(base: string, name: string) {
  const parsed = new URL(base);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

describe.skipIf(!url)('lot 16 migration on existing data', () => {
  const name = `vp_migration16_${Date.now()}`;
  const scratchUrl = url ? databaseUrl(url, name) : '';
  let admin: PrismaClient;
  let db: PrismaClient;
  let dir: string;

  /** `prisma migrate deploy` with the migrations copied into `dir`. */
  const deploy = () =>
    execFileSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', join(dir, 'schema.prisma')],
      { env: { ...process.env, DATABASE_URL: scratchUrl }, stdio: 'pipe' },
    );
  const copyMigration = (migration: string) =>
    cpSync(join(prismaDir, 'migrations', migration), join(dir, 'migrations', migration), { recursive: true });

  beforeAll(async () => {
    admin = new PrismaClient({ datasourceUrl: url });
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);

    // The schema as it was before: every migration up to the previous one
    dir = mkdtempSync(join(tmpdir(), 'vp-migration-'));
    cpSync(join(prismaDir, 'schema.prisma'), join(dir, 'schema.prisma'));
    cpSync(join(prismaDir, 'migrations', 'migration_lock.toml'), join(dir, 'migrations', 'migration_lock.toml'));
    for (const migration of readdirSync(join(prismaDir, 'migrations')).sort()) {
      if (migration < MIGRATION && !migration.endsWith('.toml')) copyMigration(migration);
    }
    deploy();

    // Data as staging has it, in raw SQL
    db = new PrismaClient({ datasourceUrl: scratchUrl });
    const run = (sql: string) => db.$executeRawUnsafe(sql);
    await run(`INSERT INTO "user" (id, email, first_name, last_name, role, updated_at)
      VALUES ('u-val', 'michelle@test.local', 'Valérie', 'Dupont', 'PRATICIENNE', now())`);
    await run(`INSERT INTO patient (id, practitioner_id, first_name, last_name, updated_at)
      VALUES ('p-1', 'u-val', 'Martine', 'Roux', now())`);
    await run(`INSERT INTO consultation (id, patient_id, practitioner_id, date, formula_label, price_cents, payment_method, updated_at)
      VALUES ('c-1', 'p-1', 'u-val', '2026-11-20 09:00', 'Bilan', 6000, 'CARD', now()),
             ('c-2', 'p-1', 'u-val', '2026-11-21 09:00', NULL, NULL, 'NONE', now())`);
    await run(`INSERT INTO invoice (id, practitioner_id, patient_id, consultation_id, type, year, sequence, number, issued_at,
        amount_cents, payment_method, service_label, service_date, practice_name, patient_first_name, patient_last_name)
      VALUES ('i-1', 'u-val', 'p-1', 'c-1', 'INVOICE', 2026, 1, '2026-0001', '2026-11-20 10:00', 6000, 'CARD', 'Bilan',
        '2026-11-20 09:00', 'Valérie Dupont, diététicienne', 'Martine', 'Roux')`);

    copyMigration(MIGRATION);
    deploy();
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.$disconnect();
    }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('gives existing sessions their split: no discount, no payer, the patient pays the price', async () => {
    expect(await db.consultation.findUnique({ where: { id: 'c-1' },
      select: { discountKind: true, discountCents: true, netCents: true, payerCents: true, patientCents: true, payerId: true },
    })).toMatchObject({
      discountKind: null,
      discountCents: 0,
      netCents: 6000,
      payerCents: 0,
      patientCents: 6000,
      payerId: null,
    });
    // No price, no split
    expect(await db.consultation.findUnique({ where: { id: 'c-2' }, select: { netCents: true, patientCents: true } })).toMatchObject({ netCents: null, patientCents: null });
  });

  it('leaves issued invoices as they were: a patient invoice, without the new copies', async () => {
    expect(await db.invoice.findUnique({ where: { id: 'i-1' } })).toMatchObject({
      number: '2026-0001',
      recipient: 'PATIENT',
      amountCents: 6000,
      priceCents: null,
      payerName: null,
      paidAt: null,
    });
  });

  it('still guards issued invoices, new copies included', async () => {
    await expect(db.invoice.update({ where: { id: 'i-1' }, data: { amountCents: 1 } })).rejects.toThrow(/cannot be changed/);
    await expect(db.invoice.update({ where: { id: 'i-1' }, data: { payerName: 'Mutuelle' } })).rejects.toThrow(
      /cannot be changed/,
    );
    await expect(db.invoice.delete({ where: { id: 'i-1' } })).rejects.toThrow(/cannot be deleted/);
  });
});
