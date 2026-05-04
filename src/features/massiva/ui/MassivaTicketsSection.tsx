import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { closeMassivaTicket } from '@/features/massiva/api/closeMassivaTicket'
import { fetchMassivaHistoryListFromLocalDb } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import {
  formatMassivaListDateDisplay,
  formatPrevisaoEncerramentoDisplay,
} from '@/features/massiva/lib/formatMassivaListDate'
import {
  formatMassivaStatusLabel,
  type MassivaTicket,
} from '@/features/massiva/model/massivaTicket'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { env } from '@/shared/config/env'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { Download, RefreshCw } from 'lucide-react'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { MassivaTicketCard } from '@/features/massiva/ui/MassivaTicketCard'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/** Texto de encerramento não pode ser vazio; mínimo curto para não bloquear descrições objetivas. */
const CLOSE_DESCRIPTION_MIN_LEN = 3

function ticketKey(t: MassivaTicket, index: number): string {
  return `${t.protocol}-${t.assignmentId ?? 'x'}-${index}`
}

type ImpactRange = 'all' | 'none' | 'low' | 'medium' | 'high'
type MassivaListScope = 'abertas' | 'encerradas' | 'todas'
type PeriodPreset = '7d' | '30d' | '90d'
type MassivaRecordTypeFilter = 'all' | 'incidente' | 'evento'
const MASSIVA_PAGE_SIZE = 30

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

function formatHoursLabel(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—'
  if (hours < 24) return `${hours.toFixed(1)}h`
  const days = hours / 24
  return `${days.toFixed(1)}d`
}

function matchesImpactRange(ticket: MassivaTicket, range: ImpactRange): boolean {
  const affected = ticket.affectedClients
  if (range === 'all') return true
  if (range === 'none') return affected <= 0
  if (range === 'low') return affected > 0 && affected <= 100
  if (range === 'medium') return affected > 100 && affected <= 500
  return affected > 500
}

function classifyMassivaRecordType(ticket: MassivaTicket): MassivaRecordTypeFilter {
  const source = `${ticket.title} ${ticket.description}`.trim().toLowerCase()
  if (source.includes('incidente massivo') || source.includes('incidente')) return 'incidente'
  if (source.includes('evento massivo') || source.includes('evento')) return 'evento'
  return 'all'
}

function matchesRecordType(ticket: MassivaTicket, typeFilter: MassivaRecordTypeFilter): boolean {
  if (typeFilter === 'all') return true
  return classifyMassivaRecordType(ticket) === typeFilter
}

