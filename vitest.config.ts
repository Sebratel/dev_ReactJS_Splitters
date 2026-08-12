import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

/**
 * Partilhado com o `vitest.core-coverage.config.ts`. Estava duplicado nos dois ficheiros e
 * divergiu: faltava lá o alias `@domain` e o `globals` estava a `false`, o que punha
 * `npm run test:coverage:core` vermelho com 3 ficheiros a falhar. Exportar em vez de copiar
 * torna essa divergência impossível.
 */
export const alias = {
  '@': path.resolve(__dirname, 'src'),
  '@domain': path.resolve(__dirname, 'src/domain'),
}

/**
 * Como os testes correm. A cobertura é o que difere entre os dois configs, e só ela.
 * Sem `as const` no objeto todo: isso tornaria os arrays `readonly` e o Vitest espera-os
 * mutáveis. Só o `pool` precisa de ser literal, porque o tipo dele é uma união fechada.
 */
export const testBase = {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  globals: true,
  css: true,
  pool: 'forks' as const,
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias },
  test: {
    ...testBase,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/test/**',
        'src/main.tsx',
        '**/*.d.ts',
      ],
    },
  },
})
