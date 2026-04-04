import { expect, test } from '@playwright/test';

test.describe('Notes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@vp-dietetic.fr');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 5000 }).catch(() => {});
  });

  test('displays notes page', async ({ page }) => {
    await page.goto('/notes');
    await expect(page.locator('h1')).toContainText('Notes cliniques');
  });

  test('new note button navigates to creation page', async ({ page }) => {
    await page.goto('/notes');
    await page.click('text=Nouvelle note');
    await expect(page).toHaveURL(/\/notes\/new/);
    await expect(page.locator('h1')).toContainText('Nouvelle note');
  });

  test('note creation form has type toggle', async ({ page }) => {
    await page.goto('/notes/new');
    await expect(page.locator('text=Libre')).toBeVisible();
    await expect(page.locator('text=Structuree')).toBeVisible();
  });

  test('structured note shows additional fields', async ({ page }) => {
    await page.goto('/notes/new');
    await page.click('text=Structuree');
    await expect(page.locator('text=Objectifs de seance')).toBeVisible();
    await expect(page.locator('text=Plan d\'action')).toBeVisible();
  });
});
