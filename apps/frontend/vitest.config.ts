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
      // Ratchet, a little below what the suite reaches (2026-11-24: lines 72.9, statements 72,
      // functions 67.5, branches 64.6). Vitest 4 counts every included file, tested or not.
      // Raise these as tests are added, never lower them.
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 65,
        branches: 62,
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
