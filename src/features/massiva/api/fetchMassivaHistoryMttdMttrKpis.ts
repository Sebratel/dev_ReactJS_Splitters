import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { env } from '@/shared/config/env'

export type MttdMttrMonthlyKpi = {
  /** Mês no formato YYYY-MM (ex.: '2025-06'). */
  month: string
  /** Total de massivas encerradas no mês (base do cálculo). */
  total: number
  /**
   * MTTD médio em minutos: de `event_start_at` até `event_identified_at`.
   * Null enquanto a coluna `event_start_at` não foi migrada ou não há dados suficientes.
   */
  avgMttdMinutes: number | null
  /**
   * MTTR médio em minutos: de `event_identified_at` até `closed_at`.
   * Null se não há registros encerrados com ambos os timestamps no mês.
   */
  avgMttrMinutes: number | null
  /** Quantidade de registros que contribuíram para a média de MTTR. */
  mttrCount: number
  /** Quantidade de registros que contribuíram para a média de MTTD. */
  mttdCount: number
}

export async function fetchMassivaHistoryMttdMttrKpis(
  months: number,
): Promise<MttdMttrMonthlyKpi[]> {
  const params = new URLSearchParams({ months: String(months) })
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/mttd-mttr-kpis?${params.toString()}`,
  )

  if (!response.ok) {
    throw new Error(`Erro ao consultar KPIs MTTD/MTTR: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado ao consultar KPIs MTTD/MTTR.')
  }

  return parsed.data.map((row: Record<string, unknown>) => ({
    month: String(row.month ?? ''),
    total: Math.max(0, Number(row.total ?? 0)),
    avgMttdMinutes: row.avgMttdMinutes != null && Number.isFinite(Number(row.avgMttdMinutes))
      ? Math.round(Number(row.avgMttdMinutes))
      : null,
    avgMttrMinutes: row.avgMttrMinutes != null && Number.isFinite(Number(row.avgMttrMinutes))
      ? Math.round(Number(row.avgMttrMinutes))
      : null,
    mttrCount: Math.max(0, Number(row.mttrCount ?? 0)),
    mttdCount: Math.max(0, Number(row.mttdCount ?? 0)),
  }))
}
