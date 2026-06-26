import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type {
  OnuRecentChanges,
  OnuStatusChange,
} from '@/features/onu/model/onuStatusChange'

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

export function parseEvents(raw: unknown): OnuStatusChange[] {
  if (!Array.isArray(raw)) return []
  return (raw as Record<string, unknown>[]).map((e) => ({
    id: num(e.id),
    kind: e.kind === 'recovery' ? 'recovery' : 'drop',
    previousStatus: text(e.previousStatus),
    newStatus: text(e.newStatus),
    trigger: text(e.trigger),
    previousRxPower: numOrNull(e.previousRxPower),
    newRxPower: numOrNull(e.newRxPower),
    at: text(e.at),
    ageSeconds: numOrNull(e.ageSeconds),
    username: text(e.username),
    oltHostname: text(e.oltHostname),
  }))
}

/** Feed de quedas/recuperações recentes de ONU (near-real-time). */
export async function fetchOnuRecentChanges(): Promise<OnuRecentChanges | null> {
  const url = `${env.localBffUrl}/api/onu-diagnostics/recent-changes`
  const response = await fetchWithSessionAuth(url)

  if (response.status === 503) return null
  if (!response.ok) {
    throw new Error(`Erro ao consultar mudanças de ONU: ${response.status}`)
  }

  const result = await response.json()
  if (!result?.success || !result.data) return null

  return parseRecentChanges(result.data as Record<string, unknown>)
}

/** Parser puro do payload de mudanças recentes — exportado para testes. */
export function parseRecentChanges(d: Record<string, unknown>): OnuRecentChanges {
  return {
    generatedAt: String(d.generatedAt ?? ''),
    drops: num(d.drops),
    recoveries: num(d.recoveries),
    events: parseEvents(d.events),
  }
}
