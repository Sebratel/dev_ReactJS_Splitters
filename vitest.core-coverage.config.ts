import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { alias, testBase } from './vitest.config'

// Cobertura com limiar 100% em linhas: shared e app/auth (TypeScript), exceto env.ts
// (ramos só com import.meta.env.DEV === false não reproduzem no Vitest).
// Uso: npm run test:coverage:core
//
// O alias e a forma de correr os testes vêm do `vitest.config.ts` de propósito: quando
// estavam copiados aqui, divergiram (faltava `@domain`, `globals` estava a `false`) e este
// comando ficou vermelho sem ninguém dar por isso. Aqui só deve viver a cobertura.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias },
  test: {
    ...testBase,
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
