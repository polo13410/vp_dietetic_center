import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/modules/**/*.service.ts'],
      // Ratchet, a little below what the suite reaches with the database tests, as in CI
      // (2026-11-24: lines 94.2, statements 91.6, functions 94, branches 82.4). Without
      // TEST_DATABASE_URL those tests are skipped and coverage drops under these figures.
      // Raise these as tests are added, never lower them.
      thresholds: {
        lines: 91,
        statements: 89,
        functions: 91,
        branches: 80,
      },
    },
  },
});
