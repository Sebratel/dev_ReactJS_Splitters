import { env, isApmRumConfigured } from '@/shared/config/env'

/**
 * Elastic APM RUM (Real User Monitoring) — page load, rotas e chamadas XHR/fetch do browser
 * enviadas para o APM Server (Kibana → Observability → APM).
 *
 * Desligado por omissão: sem `VITE_APM_SERVER_URL` o `import()` nunca corre, por isso o
 * agente fica num chunk à parte que o browser não chega a descarregar — o bundle atual não
 * muda de tamanho enquanto a variável não for definida.
 *
 * O `serverUrl` tem de ser um endereço público (o browser do utilizador é quem envia os
 * dados); o host interno do Docker do APM Server não funciona aqui.
 */

let initialized = false

export async function initApmRum(): Promise<void> {
  if (initialized) return
  if (!isApmRumConfigured()) return
  if (typeof window === 'undefined') return

  initialized = true

  try {
    const { init } = await import('@elastic/apm-rum')
    init({
      serviceName: env.apmServiceName,
      serverUrl: env.apmServerUrl,
      environment: env.apmEnvironment,
      ...(env.apmServiceVersion !== '' ? { serviceVersion: env.apmServiceVersion } : {}),
      // `distributedTracingOrigins` fica no padrão (só o mesmo origin): acrescentar o header
      // `traceparent` a chamadas cross-origin (gateway, GeoGrid, AutoISP) exigiria preflight
      // e CORS extra nesses serviços — não vale arriscar as integrações existentes.
      breakdownMetrics: true,
    })
  } catch (error) {
    // Falha no APM nunca pode impedir o arranque do SPA.
    console.warn('[apm-rum] agente não iniciado:', error)
  }
}
