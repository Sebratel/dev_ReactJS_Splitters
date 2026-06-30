import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type {
  OnuSignalByModel,
  OnuModelSignalRow,
} from '@/features/onu/model/onuSignalByModel'

function toNum(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toNumOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Saúde de sinal das ONUs agregada por modelo. Vazio quando o monitoramento está off. */
export async function fetchOnuSignalByModel(
  signal?: AbortSignal,
): Promise<OnuSignalByModel> {
  const url = `${env.localBffUrl}/api/onu-diagnostics/by-model`
  const response = await fetchWithSessionAuth(url, { signal })

  if (response.status === 503) return { generatedAt: null, models: [] }
  if (!response.ok) {
    throw new Error(`Erro ao consultar sinal por modelo de ONU: ${response.status}`)
  }

  const result = await response.json()
  if (!result?.success || !result.data) {
    throw new Error('Formato de resposta inesperado do BFF (sinal por modelo).')
  }

  const raw = result.data as Record<string, unknown>
  const models = Array.isArray(raw.models) ? raw.models : []
  return {
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : null,
    models: models.map((m): OnuModelSignalRow => {
      const r = m as Record<string, unknown>
      return {
        model: String(r.model ?? '(modelo não informado)'),
        total: toNum(r.total),
        online: toNum(r.online),
        degraded: toNum(r.degraded),
        offline: toNum(r.offline),
        unknown: toNum(r.unknown),
        critical: toNum(r.critical),
        avgRx: toNumOrNull(r.avgRx),
      }
    }),
  }
}
