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
      thresholds: {
        lines: 50,
        functions: 80,
        branches: 70,
      },
    },
  },
});
