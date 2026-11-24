export type GmudDeadlineTone = 'done' | 'cancelled' | 'overdue' | 'soon' | 'ok' | 'none'

export type GmudDeadline = { tone: GmudDeadlineTone; label: string }

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Selo de prazo da GMUD a partir do Voalle: encerrada/cancelada, vencida há N dias,
 * vence hoje / em N dias (≤ 2 dias = atenção) ou sem prazo.
 */
export function gmudDeadline(input: {
  status: string | null | undefined
  slaDate: string | null | undefined
  conclusionDate: string | null | undefined
  now?: Date
}): GmudDeadline {
  const now = input.now ?? new Date()
  if (/cancel/i.test(input.status ?? '')) return { tone: 'cancelled', label: 'Cancelada' }
  if (input.conclusionDate) return { tone: 'done', label: 'Encerrada' }
  if (!input.slaDate) return { tone: 'none', label: 'Sem prazo' }
  const sla = new Date(input.slaDate)
  if (Number.isNaN(sla.getTime())) return { tone: 'none', label: 'Sem prazo' }

  const diffMs = sla.getTime() - now.getTime()
  if (diffMs < 0) {
    const days = Math.floor(-diffMs / DAY_MS)
    return { tone: 'overdue', label: days === 0 ? 'Vencida hoje' : `Vencida há ${days} d` }
  }
  const days = Math.floor(diffMs / DAY_MS)
  if (days === 0) return { tone: 'soon', label: 'Vence hoje' }
  return { tone: days <= 2 ? 'soon' : 'ok', label: `Vence em ${days} d` }
}
