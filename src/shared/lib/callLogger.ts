import { env } from '@/shared/config/env'
import { getOidcAccessToken } from '@/app/auth/oidcAccessToken'
import { useSessionStore } from '@/features/session/store/sessionStore'

/**
 * Buffer leve de observabilidade do frontend. Acumula eventos em memória e envia
 * em lote para `POST /api/client-logs` (backend só grava no log estruturado,
 * sem persistência em banco). Puramente aditivo — nunca lança nem altera o
 * comportamento das chamadas que instrumenta.
 *
 * Não registra corpos de requisição/resposta nem query strings cruas (podem
 * conter tokens/e-mails) — apenas método, path (idealmente um template, ex.
 * `/api/splitters/:id`, nunca a URL completa com querystring) e metadados.
 */

export type ClientLogEvent = {
  level?: 'info' | 'error'
  type: 'api_call' | 'error_boundary' | string
  method?: string
  path?: string
  status?: number
  durationMs?: number
  error?: string
  client?: string
  timestamp: string
}

const FLUSH_INTERVAL_MS = 10_000
const MAX_BATCH_SIZE = 20

let buffer: ClientLogEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null

function endpointUrl(): string {
  return `${env.localBffUrl}/api/client-logs`
}

function readToken(): string | null {
  try {
    const oidc = getOidcAccessToken()
    if (typeof oidc === 'string' && oidc.trim() !== '') return oidc
    return useSessionStore.getState().sessionToken
  } catch {
    return null
  }
}

export function stripQueryString(path: string): string {
  const idx = path.indexOf('?')
  return idx === -1 ? path : path.slice(0, idx)
}

function sendViaFetch(events: ClientLogEvent[]): void {
  const token = readToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  fetch(endpointUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => {
    // Observabilidade nunca pode quebrar o app — falha de envio é silenciosa.
  })
}

function sendViaBeacon(events: ClientLogEvent[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false
  }
  try {
    const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' })
    return navigator.sendBeacon(endpointUrl(), blob)
  } catch {
    return false
  }
}

function flush(useBeacon = false): void {
  if (buffer.length === 0) return
  const batch = buffer.splice(0, buffer.length)
  if (useBeacon) {
    const sent = sendViaBeacon(batch)
    if (!sent) sendViaFetch(batch)
    return
  }
  sendViaFetch(batch)
}

function ensureFlushTimer(): void {
  if (flushTimer !== null) return
  if (typeof setInterval !== 'function') return
  flushTimer = setInterval(() => flush(false), FLUSH_INTERVAL_MS)
  if (typeof flushTimer === 'object' && flushTimer !== null && 'unref' in flushTimer) {
    ;(flushTimer as unknown as { unref: () => void }).unref()
  }
}

function ensureUnloadHandler(): void {
  if (typeof window === 'undefined') return
  if ((window as unknown as { __callLoggerUnloadWired?: boolean }).__callLoggerUnloadWired) return
  ;(window as unknown as { __callLoggerUnloadWired?: boolean }).__callLoggerUnloadWired = true
  window.addEventListener('pagehide', () => flush(true))
  document.addEventListener?.('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true)
  })
}

function pushEvent(event: ClientLogEvent): void {
  ensureFlushTimer()
  ensureUnloadHandler()
  buffer.push(event)
  if (buffer.length >= MAX_BATCH_SIZE) {
    flush(false)
  }
}

/** Registra uma chamada de API concluída (sucesso ou falha). */
export function logApiCall(input: {
  method: string
  path: string
  status?: number
  durationMs: number
  error?: string
  client?: string
}): void {
  pushEvent({
    level: input.error || (input.status !== undefined && input.status >= 500) ? 'error' : 'info',
    type: 'api_call',
    method: input.method,
    path: stripQueryString(input.path),
    status: input.status,
    durationMs: input.durationMs,
    error: input.error,
    client: input.client,
    timestamp: new Date().toISOString(),
  })
}

/** Registra um erro capturado pelo error boundary de topo da aplicação. */
export function logBoundaryError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  pushEvent({
    level: 'error',
    type: 'error_boundary',
    error: message,
    timestamp: new Date().toISOString(),
  })
  flush(false)
}

/** Exposto apenas para testes. */
export function __resetCallLoggerForTests(): void {
  buffer = []
  if (flushTimer !== null) {
    clearInterval(flushTimer)
    flushTimer = null
  }
}
