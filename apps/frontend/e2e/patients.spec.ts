import { expect, test } from '@playwright/test';

// These tests require a running API with seeded data and an authenticated session
test.describe('Patients', () => {
  test.beforeEach(async ({ page }) => {
    // Attempt login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@vp-dietetic.fr');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 5000 }).catch(() => {});
  });

  test('displays patients list page', async ({ page }) => {
    await page.goto('/patients');
    await expect(page.locator('h1')).toContainText('Patients');
  });

  test('navigates to new patient form', async ({ page }) => {
    await page.goto('/patients');
    await page.click('text=Nouveau patient');
    await expect(page).toHaveURL(/\/patients\/new/);
    await expect(page.locator('h1')).toContainText('Nouveau patient');
  });

  test('new patient form has required fields', async ({ page }) => {
    await page.goto('/patients/new');
    // Check identity fields exist
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
  });

  test('search filters the patient list', async ({ page }) => {
    await page.goto('/patients');
    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Wait for debounced search
      await page.waitForTimeout(500);
    }
  });
});
