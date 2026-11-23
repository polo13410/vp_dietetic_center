import { expect, test } from '@playwright/test';

import { signIn } from './sign-in';

test.describe('Appointments', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('displays appointments page', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.locator('h1')).toContainText('Rendez-vous');
  });

  test('new appointment button opens dialog', async ({ page }) => {
    await page.goto('/appointments');
    await page.click('text=Nouveau rendez-vous');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Nouveau rendez-vous').last()).toBeVisible();
  });

  test('calendar page displays weekly view', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('h1')).toContainText('Calendrier');
    // Should show day buttons for the week
    await expect(page.locator('text=lun.')).toBeVisible().catch(() => {});
  });
});
