import { RX_POWER_CRITICAL_DBM, RX_POWER_DEGRADED_DBM } from '@/features/onu/model/onuDiagnostic'

/** Resumo de sinal ONU para um splitter específico (dados agregados). */
export type OnuSplitterSignalSummary = {
  /** Nome legível do splitter (ss.title). Null em payloads antigos do BFF. */
  title: string | null
  total: number
  online: number
  degraded: number
  offline: number
  /** Média de rxPower dos clientes operantes (dBm < 0). Null quando nenhum tem leitura. */
  avgRxPower: number | null
  /** Sinal projetado pelo GeoGrid (potenciaFinal) para a fibra deste splitter. Null quando GeoGrid indisponível ou sem cadastro. */
  projectedRxPower: number | null
}

/**
 * Nível de sinal do splitter — mesma régua do badge do card (por RX médio das ONUs
 * operantes). `offline` = tem ONU mas nenhuma com leitura válida; `sem-medicao` = sem
 * ONU monitorada.
 */
export type SplitterSignalLevel = 'critico' | 'atenuado' | 'normal' | 'offline' | 'sem-medicao'

export function classifySplitterSignalLevel(
  summary: OnuSplitterSignalSummary | null | undefined,
): SplitterSignalLevel {
  if (!summary || summary.total <= 0) return 'sem-medicao'
  if (summary.avgRxPower === null) return 'offline'
  if (summary.avgRxPower <= RX_POWER_CRITICAL_DBM) return 'critico'
  if (summary.avgRxPower <= RX_POWER_DEGRADED_DBM) return 'atenuado'
  return 'normal'
}
