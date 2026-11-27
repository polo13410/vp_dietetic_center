/*
 * The lot 15 migration on a database filled before it (staging has real accounts): each
 * practitioner's address moves into a first, default practice; her sessions and in-person
 * appointments are placed in it; « Bilan » lasts an hour; issued invoices are untouched.
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
const MIGRATION = '20261124120000_practices_and_appointment_types';
const prismaDir = resolve(__dirname, '../../prisma');

/** The same server, another database. */
function databaseUrl(base: string, name: string) {
  const parsed = new URL(base);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

describe.skipIf(!url)('lot 15 migration on existing data', () => {
  const name = `vp_migration_${Date.now()}`;
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

    // Data as staging has it: raw SQL, the client already knows the new schema
    db = new PrismaClient({ datasourceUrl: scratchUrl });
    const run = (sql: string) => db.$executeRawUnsafe(sql);
    await run(`INSERT INTO "user" (id, email, first_name, last_name, role, updated_at) VALUES
      ('u-val', 'michelle@test.local', 'Valérie', 'Dupont', 'PRATICIENNE', now()),
      ('u-new', 'nouvelle@test.local', 'Jeanne', 'Martin', 'PRATICIENNE', now()),
      ('u-admin', 'admin@test.local', 'Admin', 'Test', 'ADMIN', now())`);
    await run(`INSERT INTO practitioner_profile (id, user_id, practice_name, address, zip_code, city, siret, adeli_rpps, updated_at)
      VALUES ('pp-val', 'u-val', 'Valérie Dupont, diététicienne', '12 rue des Oliviers', '13100', 'Aix-en-Provence',
              '91234567800011', '139512345', now())`);
    await run(`INSERT INTO formula (id, practitioner_id, label, price_cents, position, updated_at) VALUES
      ('f-bilan', 'u-val', 'Bilan', 6000, 0, now()), ('f-suivi', 'u-val', 'Suivi', 5000, 1, now())`);
    await run(`INSERT INTO patient (id, practitioner_id, first_name, last_name, updated_at)
      VALUES ('p-1', 'u-val', 'Martine', 'Roux', now())`);
    await run(`INSERT INTO appointment (id, patient_id, practitioner_id, start_at, end_at, duration, type, reason, updated_at) VALUES
      ('a-cab', 'p-1', 'u-val', '2026-11-20 09:00', '2026-11-20 10:00', 60, 'IN_PERSON', 'Bilan', now()),
      ('a-visio', 'p-1', 'u-val', '2026-11-27 09:00', '2026-11-27 09:45', 45, 'VIDEO', NULL, now())`);
    await run(`INSERT INTO consultation (id, patient_id, practitioner_id, appointment_id, date, formula_id, formula_label, price_cents, payment_method, updated_at)
      VALUES ('c-1', 'p-1', 'u-val', 'a-cab', '2026-11-20 09:00', 'f-bilan', 'Bilan', 6000, 'CARD', now())`);
    await run(`INSERT INTO invoice (id, practitioner_id, patient_id, consultation_id, type, year, sequence, number, issued_at,
        amount_cents, payment_method, service_label, service_date, practice_name, practice_address, practice_zip_code,
        practice_city, siret, patient_first_name, patient_last_name)
      VALUES ('i-1', 'u-val', 'p-1', 'c-1', 'INVOICE', 2026, 1, '2026-0001', '2026-11-20 10:00', 6000, 'CARD', 'Bilan',
        '2026-11-20 09:00', 'Valérie Dupont, diététicienne', '12 rue des Oliviers', '13100', 'Aix-en-Provence',
        '91234567800011', 'Martine', 'Roux')`);

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

  it('moves her address into a first practice, which is her default one', async () => {
    const practices = await db.practice.findMany({ where: { practitionerId: 'u-val' } });
    expect(practices).toEqual([
      expect.objectContaining({
        name: 'Aix-en-Provence',
        address: '12 rue des Oliviers',
        zipCode: '13100',
        city: 'Aix-en-Provence',
        siret: null,
        isDefault: true,
        archivedAt: null,
      }),
    ]);
    // Her activity keeps who she is
    expect(await db.practitionerProfile.findUnique({ where: { userId: 'u-val' } })).toMatchObject({
      practiceName: 'Valérie Dupont, diététicienne',
      siret: '91234567800011',
      adeliRpps: '139512345',
    });
  });

  it('gives a practitioner who filled in nothing an empty default practice, and nobody else one', async () => {
    expect(await db.practice.findMany({ where: { practitionerId: 'u-new' } })).toEqual([
      expect.objectContaining({ name: 'Mon cabinet', address: null, isDefault: true }),
    ]);
    expect(await db.practice.count({ where: { practitionerId: 'u-admin' } })).toBe(0);
  });

  it('places her sessions and in-person appointments in it, not the video ones', async () => {
    const practice = await db.practice.findFirstOrThrow({ where: { practitionerId: 'u-val' } });
    // Only the columns of that time: later migrations (lot 16) added others
    expect(await db.consultation.findUnique({ where: { id: 'c-1' }, select: { practiceId: true } })).toMatchObject({
      practiceId: practice.id,
    });
    expect(await db.appointment.findUnique({ where: { id: 'a-cab' } })).toMatchObject({
      practiceId: practice.id,
      formulaId: null,
      reason: 'Bilan',
    });
    expect(await db.appointment.findUnique({ where: { id: 'a-visio' } })).toMatchObject({ practiceId: null });
  });

  it('gives each formula a duration: an hour for « Bilan », 45 minutes otherwise', async () => {
    const formulas = await db.formula.findMany({ orderBy: { position: 'asc' }, select: { label: true, durationMinutes: true } });
    expect(formulas.map((f) => [f.label, f.durationMinutes])).toEqual([
      ['Bilan', 60],
      ['Suivi', 45],
    ]);
  });

  it('leaves issued invoices as they were', async () => {
    const invoice = await db.invoice.findUnique({
      where: { id: 'i-1' },
      select: { number: true, practiceAddress: true, practiceCity: true, siret: true, amountCents: true },
    });
    expect(invoice).toMatchObject({
      number: '2026-0001',
      practiceAddress: '12 rue des Oliviers',
      practiceCity: 'Aix-en-Provence',
      siret: '91234567800011',
      amountCents: 6000,
    });
  });
});
