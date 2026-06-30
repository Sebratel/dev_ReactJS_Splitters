/**
 * Agregações do painel de massivas: séries do gráfico com granularidade
 * adaptativa (dia/semana/mês), indicadores (SLA, recorrência por AP) e
 * comparação de tendência entre janelas.
 */
import {
  isMassivaClosedForCounts,
  isMassivaOpenForCounts,
} from '@/features/massiva/lib/massivaDashboardEligibility'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'
import {
  formatMonthLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type MassivaBucketGranularity,
} from '@/features/massiva/lib/massivaPeriod'
import { formatBrazilDayMonthDisplay } from '@/shared/lib/formatBrazilDisplayDate'

export type MassivaRecordType = 'incidente' | 'evento' | 'all'

export function classifyMassivaRecordType(ticket: MassivaTicket): MassivaRecordType {
  const source = `${ticket.title} ${ticket.description}`.trim().toLowerCase()
  if (source.includes('incidente massivo') || source.includes('incidente')) return 'incidente'
  if (source.includes('evento massivo') || source.includes('evento')) return 'evento'
  return 'all'
}

export type MassivaChartBucket = {
  at: Date
  label: string
  affectedTotal: number
  affectedIncident: number
  affectedEvent: number
  affectedOther: number
  affectedOpen: number
  affectedClosed: number
  protocols: number
}

function bucketStart(date: Date, granularity: MassivaBucketGranularity): Date {
  if (granularity === 'month') return startOfMonth(date)
  if (granularity === 'week') return startOfWeek(date)
  return startOfDay(date)
}

function bucketLabel(date: Date, granularity: MassivaBucketGranularity): string {
  if (granularity === 'month') return formatMonthLabel(date)
  return formatBrazilDayMonthDisplay(date)
}

/**
 * Agrupa os tickets por bucket temporal. `start`/`end` delimitam a janela
 * (inclusive); tickets fora dela são ignorados.
 */
export function buildMassivaChartSeries(
  tickets: readonly MassivaTicket[],
  options: {
    granularity: MassivaBucketGranularity
    start: Date
    end: Date
    recentProtocols?: ReadonlySet<number>
  },
): MassivaChartBucket[] {
  const { granularity, start, end, recentProtocols } = options
  const startMs = start.getTime()
  const endMs = end.getTime()
  const byBucket = new Map<string, MassivaChartBucket>()

  for (const ticket of tickets) {
    if (!ticket.openedAt) continue
    const t = ticket.openedAt.getTime()
    if (t < startMs || t > endMs) continue

    const at = bucketStart(ticket.openedAt, granularity)
    const key = at.toISOString()
    const current =
      byBucket.get(key) ??
      {
        at,
        label: bucketLabel(at, granularity),
        affectedTotal: 0,
        affectedIncident: 0,
        affectedEvent: 0,
        affectedOther: 0,
        affectedOpen: 0,
        affectedClosed: 0,
        protocols: 0,
      }

    const affected = Math.max(0, ticket.affectedClients)
    const recordType = classifyMassivaRecordType(ticket)
    current.protocols += 1
    current.affectedTotal += affected
    if (recordType === 'incidente') current.affectedIncident += affected
    else if (recordType === 'evento') current.affectedEvent += affected
    else current.affectedOther += affected
    if (isMassivaOpenForCounts(ticket, recentProtocols)) current.affectedOpen += affected
    if (isMassivaClosedForCounts(ticket)) current.affectedClosed += affected
    byBucket.set(key, current)
  }

  return [...byBucket.values()].sort((a, b) => a.at.getTime() - b.at.getTime())
}

export type MassivaSlaSummary = {
  /** Encerradas com previsão e fechamento válidos. */
  evaluated: number
  /** Encerradas dentro da previsão (closedAt <= expectedCloseAt). */
  within: number
  /** Percentual 0–100 ou `null` quando não há base avaliável. */
  pct: number | null
}

/** % de massivas encerradas dentro da previsão de encerramento. */
export function summarizeMassivaSla(tickets: readonly MassivaTicket[]): MassivaSlaSummary {
  let evaluated = 0
  let within = 0
  for (const ticket of tickets) {
    if (!isMassivaClosedForCounts(ticket)) continue
    const closed = ticket.closedAt
    const expected = ticket.expectedCloseAt
    if (!closed || !expected) continue
    if (Number.isNaN(closed.getTime()) || Number.isNaN(expected.getTime())) continue
    evaluated += 1
    if (closed.getTime() <= expected.getTime()) within += 1
  }
  return {
    evaluated,
    within,
    pct: evaluated > 0 ? (within / evaluated) * 100 : null,
  }
}

export type MassivaApRanking = {
  apCode: string
  protocols: number
  affected: number
}

/** Top pontos de acesso por recorrência (nº de protocolos), com afetados como desempate. */
export function rankMassivaAccessPoints(
  tickets: readonly MassivaTicket[],
  limit = 5,
): MassivaApRanking[] {
  const byAp = new Map<string, { protocols: Set<number>; loose: number; affected: number }>()
  for (const ticket of tickets) {
    const apCode = ticket.apCode.trim()
    if (apCode === '') continue
    const entry = byAp.get(apCode) ?? { protocols: new Set<number>(), loose: 0, affected: 0 }
    if (ticket.protocol > 0) entry.protocols.add(ticket.protocol)
    else entry.loose += 1
    entry.affected += Math.max(0, ticket.affectedClients)
    byAp.set(apCode, entry)
  }
  return [...byAp.entries()]
    .map(([apCode, entry]) => ({
      apCode,
      protocols: entry.protocols.size + entry.loose,
      affected: entry.affected,
    }))
    .sort((a, b) => (b.protocols - a.protocols) || (b.affected - a.affected))
    .slice(0, limit)
}

/** Variação percentual de `current` vs `previous`. `null` quando não há base. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) {
    return current > 0 ? null : 0
  }
  return ((current - previous) / previous) * 100
}
