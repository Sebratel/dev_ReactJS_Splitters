import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// Cobertura com limiar 100% em linhas: shared e app/auth (TypeScript), exceto env.ts
// (ramos só com import.meta.env.DEV === false não reproduzem no Vitest).
// Uso: npm run test:coverage:core
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
    css: true,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: false,
      include: ['src/shared/**/*.ts', 'src/app/auth/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/test/**',
        'src/main.tsx',
        '**/*.d.ts',
        'src/shared/config/env.ts',
      ],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 88,
      },
    },
  },
})
