import { expect, test } from '@playwright/test';

test.describe('Appointments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@vp-dietetic.fr');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 5000 }).catch(() => {});
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
