import { expect, test } from '@playwright/test';

import { signIn } from './sign-in';

test.describe('Authentication', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('offers Google only, with no password field', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('refuses an address that is not registered', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail d’un compte enregistré').fill('inconnue@example.com');
    await page.getByRole('button', { name: 'Connexion de développement' }).click();
    await expect(page.getByRole('alert')).toContainText('n’est pas enregistrée');
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs a registered practitioner in to her dashboard', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
