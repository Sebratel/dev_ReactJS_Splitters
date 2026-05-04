import type { Splitter } from '@/features/splitters/model/splitter'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'
import type { SplitterMaintenanceStats } from '@/features/splitters/api/fetchSplitterMaintenanceStatsFromLocalDb'

/** Entrada com dados suficientes para ordenar por risco operacional (lista ou fila). */
export type SplitterRiskSortEntry = {
  splitter: Splitter
  massivaStats: SplitterMassivaStats
  maintenanceStats: SplitterMaintenanceStats
  operationalScore: SplitterOperationalScore
}

export function occupancyPercent(splitter: { busyCount: number; outPorts: number }): number {
  if (splitter.outPorts <= 0) return 0
  return (splitter.busyCount / splitter.outPorts) * 100
}

/** Mesma prioridade usada na listagem (SplittersPage): score, massivas abertas, afetados, ocupação, código. */
export function compareByRisk(a: SplitterRiskSortEntry, b: SplitterRiskSortEntry): number {
  if (b.operationalScore.score !== a.operationalScore.score) {
    return b.operationalScore.score - a.operationalScore.score
  }
  if (b.massivaStats.openTickets !== a.massivaStats.openTickets) {
    return b.massivaStats.openTickets - a.massivaStats.openTickets
  }
  if (b.massivaStats.affectedClientsTotal !== a.massivaStats.affectedClientsTotal) {
    return b.massivaStats.affectedClientsTotal - a.massivaStats.affectedClientsTotal
  }
  const occDelta = occupancyPercent(b.splitter) - occupancyPercent(a.splitter)
  if (Math.abs(occDelta) > 0.001) return occDelta
  return String(a.splitter.code ?? '').localeCompare(String(b.splitter.code ?? ''), 'pt-BR')
}