function escapeCsvCell(value: string): string {
  const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n')
  const escaped = value.replaceAll('"', '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function buildMassivasCsv(rows: MassivaTicket[]): string {
  const header = [
    'protocolo',
    'assignment_id',
    'status',
    'abertura',
    'previsao_encerramento',
    'ap',
    'splitter',
    'afetados',
    'equipe',
    'solicitado_por',
    'responsavel',
    'descricao',
  ]
  const lines = rows.map((row) => [
    String(row.protocol > 0 ? row.protocol : ''),
    row.assignmentId !== null ? String(row.assignmentId) : '',
    formatMassivaStatusLabel(row.status),
    formatMassivaListDateDisplay(row.openedAt),
    formatPrevisaoEncerramentoDisplay(
      row.expectedCloseAt,
      row.estimateTimeOfRestoration,
    ),
    row.apCode,
    row.splitterCode,
    String(row.affectedClients),
    row.team,
    row.createdBy,
    row.responsible,
    row.description.trim() || row.title,
  ].map(escapeCsvCell).join(','))
  return [header.join(','), ...lines].join('\n')
}

export type MassivaTicketsSectionLayout = 'default' | 'embedded'

type MassivaTicketsSectionProps = {
  /** `embedded`: sem borda dupla; cabeçalho da lista fica no painel pai; rolagem vertical = página (só overflow-x na tabela se necessário). */
  layout?: MassivaTicketsSectionLayout
}

export function MassivaTicketsSection({
  layout = 'default',
}: MassivaTicketsSectionProps) {
  const embedded = layout === 'embedded'
  const { view, refetch, isRefreshing } = useMassivaTickets()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<MassivaListScope>('abertas')
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d')
  const [impactRange, setImpactRange] = useState<ImpactRange>('all')
  const [recordTypeFilter, setRecordTypeFilter] = useState<MassivaRecordTypeFilter>('all')
  const [visibleCount, setVisibleCount] = useState(MASSIVA_PAGE_SIZE)
  const [csvCopied, setCsvCopied] = useState(false)
  const [closingProtocol, setClosingProtocol] = useState<number | null>(null)
  const [closeDescription, setCloseDescription] = useState('')
  const selectedClosingTicket = useMemo(
    () => view.status === 'success'
      ? view.tickets.find((t) => t.protocol === closingProtocol) ?? null
      : null,
    [view, closingProtocol],
  )

  const closeConfigured = env.massivaClosePath.trim() !== ''

  const closeMutation = useMutation({
    mutationFn: closeMassivaTicket,
    onSuccess: async () => {
      setClosingProtocol(null)
      setCloseDescription('')
      await queryClient.invalidateQueries({ queryKey: massivaKeys.list() })
      await queryClient.invalidateQueries({ queryKey: splittersKeys.all })
    },
  })

  const tickets = useMemo<MassivaTicket[]>(
    () => (view.status === 'success' ? view.tickets : []),
    [view],
  )

  const periodStart = useMemo(() => {
    const now = new Date()
    const days = periodPreset === '7d' ? 7 : periodPreset === '30d' ? 30 : 90
    return startOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000))
  }, [periodPreset])

  const scopedTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (scope === 'abertas') return ticket.status === 'aberta'
      if (scope === 'encerradas') return ticket.status === 'encerrada'
      return true
    })
  }, [tickets, scope])

  const scopedTicketsInWindow = useMemo(() => {
    return scopedTickets.filter((ticket) => {
      if (!ticket.openedAt) return false
      return ticket.openedAt >= periodStart
    })
  }, [scopedTickets, periodStart])

  const historyStatus =
    scope === 'abertas' ? 'aberta' : scope === 'encerradas' ? 'encerrada' : null
  const historyQuery = useQuery({
    queryKey: massivaKeys.historyList(
      historyStatus ?? 'all',
      periodStart.toISOString(),
      'open-ended',
      4000,
    ),
    queryFn: () =>
      fetchMassivaHistoryListFromLocalDb({
        status: historyStatus,
        startDate: periodStart,
        limit: 4000,
      }),
    staleTime: 60_000,
    refetchOnMount: false,
  })

  const historyAffectedByProtocol = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of historyQuery.data ?? []) {
      const protocol = row.protocol
      if (protocol === null || protocol <= 0) continue
      const current = map.get(protocol) ?? 0
      map.set(protocol, Math.max(current, row.affectedClients))
    }
    return map
  }, [historyQuery.data])

  const effectiveScopedTicketsInWindow = useMemo(() => {
    return scopedTicketsInWindow.map((ticket) => {
      if (ticket.protocol <= 0) return ticket
      const historical = historyAffectedByProtocol.get(ticket.protocol)
      if (historical == null) return ticket
      if (historical === ticket.affectedClients) return ticket
      return { ...ticket, affectedClients: Math.max(ticket.affectedClients, historical) }
    })
  }, [scopedTicketsInWindow, historyAffectedByProtocol])

  const typeScopedTicketsInWindow = useMemo(
    () => effectiveScopedTicketsInWindow.filter((ticket) => matchesRecordType(ticket, recordTypeFilter)),
    [effectiveScopedTicketsInWindow, recordTypeFilter],
  )

  const filteredTickets = useMemo(() => {
    const text = normalizeText(query)
    return typeScopedTicketsInWindow.filter((ticket) => {
      if (!matchesImpactRange(ticket, impactRange)) return false
      if (text === '') return true
      const haystack = normalizeText(
        [
          ticket.title,
          ticket.apCode,
          ticket.splitterCode,
          ticket.createdBy,
          ticket.responsible,
          String(ticket.protocol),
        ].join(' '),
      )
      return haystack.includes(text)
    })
  }, [typeScopedTicketsInWindow, query, impactRange])

  const chartSeries = useMemo(() => {
    const byDay = new Map<string, {
      at: Date
      label: string
      affectedTotal: number
      affectedIncident: number
      affectedEvent: number
      affectedOther: number
      affectedOpen: number
      affectedClosed: number
      protocols: number
    }>()

    for (const ticket of typeScopedTicketsInWindow) {
      if (!ticket.openedAt) continue
      const day = startOfDay(ticket.openedAt)
      const key = day.toISOString().slice(0, 10)
      const current = byDay.get(key) ?? {
        at: day,
        label: formatDayLabel(day),
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
      if (ticket.status === 'aberta') current.affectedOpen += affected
      if (ticket.status === 'encerrada') current.affectedClosed += affected
      byDay.set(key, current)
    }

    return [...byDay.values()].sort((a, b) => a.at.getTime() - b.at.getTime())
  }, [typeScopedTicketsInWindow])

  const chartTotalAffected = useMemo(
    () => chartSeries.reduce((sum, day) => sum + day.affectedTotal, 0),
    [chartSeries],
  )
  const chartHasOtherType = useMemo(
    () => chartSeries.some((day) => day.affectedOther > 0),
    [chartSeries],
  )
  const periodKpis = useMemo(() => {
    const openNow = typeScopedTicketsInWindow.filter((t) => t.status === 'aberta').length
    const closedNow = typeScopedTicketsInWindow.filter((t) => t.status === 'encerrada').length
    const totalProtocols = typeScopedTicketsInWindow.length
    const affectedAvg =
      totalProtocols > 0
        ? chartTotalAffected / totalProtocols
        : 0
    const topDay = chartSeries.reduce<{ label: string; value: number } | null>(
      (max, day) => {
        if (!max || day.affectedTotal > max.value) {
          return { label: day.label, value: day.affectedTotal }
        }
        return max
      },
      null,
    )
    const closedWithCycle = scopedTicketsInWindow.filter(
      (t) => t.status === 'encerrada' && t.openedAt && t.closedAt,
    )
    const avgClosureHours =
      closedWithCycle.length > 0
        ? closedWithCycle.reduce((sum, t) => {
          const cycleHours = ((t.closedAt as Date).getTime() - (t.openedAt as Date).getTime()) / (1000 * 60 * 60)
          return sum + Math.max(0, cycleHours)
        }, 0) / closedWithCycle.length
        : null
    return {
      openNow,
      closedNow,
      totalProtocols,
      affectedAvg,
      topDay,
      avgClosureHours,
    }
  }, [typeScopedTicketsInWindow, chartTotalAffected, chartSeries])

  useEffect(() => {
    setVisibleCount(MASSIVA_PAGE_SIZE)
  }, [scope, periodPreset, query, impactRange, recordTypeFilter])

  const visibleTickets = useMemo(
    () => filteredTickets.slice(0, visibleCount),
    [filteredTickets, visibleCount],
  )

  const handleExportCsv = async () => {
    const csv = buildMassivasCsv(filteredTickets)
    try {
      await navigator.clipboard.writeText(csv)
      setCsvCopied(true)
      setTimeout(() => setCsvCopied(false), 1500)
    } catch {
      setCsvCopied(false)
    }
  }

  if (view.status === 'not-configured') {
    return (
      <div className={embedded ? 'p-4' : ''}>
        <EmptyState
          title="Listagem não configurada"
          description="Defina VITE_MASSIVA_LIST_PATH no .env com o path do BFF (ex.: /api/v1/massivas/list), alinhado ao endpoint de listagem no backend."
        />
      </div>
    )
  }

  if (view.status === 'loading') {
    return (
      <div className={embedded ? 'p-6' : ''}>
        <LoadingState label="Carregando massivas..." />
      </div>
    )
  }

  if (view.status === 'error') {
    return (
      <div className={embedded ? 'p-4' : ''}>
        <ErrorState
          title="Não foi possível carregar as massivas"
          message={formatQueryError(view.error)}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  if (view.status === 'empty') {
    return (
      <div className={embedded ? 'p-4' : ''}>
        <EmptyState
          title="Nenhuma massiva"
          description="A listagem está vazia no momento."
        />
      </div>
    )
  }

  const shellClass = embedded
    ? 'flex flex-col bg-white'
    : 'overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm'

  return (
    <section
      className={shellClass}
      aria-labelledby="massiva-tickets-heading"
    >
      <h2
        id="massiva-tickets-heading"
        className={
          embedded
            ? 'sr-only'
            : 'border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900'
        }
      >
        Massivas
      </h2>
      <div
        className={`shrink-0 border-b border-neutral-200/80 bg-gradient-to-b from-neutral-50/90 to-neutral-50/40 ${embedded ? 'px-3 py-3' : 'px-4 py-3'}`}
      >
        <div
          className={
            embedded
              ? 'grid grid-cols-1 gap-2 sm:grid-cols-2'
              : 'grid gap-3 md:grid-cols-4'
          }
        >
          <div
            className={`flex items-center gap-1 rounded-xl border border-neutral-200/90 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${embedded ? 'sm:col-span-2' : 'md:col-span-4'}`}
          >
            {([
              { id: 'abertas', label: 'Abertas' },
              { id: 'encerradas', label: 'Encerradas' },
              { id: 'todas', label: 'Todas' },
            ] as Array<{ id: MassivaListScope; label: string }>).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  scope === opt.id
                    ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar…"
            className={`rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition placeholder:text-neutral-400 focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15 ${embedded ? 'sm:col-span-2' : 'md:col-span-2'}`}
          />
          <div className="flex items-center gap-1 rounded-xl border border-neutral-200/90 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {([
              { id: '7d', label: '7d' },
              { id: '30d', label: '30d' },
              { id: '90d', label: '90d' },
            ] as Array<{ id: PeriodPreset; label: string }>).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriodPreset(opt.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  periodPreset === opt.id
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={impactRange}
            onChange={(e) => setImpactRange(e.target.value as ImpactRange)}
            className="rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
          >
            <option value="all">Impacto: todos</option>
            <option value="none">Sem afetados</option>
            <option value="low">1 a 100</option>
            <option value="medium">101 a 500</option>
            <option value="high">Acima de 500</option>
          </select>
          <select
            value={recordTypeFilter}
            onChange={(e) => setRecordTypeFilter(e.target.value as MassivaRecordTypeFilter)}
            className="rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
          >
            <option value="all">Tipo: todos</option>
            <option value="incidente">Tipo: incidente massivo</option>
            <option value="evento">Tipo: evento massivo</option>
          </select>
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? 'mt-2' : 'mt-3'}`}>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/25"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/25"
          >
            <Download size={13} />
            CSV
          </button>
          <span className="text-[11px] text-neutral-500">
            {filteredTickets.length}/{typeScopedTicketsInWindow.length} no período
          </span>
          {historyQuery.isFetching ? (
            <span className="text-[11px] text-neutral-500">sincronizando histórico…</span>
          ) : null}
          {csvCopied ? (
            <span className="text-[11px] font-semibold text-emerald-700">
              CSV copiado
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Protocolos no período</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
              {periodKpis.totalProtocols.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/90">Abertas no período</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-amber-900">
              {periodKpis.openNow.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Encerradas no período</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
              {periodKpis.closedNow.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Média afetados/protocolo</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-rose-800">
              {periodKpis.affectedAvg.toFixed(1)}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Tempo médio de fechamento</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-sky-800">
              {formatHoursLabel(periodKpis.avgClosureHours)}
            </p>
          </div>
        </div>
        <div className={`mt-3 rounded-xl border border-neutral-200/80 bg-white px-3 py-3 ${embedded ? '' : 'shadow-[0_1px_2px_rgba(15,23,42,0.04)]'}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-neutral-800">
              Comparativo por tipo no período (massivas {scope === 'todas' ? 'selecionadas' : scope})
            </p>
            <p className="text-[11px] text-neutral-500">
              Total afetados: <span className="font-bold text-neutral-800">{chartTotalAffected.toLocaleString('pt-BR')}</span>
            </p>
          </div>
          {periodKpis.topDay ? (
            <p className="mb-2 text-[11px] text-neutral-500">
              Pico diário: <span className="font-semibold text-neutral-700">{periodKpis.topDay.label}</span> com{' '}
              <span className="font-semibold text-neutral-700">{periodKpis.topDay.value.toLocaleString('pt-BR')}</span> afetados.
            </p>
          ) : null}
          <div className="h-44">
            {chartSeries.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center text-xs text-neutral-500">
                Sem dados no período/filtro atual para montar o gráfico.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, borderColor: '#e5e7eb' }}
                    formatter={(value: unknown, name: unknown) => [
                      Number(value ?? 0).toLocaleString('pt-BR'),
                      String(name ?? ''),
                    ]}
                  />
                  <Bar dataKey="affectedIncident" name="Afetados (incidente)" fill="#fb7185" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="affectedEvent" name="Afetados (evento)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                  {chartHasOtherType ? (
                    <Bar dataKey="affectedOther" name="Afetados (outros)" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        {!closeConfigured ? (
          <p className={`text-[11px] font-medium text-amber-800 ${embedded ? 'mt-2' : 'mt-3'}`}>
            Encerramento desabilitado: defina{' '}
            <code className="rounded bg-amber-100 px-1">VITE_MASSIVA_CLOSE_PATH</code> no build (ex.{' '}
            <code className="rounded bg-amber-100 px-1">/api/v1/massivas/finalizar-chamado-via-api</code>
            ).
          </p>
        ) : null}
      </div>
      <div
        className={
          embedded
            ? 'border-t border-neutral-100/80 bg-gradient-to-b from-neutral-50/30 to-white px-1 py-4 sm:px-2'
            : 'border-t border-neutral-100/80 bg-neutral-50/20 px-4 py-5'
        }
      >
        {filteredTickets.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            Nenhuma massiva corresponde aos filtros aplicados.
          </p>
        ) : (
          <>
             <ul className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3 min-[1920px]:grid-cols-4">
              {visibleTickets.map((t, i) => (
              <li key={ticketKey(t, i)} className="h-full">
                <MassivaTicketCard
                  ticket={t}
                  closeConfigured={closeConfigured}
                  onRequestClose={(protocol) => {
                    setClosingProtocol(protocol)
                    setCloseDescription('')
                  }}
                />
              </li>
              ))}
            </ul>
            {visibleTickets.length < filteredTickets.length ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + MASSIVA_PAGE_SIZE)}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Carregar mais ({visibleTickets.length}/{filteredTickets.length})
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {selectedClosingTicket !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900">Encerrar massiva</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Protocolo <span className="font-mono font-semibold">{selectedClosingTicket.protocol}</span>
              {selectedClosingTicket.assignmentId !== null
                ? (
                  <>
                    {' e Assignment '}
                    <span className="font-mono font-semibold">{selectedClosingTicket.assignmentId}</span>
                  </>
                )
                : null}
            </p>

            {selectedClosingTicket.assignmentId === null ? (
              <p className="mt-3 text-sm text-red-700">
                Não é possível encerrar sem o identificador do atendimento (assignment) neste
                protocolo. A listagem do BFF precisa expor esse campo (ex.:{' '}
                <code className="text-[11px]">assignmentId</code>,{' '}
                <code className="text-[11px]">assignment_id</code> ou{' '}
                <code className="text-[11px]">input.assignment.id</code>
                ).
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-neutral-700">
                  Descrição de encerramento
                </label>
                <textarea
                  value={closeDescription}
                  onChange={(e) => setCloseDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  placeholder="Informe a descrição final do encerramento…"
                />
                <p className="text-[11px] text-neutral-500">
                  Mínimo de {CLOSE_DESCRIPTION_MIN_LEN} caracteres (
                  {closeDescription.trim().length}/{CLOSE_DESCRIPTION_MIN_LEN}).
                </p>
                {closeMutation.isError ? (
                  <p className="text-xs text-red-700">
                    {formatQueryError(closeMutation.error)}
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700"
                onClick={() => {
                  setClosingProtocol(null)
                  setCloseDescription('')
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                disabled={
                  !closeConfigured ||
                  closeMutation.isPending ||
                  closeDescription.trim().length < CLOSE_DESCRIPTION_MIN_LEN ||
                  selectedClosingTicket.assignmentId === null
                }
                onClick={() => {
                  if (selectedClosingTicket.assignmentId === null) return
                  void closeMutation.mutateAsync({
                    assignmentId: selectedClosingTicket.assignmentId,
                    protocol: selectedClosingTicket.protocol,
                    closeDescription: closeDescription.trim(),
                  })
                }}
              >
                {closeMutation.isPending ? 'Encerrando...' : 'Confirmar encerramento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
