import type { Page } from '@playwright/test';

/**
 * Signs in without Google, with the dev sign-in: the API must run with DEV_LOGIN=true (local
 * development and tests only) and the seed's accounts (pnpm db:seed).
 */
export async function signIn(page: Page, email = 'praticienne@vp-dietetic.fr') {
  await page.goto('/login');
  await page.getByLabel('Adresse e-mail d’un compte enregistré').fill(email);
  await page.getByRole('button', { name: 'Connexion de développement' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
