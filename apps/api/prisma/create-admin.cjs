/*
 * Creates the first ADMIN account of an environment, without anyone knowing its password.
 * The admin signs in with "Continue with Google" (matched by email); a password can be set
 * later with "forgot password". Does nothing if the email already exists.
 *
 * Usage (inside the API image, e.g. as an execution of the <env>-api-migrate job):
 *   ADMIN_EMAIL=someone@example.com ADMIN_FIRST_NAME=Jane ADMIN_LAST_NAME=Doe \
 *     npx --no-install tsx prisma/create-admin.cjs
 *
 * Before this file is in a deployed image, its contents can be run base64-encoded:
 *   ADMIN_SCRIPT=<base64 of this file>  npx --no-install tsx -e "eval(atob(process.env.ADMIN_SCRIPT))"
 * so keep it plain JavaScript that works both as CommonJS and in an eval.
 */
(async () => {
  const req =
    typeof require === 'function'
      ? require
      : (await import('node:module')).createRequire(process.cwd() + '/package.json');
  const { randomBytes } = req('crypto');
  const { PrismaClient } = req('@prisma/client');
  const bcrypt = req('bcryptjs');

  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const firstName = (process.env.ADMIN_FIRST_NAME ?? 'Admin').trim();
  const lastName = (process.env.ADMIN_LAST_NAME ?? '').trim();
  if (!email.includes('@')) throw new Error('ADMIN_EMAIL is missing or invalid');

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`User ${email} already exists (role ${existing.role}): nothing changed`);
      return;
    }
    // Random password that is never stored or shown anywhere
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const user = await prisma.user.create({
      data: { email, firstName, lastName, role: 'ADMIN', passwordHash },
    });
    console.log(`Created ADMIN ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
