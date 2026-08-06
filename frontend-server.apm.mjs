/**
 * Bootstrap do agente Elastic APM para o servidor estático/proxy do SPA (`frontend-server.mjs`).
 *
 * É o PRIMEIRO import daquele ficheiro de propósito: o ESM avalia os módulos importados pela
 * ordem de declaração, por isso o agente arranca antes de `node:http` — condição para
 * instrumentar o servidor HTTP e os proxies para o BFF/gateway.
 *
 * Duas salvaguardas para não mexer no comportamento atual:
 *  - sem `ELASTIC_APM_SERVER_URL` não inicia nada (evita erros de ligação em ciclo);
 *  - se o pacote `elastic-apm-node` não existir na imagem, apenas avisa e segue.
 *
 * As variáveis `ELASTIC_APM_*` do ambiente têm precedência sobre as opções daqui.
 */
import { createRequire } from 'node:module'

const serverUrl = String(process.env.ELASTIC_APM_SERVER_URL || '').trim()

let apm = null

if (serverUrl !== '') {
  try {
    const module = await import('elastic-apm-node')
    const agent = module.default ?? module
    apm = agent.start({
      serviceName:
        String(process.env.ELASTIC_APM_SERVICE_NAME || '').trim() || 'splitters-frontend-server',
      serverUrl,
      environment:
        String(process.env.ELASTIC_APM_ENVIRONMENT || '').trim() ||
        String(process.env.NODE_ENV || '').trim() ||
        'production',
      // Este processo faz proxy de pedidos autenticados; corpo e cabeçalhos ficam fora.
      captureBody: 'off',
      captureHeaders: false,
      // Assets do bundle têm hash e geram ruído sem valor de diagnóstico.
      transactionIgnoreUrls: ['/assets/*', '/favicon.ico', '/api/health'],
      // Servidor `http` puro (sem framework que o agente reconheça): sem isto todas as
      // transações apareciam agrupadas como "unknown route" no Kibana.
      usePathAsTransactionName: true,
    })

    // O agente instrumenta os módulos ao vê-los passar por `require`, e o `import` de um
    // builtin em ESM não passa por lá — sem isto, `import http from 'node:http'` no
    // `frontend-server.mjs` ficaria sem instrumentação e não geraria transações. Como os
    // builtins são singletons e o agente aplica o patch no próprio objeto, basta pedi-los
    // aqui por `require` antes de o servidor ser criado.
    const require = createRequire(import.meta.url)
    require('node:http')
    require('node:https')
  } catch (error) {
    console.warn(`[apm] agente APM não iniciado no frontend-server: ${String(error?.message || error)}`)
  }
}

export default apm
