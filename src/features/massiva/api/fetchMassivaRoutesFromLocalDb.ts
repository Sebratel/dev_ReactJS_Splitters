import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type MassivaRouteRow = {
  apCode: string
  apTitle: string
  oltCode: string | null
  oltTitle: string | null
  slot: number
  port: number
  splitterCode: string
  splitterTitle: string
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

function toText(value: unknown): string {
  return String(value ?? '').trim()
}

function toNullableText(value: unknown): string | null {
  const txt = toText(value)
  return txt === '' ? null : txt
}

export async function fetchMassivaRoutesFromLocalDb(): Promise<MassivaRouteRow[]> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/routes`)
  if (!response.ok) {
    throw new Error(`Erro ao consultar rotas da Massiva no BFF Local: ${response.status}`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF Local para rotas da Massiva.')
  }

  return (result.data as Record<string, unknown>[]).map((row) => ({
    apCode: toText(row.apCode),
    apTitle: toText(row.apTitle),
    oltCode: toNullableText(row.oltCode),
    oltTitle: toNullableText(row.oltTitle),
    slot: toInt(row.slot, 0),
    port: toInt(row.port, 0),
    splitterCode: toText(row.splitterCode),
    splitterTitle: toText(row.splitterTitle),
  }))
}

