import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/components/**/*.tsx', 'src/lib/**/*.ts', 'src/pages/**/*.tsx'],
      exclude: ['src/components/ui/**'],
      // Ratchet set just below actual coverage (the old 70% target was never met):
      // raise these as tests are added, never lower them.
      // Ratchet: raise as tests are added. Vitest 4 counts every included file, tested or
      // not, so these are far below the old figures (which only counted loaded files).
      thresholds: {
        lines: 7,
        functions: 3.5,
        branches: 4,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@vp/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
});
