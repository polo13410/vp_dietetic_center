/**
 * Rebuilds the end-to-end database from scratch: migrations, then the seed. Run from apps/api by
 * the API's web server in playwright.config.ts, before the API starts.
 * Refuses any database whose name does not contain "e2e": it wipes everything.
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const url = process.env.DATABASE_URL ?? '';
const name = url.split('?')[0].split('/').pop() ?? '';
if (!name.includes('e2e')) {
  console.error(`Refusing to wipe "${name || url}": the end-to-end database name must contain "e2e".`);
  process.exit(1);
}

const run = (command) => execSync(command, { stdio: 'inherit', env: process.env });

// Creates the database if it does not exist yet
run('pnpm exec prisma migrate deploy');

const { PrismaClient } = createRequire(`${process.cwd()}/package.json`)('@prisma/client');
const prisma = new PrismaClient();
await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
await prisma.$executeRawUnsafe('CREATE SCHEMA public');
await prisma.$disconnect();

run('pnpm exec prisma migrate deploy');
run('pnpm run db:seed');
