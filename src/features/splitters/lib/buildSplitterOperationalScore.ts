import type { Splitter } from '@/features/splitters/model/splitter'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function buildSplitterOperationalScore(
  splitter: Splitter,
  massivaStats: SplitterMassivaStats,
): SplitterOperationalScore {
  const usagePercent =
    splitter.outPorts > 0 ? (splitter.busyCount / splitter.outPorts) * 100 : 0

  const occupancyPoints = clamp(usagePercent * 0.45, 0, 45)
  const recurrencePoints = clamp(massivaStats.totalTickets * 5, 0, 20)
  const impactPoints = clamp(
    Math.log10(Math.max(1, massivaStats.affectedClientsTotal + 1)) * 8,
    0,
    15,
  )
  const openIncidentPoints = massivaStats.openTickets > 0 ? 20 : 0

  const score = Math.round(
    clamp(
      occupancyPoints + recurrencePoints + impactPoints + openIncidentPoints,
      0,
      100,
    ),
  )

  if (score >= 70) {
    return { score, tone: 'critical', label: 'Cr\u00EDtico' }
  }

  if (score >= 40) {
    return { score, tone: 'attention', label: 'Aten\u00E7\u00E3o' }
  }

  return { score, tone: 'ok', label: 'Est\u00E1vel' }
}
