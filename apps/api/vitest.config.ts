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
      // Ratchet set just below actual coverage (the old 70% target was never met):
      // raise these as tests are added, never lower them.
      // Vitest 4 counts branches differently (67.7% where vitest 3 reported over 70%)
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
      },
    },
  },
});
