/*
 * Creates an account (the first ADMIN of an environment, or a practitioner). There are no
 * passwords: the person signs in with "Se connecter avec Google", with the Google account of this
 * address (matched by its verified email, then bound to the account). A practitioner gets the default formulas « Bilan »
 * and « Suivi » without a price (see src/modules/me/default-formulas.ts), which the settings
 * page asks her to fill in. Does nothing if the email already exists.
 *
 * Usage (inside the API image, e.g. as an execution of the <env>-api-migrate job):
 *   USER_EMAIL=someone@example.com USER_ROLE=PRATICIENNE USER_FIRST_NAME=Jane USER_LAST_NAME=Doe \
 *     npx --no-install tsx prisma/create-user.cjs
 * USER_ROLE is ADMIN (default) or PRATICIENNE.
 *
 * Before this file is in a deployed image, its contents can be run base64-encoded:
 *   USER_SCRIPT=<base64 of this file>  npx --no-install tsx -e "eval(atob(process.env.USER_SCRIPT))"
 * so keep it plain JavaScript that works both as CommonJS and in an eval.
 */
(async () => {
  const req =
    typeof require === 'function'
      ? require
      : (await import('node:module')).createRequire(process.cwd() + '/package.json');
  const { PrismaClient } = req('@prisma/client');
  // Same as DEFAULT_FORMULAS in src/modules/me/default-formulas.ts
  const DEFAULT_FORMULAS = ['Bilan', 'Suivi'];

  const email = (process.env.USER_EMAIL ?? '').trim().toLowerCase();
  const role = (process.env.USER_ROLE ?? 'ADMIN').trim().toUpperCase();
  const firstName = (process.env.USER_FIRST_NAME ?? '').trim();
  const lastName = (process.env.USER_LAST_NAME ?? '').trim();
  if (!email.includes('@')) throw new Error('USER_EMAIL is missing or invalid');
  if (!['ADMIN', 'PRATICIENNE'].includes(role)) {
    throw new Error('USER_ROLE must be ADMIN or PRATICIENNE');
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`User ${email} already exists (role ${existing.role}): nothing changed`);
      return;
    }
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role,
        ...(role === 'PRATICIENNE' && {
          formulas: { create: DEFAULT_FORMULAS.map((label, position) => ({ label, position })) },
        }),
      },
    });
    console.log(`Created ${role} ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
