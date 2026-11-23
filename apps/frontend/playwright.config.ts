import { defineConfig, devices } from '@playwright/test';

import { API_PORT, APP_PORT, E2E_DATABASE_URL } from './e2e/env';

/**
 * End-to-end tests of the real flows, against the API (built, then started with the dev sign-in)
 * and the Vite dev server (the dev sign-in form only exists in development builds).
 * Each run starts from a dedicated database rebuilt from the migrations and the seed
 * (e2e/prepare-database.mjs), so the flows can rely on the seed's patients.
 */
export default defineConfig({
  testDir: './e2e',
  // The flows share one database: one at a time keeps them independent of each other's timing
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    // iPad landscape, the practitioner's device
    ...devices['Desktop Chrome'],
    viewport: { width: 1366, height: 1024 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node ../frontend/e2e/prepare-database.mjs && pnpm run build && node dist/main',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        // The seed and the browser count days in the practice's time zone
        TZ: 'Europe/Paris',
        PORT: String(API_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        DEV_LOGIN: 'true',
        JWT_SECRET: 'e2e-only-secret-not-used-anywhere-else',
        // Many sign-ins in a row from the same address
        THROTTLE_LIMIT: '10000',
      },
    },
    {
      command: `pnpm exec vite --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
