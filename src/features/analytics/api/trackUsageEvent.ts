import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { getUsageContext } from '@/features/analytics/lib/usageContext'
import type { UsageModuleKey } from '@/features/analytics/lib/resolveModuleFromPath'

export type UsageEventInput = {
  module: UsageModuleKey
  path: string
  eventType?: 'pageview' | 'action'
  action?: string | null
  sessionId?: string | null
  durationMs?: number | null
  referrerPath?: string | null
}

const ENDPOINT = () => `${env.localBffUrl}/api/usage-events`

/**
 * Envia eventos de uso ao BFF. Fire-and-forget: nunca lança nem bloqueia a UI —
 * analytics jamais pode quebrar a navegação. `keepalive` garante que o último
 * evento (ao fechar a aba) ainda saia, e mantém o header Authorization (ao
 * contrário do sendBeacon, que não permite cabeçalhos).
 */
export function trackUsageEvents(events: UsageEventInput[], options?: { keepalive?: boolean }): void {
  if (events.length === 0) return
  try {
    void fetchWithSessionAuth(ENDPOINT(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: options?.keepalive ?? false,
    }).catch(() => {
      /* silencioso — analytics é best-effort */
    })
  } catch {
    /* silencioso */
  }
}

/**
 * Registra uma AÇÃO do usuário (clique/uso de recurso) dentro do módulo atual.
 * Ergonômico: pega módulo/rota/sessão do contexto corrente. Best-effort.
 * Ex.: trackUsageAction('massiva_abrir'), trackUsageAction('splitters_exportar').
 */
export function trackUsageAction(action: string, options?: { module?: UsageModuleKey }): void {
  const clean = (action || '').trim()
  if (clean === '') return
  const ctx = getUsageContext()
  trackUsageEvents([
    {
      module: options?.module ?? ctx?.module ?? 'outros',
      path: ctx?.path ?? '/',
      eventType: 'action',
      action: clean,
      sessionId: ctx?.sessionId ?? null,
    },
  ])
}
