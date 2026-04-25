import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const bffProxyTarget =
    env.VITE_BFF_PROXY_TARGET || 'https://api-gateway-bff.sebratel.net.br'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      allowedHosts: ['somerset-organic-basement-photographers.trycloudflare.com'],
      /**
       * Evita CORS no dev: com `VITE_BFF_BASE_URL` vazio, o app chama `/api/...` no mesmo host
       * e o Vite encaminha ao BFF. Veja comentário em `env.ts` (`bffBaseUrlResolved`).
       */
      proxy: {
        '/__autoisp': {
          target: 'https://autoisp.sebratel.net.br',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/__autoisp/, ''),
        },
        '/api': {
          target: bffProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/__autoisp': {
          target: 'https://autoisp.sebratel.net.br',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/__autoisp/, ''),
        },
        '/api': {
          target: bffProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  }
})
