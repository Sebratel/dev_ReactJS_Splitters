import path from 'node:path'
import https from 'node:https'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const bffProxyTarget =
    env.VITE_BFF_PROXY_TARGET || 'https://n8n-staging.sebratel.net.br'

  // Basic Auth opcional para gateway de staging (GATEWAY_BASIC_AUTH_USER + _PASSWORD).
  // Em producao deixe as variaveis vazias — o proxy nao envia o header.
  // Usa `configure` (proxyReq event) em vez de `headers` pois o http-proxy
  // interno do Vite 6 crashava com `Cannot read properties of null (reading 'split')`
  // quando `headers` era passado diretamente nas opcoes do proxy.
  const gatewayBasicAuth = (() => {
    const user = env.GATEWAY_BASIC_AUTH_USER ?? ''
    const pass = env.GATEWAY_BASIC_AUTH_PASSWORD ?? ''
    if (user === '' || pass === '') return null
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
  })()

  // Agente HTTPS que forca HTTP/1.1 via ALPN. O http-proxy do Vite 6 crasha com
  // "Cannot read properties of null (reading 'split')" quando o servidor de staging
  // usa HTTP/2 (negociado no handshake TLS via ALPN). Passar ALPNProtocols=['http/1.1']
  // impede que o TLS anuncie suporte a h2, forcando o servidor a responder com HTTP/1.1.
  const stagingHttpsAgent = new https.Agent({
    rejectUnauthorized: false, // staging pode usar cert auto-assinado
    ALPNProtocols: ['http/1.1'],
  })

  // Plugin que injeta Basic Auth em requisicoes /api antes do proxy do Vite.
  const gatewayAuthPlugin = {
    name: 'vite-plugin-gateway-basic-auth',
    configureServer(server: import('vite').ViteDevServer) {
      if (!gatewayBasicAuth) return
      server.middlewares.use('/api', (req, _res, next) => {
        req.headers['authorization'] = gatewayBasicAuth
        next()
      })
    },
  }

  return {
    plugins: [react(), tailwindcss(), gatewayAuthPlugin],
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
          secure: false,   // usa rejectUnauthorized no agente abaixo
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          agent: stagingHttpsAgent as any,
        },
      },
    },
    preview: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts: true,
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
