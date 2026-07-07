import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { fetchMassivaHistoryListFromLocalDb } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import {
  formatMassivaListDateDisplay,
  formatPrevisaoEncerramentoDisplay,
} from '@/features/massiva/lib/formatMassivaListDate'
import {
  isExpectedMassivaCatalogTitle,
  isMassivaMonitoringOutOfCatalogTitle,
  isMassivaStandardFlowCatalogTitle,
} from '@/features/massiva/lib/massivaCatalogTitle'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import { collectMassivaPanelAbertasTickets } from '@/features/massiva/lib/massivaPanelAbertasList'
import {
  isMassivaClosedForCounts,
  isMassivaClosedForPanelList,
  isMassivaEligibleForDashboardCounts,
  isMassivaOpenForGlobalDashboard,
  isMassivaOpenForPanelList,
  summarizeMassivaPeriodCounts,
} from '@/features/massiva/lib/massivaDashboardEligibility'
import { pruneRecentOpensClosedByBff } from '@/features/massiva/lib/pruneRecentOpensAgainstBff'
import {
  readRecentOpenTicketsFromStorage,
  removeRecentOpenTicketFromStorage,
} from '@/features/massiva/lib/massivaRecentOpensStorage'
import {
  formatMassivaStatusLabel,
  type MassivaTicket,
} from '@/features/massiva/model/massivaTicket'
import {
  buildMassivaChartSeries,
  percentChange,
  rankMassivaAccessPoints,
  summarizeMassivaSla,
} from '@/features/massiva/lib/massivaInsights'
import {
  listRecentMonths,
  massivaHistoryLimitForRange,
  resolveMassivaPeriod,
  toMonthValue,
  type MassivaPeriodPreset,
} from '@/features/massiva/lib/massivaPeriod'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { env } from '@/shared/config/env'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { ChevronLeft, Download, RefreshCw } from 'lucide-react'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { MassivaTicketCard } from '@/features/massiva/ui/MassivaTicketCard'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/** Texto de encerramento não pode ser vazio; mínimo curto para não bloquear descrições objetivas. */
const CLOSE_DESCRIPTION_MIN_LEN = 3
const MASSIVA_TICKETS_SECTION_UI_STATE_PREFIX = 'nexaview.massiva.tickets.ui'

function ticketKey(t: MassivaTicket, index: number): string {
  return `${t.protocol}-${t.assignmentId ?? 'x'}-${index}`
}

type ImpactRange = 'all' | 'none' | 'low' | 'medium' | 'high'
type MassivaListScope = 'abertas' | 'encerradas' | 'todas'
type PeriodPreset = MassivaPeriodPreset
type ChartMetric = 'afetados' | 'protocolos'
type MassivaRecordTypeFilter = 'all' | 'incidente' | 'evento'
type MassivaCatalogFilter = 'all' | 'catalogo_esperado' | 'fora_catalogo'
const MASSIVA_PAGE_SIZE = 30

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function formatHoursLabel(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—'
  if (hours < 24) return `${hours.toFixed(1)}h`
  const days = hours / 24
  return `${days.toFixed(1)}d`
}

/** Badge de variação vs. período anterior. Para massivas, alta = ruim (vermelho). */
function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const rounded = Math.round(delta)
  const tone =
    rounded === 0
      ? 'bg-neutral-100 text-neutral-600'
      : rounded > 0
        ? 'bg-rose-100 text-rose-700'
        : 'bg-emerald-100 text-emerald-700'
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '•'
  const sign = rounded > 0 ? '+' : ''
  return (
    <span
      title="vs. período anterior de mesmo tamanho"
      className={`ml-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tone}`}
    >
      {arrow} {sign}{rounded}%
    </span>
  )
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

function matchesMassivaCatalogFilter(
  ticket: MassivaTicket,
  catalogFilter: MassivaCatalogFilter,
): boolean {
  if (catalogFilter === 'fora_catalogo') {
    return isMassivaMonitoringOutOfCatalogTitle(ticket.title)
  }
  if (catalogFilter === 'catalogo_esperado') {
    return isExpectedMassivaCatalogTitle(ticket.title)
  }
  return isMassivaStandardFlowCatalogTitle(ticket.title)
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
    'titulo_catalogo_nv',
    'catalogo_nv_esperado',
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
    row.title.trim(),
    isExpectedMassivaCatalogTitle(row.title) ? 'SIM' : 'NAO',
    formatMassivaListDateDisplay(row.openedAt),
    formatPrevisaoEncerramentoDisplay(
      row.expectedCloseAt,
      row.estimateTimeOfRestoration,
      row.openedAt,
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
  /** embedded: sem borda dupla; cabecalho da lista fica no painel pai; rolagem vertical = pagina (so overflow-x na tabela se necessario). */
  layout?: MassivaTicketsSectionLayout
}
function massivaTicketsUiStateKey(layout: MassivaTicketsSectionLayout): string {
  return `${MASSIVA_TICKETS_SECTION_UI_STATE_PREFIX}.${layout}.v1`
}
const PERIOD_PRESETS: readonly PeriodPreset[] = ['7d', '30d', '90d', '6m', '12m', 'month']

function readMassivaTicketsUiState(layout: MassivaTicketsSectionLayout): {
  query: string
  scope: MassivaListScope
  periodPreset: PeriodPreset
  selectedMonth: string
  chartMetric: ChartMetric
  impactRange: ImpactRange
  recordTypeFilter: MassivaRecordTypeFilter
  catalogFilter: MassivaCatalogFilter
  visibleCount: number
} {
  const initialState = {
    query: '',
    scope: 'abertas' as MassivaListScope,
    periodPreset: '30d' as PeriodPreset,
    selectedMonth: toMonthValue(new Date()),
    chartMetric: 'afetados' as ChartMetric,
    impactRange: 'all' as ImpactRange,
    recordTypeFilter: 'all' as MassivaRecordTypeFilter,
    catalogFilter: 'all' as MassivaCatalogFilter,
    visibleCount: MASSIVA_PAGE_SIZE,
  }
  if (typeof window === 'undefined') return initialState
  try {
    const raw = window.sessionStorage.getItem(massivaTicketsUiStateKey(layout))
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Partial<typeof initialState>
    return {
      query: typeof parsed.query === 'string' ? parsed.query : initialState.query,
      scope:
        parsed.scope === 'encerradas' || parsed.scope === 'todas'
          ? parsed.scope
          : initialState.scope,
      periodPreset:
        typeof parsed.periodPreset === 'string' &&
        PERIOD_PRESETS.includes(parsed.periodPreset as PeriodPreset)
          ? (parsed.periodPreset as PeriodPreset)
          : initialState.periodPreset,
      selectedMonth:
        typeof parsed.selectedMonth === 'string' && /^\d{4}-\d{2}$/.test(parsed.selectedMonth)
          ? parsed.selectedMonth
          : initialState.selectedMonth,
      chartMetric:
        parsed.chartMetric === 'protocolos' ? 'protocolos' : initialState.chartMetric,
      impactRange:
        parsed.impactRange === 'none' ||
        parsed.impactRange === 'low' ||
        parsed.impactRange === 'medium' ||
        parsed.impactRange === 'high'
          ? parsed.impactRange
          : initialState.impactRange,
      recordTypeFilter:
        parsed.recordTypeFilter === 'incidente' || parsed.recordTypeFilter === 'evento'
          ? parsed.recordTypeFilter
          : initialState.recordTypeFilter,
      catalogFilter:
        parsed.catalogFilter === 'catalogo_esperado' || parsed.catalogFilter === 'fora_catalogo'
          ? parsed.catalogFilter
          : initialState.catalogFilter,
      visibleCount:
        typeof parsed.visibleCount === 'number' && parsed.visibleCount >= MASSIVA_PAGE_SIZE
          ? Math.trunc(parsed.visibleCount)
          : initialState.visibleCount,
    }
  } catch {
    return initialState
  }
}

export function MassivaTicketsSection({
  layout = 'default',
}: MassivaTicketsSectionProps) {
  const embedded = layout === 'embedded'
  const [uiState, setUiState] = useState(() => readMassivaTicketsUiState(layout))
  const {
    query,
    scope,
    periodPreset,
    selectedMonth,
    chartMetric,
    impactRange,
    recordTypeFilter,
    catalogFilter,
    visibleCount,
  } = uiState
  const monthOptions = useMemo(() => listRecentMonths(new Date(), 12), [])
  const { view, refetch: refetchBffList, isRefreshing } = useMassivaTickets({
    refetchIntervalMs: catalogFilter === 'fora_catalogo' ? 90_000 : undefined,
  })
  const queryClient = useQueryClient()
  const didRestoreVisibleCountRef = useRef(false)
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

  // Autor do encerramento: usuário logado (nome ou e-mail) registrado no histórico local.
  const authUser = useAccessAuthStore((s) => s.user)
  const authProfile = useAccessAuthStore((s) => s.profile)
  const closedByLabel = (
    authProfile?.displayName ??
    authUser?.displayName ??
    authUser?.email ??
    ''
  ).trim()

  const [closeLocalWarning, setCloseLocalWarning] = useState<string | null>(null)

  const closeMutation = useMutation({
    mutationFn: closeMassivaTicket,
    onSuccess: async (result, variables) => {
      setClosingProtocol(null)
      setCloseDescription('')
      setCloseLocalWarning(result?.localHistoryWarning ?? null)
      if (variables.protocol > 0) {
        removeRecentOpenTicketFromStorage(variables.protocol)
        void queryClient.invalidateQueries({ queryKey: massivaKeys.recentOpens() })
      }
      await queryClient.invalidateQueries({ queryKey: massivaKeys.list() })
      await queryClient.invalidateQueries({ queryKey: massivaKeys.all })
      await queryClient.invalidateQueries({ queryKey: splittersKeys.all })
      void historyQuery.refetch()
    },
  })

  const range = useMemo(
    () => resolveMassivaPeriod(periodPreset, selectedMonth),
    [periodPreset, selectedMonth],
  )
  const periodStart = range.start
  const periodEnd = range.end
  const periodDays = range.spanDays
  const historyListStart = range.fetchStart
  const historyListLimit = massivaHistoryLimitForRange(range)
  /** Aba Abertas usa janela rolante a partir de hoje; no modo mês, estende para alcançar o mês escolhido. */
  const abertasPeriodDays = useMemo(() => {
    if (periodPreset !== 'month') return periodDays
    const fromMonthStart = Math.ceil(
      (Date.now() - periodStart.getTime()) / (24 * 60 * 60 * 1000),
    )
    return Math.max(periodDays, fromMonthStart)
  }, [periodPreset, periodDays, periodStart])

  const historyQuery = useQuery({
    queryKey: massivaKeys.historyList(
      'all',
      historyListStart.toISOString(),
      'merge',
      historyListLimit,
    ),
    queryFn: () =>
      fetchMassivaHistoryListFromLocalDb({
        status: null,
        startDate: historyListStart,
        limit: historyListLimit,
      }),
    staleTime: 60_000,
    refetchOnMount: 'always',
  })

  const { data: recentOpenTickets = [] } = useQuery({
    queryKey: massivaKeys.recentOpens(),
    queryFn: () => readRecentOpenTicketsFromStorage(),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const tickets = useMemo<MassivaTicket[]>(() => {
    const fromBff = view.status === 'success' ? view.tickets : []
    return buildDashboardMassivaTickets({
      bffTickets: fromBff,
      localRows: historyQuery.data ?? [],
      recentOpenTickets,
      periodStart: historyListStart,
    })
  }, [view, historyQuery.data, recentOpenTickets, historyListStart])

  const recentProtocolSet = useMemo(() => {
    const set = new Set<number>()
    for (const ticket of recentOpenTickets) {
      if (ticket.protocol > 0) set.add(ticket.protocol)
    }
    return set
  }, [recentOpenTickets])

  useEffect(() => {
    if (view.status !== 'success') return
    pruneRecentOpensClosedByBff(view.tickets, historyQuery.data ?? [])
    void queryClient.invalidateQueries({ queryKey: massivaKeys.recentOpens() })
  }, [
    view.status,
    view.status === 'success' ? view.tickets : null,
    historyQuery.data,
    queryClient,
  ])

  // Encerramento de massiva é SOMENTE manual (ação do usuário). Não há mais
  // reconciliação automática que grave fechamento local a partir do Elleven/BFF.

  const refreshDashboard = () => {
    refetchBffList()
    void queryClient.invalidateQueries({ queryKey: massivaKeys.recentOpens() })
    void historyQuery.refetch()
  }

  const scopedTickets = useMemo(() => {
    const monitorOutOfCatalog = catalogFilter === 'fora_catalogo'
    return tickets.filter((ticket) => {
      if (scope === 'abertas') {
        return monitorOutOfCatalog
          ? isMassivaOpenForPanelList(ticket, recentProtocolSet)
          : isMassivaOpenForGlobalDashboard(ticket, recentProtocolSet)
      }
      if (scope === 'encerradas') {
        return monitorOutOfCatalog
          ? isMassivaClosedForPanelList(ticket, recentProtocolSet)
          : isMassivaClosedForCounts(ticket, recentProtocolSet)
      }
      return true
    })
  }, [tickets, scope, catalogFilter, recentProtocolSet])

  const ticketsInPeriod = useMemo(() => {
    const s = periodStart.getTime()
    const e = periodEnd.getTime()
    return tickets.filter((ticket) => {
      const t = ticket.openedAt?.getTime()
      return t != null && t >= s && t <= e
    })
  }, [tickets, periodStart, periodEnd])

  const metricsTicketsInPeriod = useMemo(() => {
    return ticketsInPeriod
      .filter((ticket) => matchesRecordType(ticket, recordTypeFilter))
      .filter((ticket) => matchesMassivaCatalogFilter(ticket, catalogFilter))
  }, [ticketsInPeriod, recordTypeFilter, catalogFilter])

  const kpiTicketsInPeriod = useMemo(() => {
    return metricsTicketsInPeriod.filter((ticket) =>
      isMassivaEligibleForDashboardCounts(ticket, recentProtocolSet),
    )
  }, [metricsTicketsInPeriod, recentProtocolSet])

  /** KPIs e médias seguem a aba Abertas / Encerradas / Todas (antes era sempre o período inteiro). */
  const kpiTicketsForScope = useMemo(() => {
    return kpiTicketsInPeriod.filter((ticket) => {
      if (scope === 'abertas') {
        return catalogFilter === 'fora_catalogo'
          ? isMassivaOpenForPanelList(ticket, recentProtocolSet)
          : isMassivaOpenForGlobalDashboard(ticket, recentProtocolSet)
      }
      if (scope === 'encerradas') {
        return isMassivaClosedForCounts(ticket, recentProtocolSet)
      }
      return true
    })
  }, [kpiTicketsInPeriod, scope, catalogFilter, recentProtocolSet])

  const scopedTicketsInWindow = useMemo(() => {
    const s = periodStart.getTime()
    const e = periodEnd.getTime()
    return scopedTickets.filter((ticket) => {
      const t = ticket.openedAt?.getTime()
      return t != null && t >= s && t <= e
    })
  }, [scopedTickets, periodStart, periodEnd])

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

  const catalogScopedTicketsInWindow = useMemo(
    () => typeScopedTicketsInWindow.filter((ticket) =>
      matchesMassivaCatalogFilter(ticket, catalogFilter),
    ),
    [typeScopedTicketsInWindow, catalogFilter],
  )

  const panelAbertasListInput = useMemo(
    () => ({
      bffTickets: view.status === 'success' ? view.tickets : [],
      localRows: historyQuery.data ?? [],
      recentOpenTickets,
    }),
    [view, historyQuery.data, recentOpenTickets],
  )

  const filteredTickets = useMemo(() => {
    if (scope === 'abertas') {
      const s = periodStart.getTime()
      const e = periodEnd.getTime()
      return collectMassivaPanelAbertasTickets(panelAbertasListInput, {
        periodDays: abertasPeriodDays,
        catalogFilter,
        recordTypeFilter,
        impactRange,
        query,
      }).filter((t) => {
        const ts = t.openedAt?.getTime()
        return ts != null && ts >= s && ts <= e
      })
    }
    const text = normalizeText(query)
    return catalogScopedTicketsInWindow.filter((ticket) => {
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
  }, [
    scope,
    panelAbertasListInput,
    abertasPeriodDays,
    periodStart,
    periodEnd,
    catalogFilter,
    recordTypeFilter,
    impactRange,
    query,
    catalogScopedTicketsInWindow,
  ])

  const chartSourceTickets = useMemo(() => {
    if (scope !== 'abertas') return catalogScopedTicketsInWindow
    const s = periodStart.getTime()
    const e = periodEnd.getTime()
    return collectMassivaPanelAbertasTickets(panelAbertasListInput, {
      periodDays: abertasPeriodDays,
      catalogFilter,
      recordTypeFilter,
      impactRange: 'all',
      query: '',
    }).filter((t) => {
      const ts = t.openedAt?.getTime()
      return ts != null && ts >= s && ts <= e
    })
  }, [
    scope,
    panelAbertasListInput,
    abertasPeriodDays,
    periodStart,
    periodEnd,
    catalogFilter,
    recordTypeFilter,
    catalogScopedTicketsInWindow,
  ])

  const chartSeries = useMemo(
    () =>
      buildMassivaChartSeries(chartSourceTickets, {
        granularity: range.bucket,
        start: periodStart,
        end: periodEnd,
        recentProtocols: recentProtocolSet,
      }),
    [chartSourceTickets, range.bucket, periodStart, periodEnd, recentProtocolSet],
  )

  const chartTotalAffected = useMemo(
    () => chartSeries.reduce((sum, day) => sum + day.affectedTotal, 0),
    [chartSeries],
  )
  const chartTotalProtocols = useMemo(
    () => chartSeries.reduce((sum, day) => sum + day.protocols, 0),
    [chartSeries],
  )
  const chartHasOtherType = useMemo(
    () => chartSeries.some((day) => day.affectedOther > 0),
    [chartSeries],
  )
  const bucketLabel = range.bucket === 'month' ? 'mês' : range.bucket === 'week' ? 'semana' : 'dia'

  /** Recorrência: pontos de acesso com mais protocolos no período/escopo. */
  const topAccessPoints = useMemo(
    () => rankMassivaAccessPoints(chartSourceTickets, 5),
    [chartSourceTickets],
  )

  /** Janela imediatamente anterior (mesmo tamanho) — base de comparação de tendência. */
  const previousScopedTickets = useMemo(() => {
    const ps = range.previousStart.getTime()
    const pe = range.previousEnd.getTime()
    return scopedTickets.filter((ticket) => {
      const t = ticket.openedAt?.getTime()
      return t != null && t >= ps && t <= pe
    })
  }, [scopedTickets, range.previousStart, range.previousEnd])
  const periodKpis = useMemo(() => {
    const periodCounts = summarizeMassivaPeriodCounts(kpiTicketsForScope, {
      recentProtocols: recentProtocolSet,
    })
    const openNow = periodCounts.openCount
    const closedNow = periodCounts.closedCount
    const totalProtocols = periodCounts.totalProtocols
    const affectedInPeriod = kpiTicketsForScope.reduce(
      (sum, ticket) => sum + Math.max(0, ticket.affectedClients),
      0,
    )
    const affectedAvg =
      totalProtocols > 0 ? affectedInPeriod / totalProtocols : 0
    const topDay = chartSeries.reduce<{ label: string; value: number } | null>(
      (max, day) => {
        if (!max || day.affectedTotal > max.value) {
          return { label: day.label, value: day.affectedTotal }
        }
        return max
      },
      null,
    )
    const closedWithCycle = kpiTicketsForScope.filter(
      (t) => isMassivaClosedForCounts(t) && t.openedAt && t.closedAt,
    )
    const avgClosureHours =
      closedWithCycle.length > 0
        ? closedWithCycle.reduce((sum, t) => {
          const cycleHours = ((t.closedAt as Date).getTime() - (t.openedAt as Date).getTime()) / (1000 * 60 * 60)
          return sum + Math.max(0, cycleHours)
        }, 0) / closedWithCycle.length
        : null

    const sla = summarizeMassivaSla(kpiTicketsForScope)

    const prevCounts = summarizeMassivaPeriodCounts(previousScopedTickets, {
      recentProtocols: recentProtocolSet,
    })
    const prevAffected = previousScopedTickets.reduce(
      (sum, ticket) => sum + Math.max(0, ticket.affectedClients),
      0,
    )

    return {
      openNow,
      closedNow,
      totalProtocols,
      affectedInPeriod,
      affectedAvg,
      topDay,
      avgClosureHours,
      sla,
      totalProtocolsDelta: percentChange(totalProtocols, prevCounts.totalProtocols),
      affectedDelta: percentChange(affectedInPeriod, prevAffected),
      previousTotalProtocols: prevCounts.totalProtocols,
    }
  }, [kpiTicketsForScope, chartSeries, recentProtocolSet, previousScopedTickets])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      massivaTicketsUiStateKey(layout),
      JSON.stringify(uiState),
    )
  }, [layout, uiState])

  useEffect(() => {
    if (!didRestoreVisibleCountRef.current) {
      didRestoreVisibleCountRef.current = true
      return
    }
    setUiState((prev) => ({ ...prev, visibleCount: MASSIVA_PAGE_SIZE }))
  }, [scope, periodPreset, selectedMonth, query, impactRange, recordTypeFilter, catalogFilter])

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
          onRetry={() => refreshDashboard()}
        />
      </div>
    )
  }

  if (
    view.status === 'success' &&
    tickets.length === 0 &&
    !historyQuery.isPending &&
    !historyQuery.isFetching
  ) {
    return (
      <div className={embedded ? 'p-4' : ''}>
        <EmptyState
          title="Nenhuma massiva"
          description="Não há protocolos no período com os filtros atuais. Tente a aba Todas, amplie o período (90d) ou clique em Atualizar."
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
              ? 'grid grid-cols-1 items-center gap-2 sm:grid-cols-2'
              : 'grid items-center gap-3 md:grid-cols-4'
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
                onClick={() => setUiState((prev) => ({ ...prev, scope: opt.id }))}
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
            onChange={(e) => setUiState((prev) => ({ ...prev, query: e.target.value }))}
            placeholder="Pesquisar…"
            className={`rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition placeholder:text-neutral-400 focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15 ${embedded ? 'sm:col-span-2' : 'md:col-span-2'}`}
          />
          <div className="flex min-h-10 items-center gap-1 rounded-xl border border-neutral-200/90 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {periodPreset === 'month' ? (
              <>
                <button
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, periodPreset: '30d' }))}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                  aria-label="Voltar aos períodos rápidos"
                  title="Voltar aos períodos"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <select
                  value={selectedMonth}
                  onChange={(e) => setUiState((prev) => ({ ...prev, selectedMonth: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-800 focus:border-neutral-400 focus:outline-none"
                  aria-label="Selecionar mês"
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </>
            ) : (
              ([
                { id: '7d', label: '7d' },
                { id: '30d', label: '30d' },
                { id: '90d', label: '90d' },
                { id: '6m', label: '6m' },
                { id: '12m', label: '12m' },
                { id: 'month', label: 'Mês' },
              ] as Array<{ id: PeriodPreset; label: string }>).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, periodPreset: opt.id }))}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                    periodPreset === opt.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
          <select
            value={impactRange}
            onChange={(e) => setUiState((prev) => ({ ...prev, impactRange: e.target.value as ImpactRange }))}
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
            onChange={(e) => setUiState((prev) => ({ ...prev, recordTypeFilter: e.target.value as MassivaRecordTypeFilter }))}
            className="rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
          >
            <option value="all">Tipo: todos</option>
            <option value="incidente">Tipo: incidente massivo</option>
            <option value="evento">Tipo: evento massivo</option>
          </select>
          <select
            value={catalogFilter}
            onChange={(e) =>
              setUiState((prev) => ({
                ...prev,
                catalogFilter: e.target.value as MassivaCatalogFilter,
              }))}
            className={`rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15 ${embedded ? 'sm:col-span-2' : ''}`}
          >
            <option value="all">Catálogo: fluxo padrão</option>
            <option value="catalogo_esperado">Catálogo: só esperados</option>
            <option value="fora_catalogo">Catálogo: fora do padrão (monitorar)</option>
          </select>
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? 'mt-2' : 'mt-3'}`}>
          <button
            type="button"
            onClick={() => refreshDashboard()}
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
            {filteredTickets.length}/{kpiTicketsForScope.length} no período
            {scope === 'todas' && metricsTicketsInPeriod.length > kpiTicketsInPeriod.length
              ? ` (${metricsTicketsInPeriod.length} com filtros de tipo/catálogo)`
              : ''}
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
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              {scope === 'abertas'
                ? 'Protocolos abertos no período'
                : scope === 'encerradas'
                  ? 'Protocolos encerrados no período'
                  : 'Protocolos no período'}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">
              {periodKpis.totalProtocols.toLocaleString('pt-BR')}
              <DeltaBadge delta={periodKpis.totalProtocolsDelta} />
            </p>
          </div>
          {scope === 'todas' ? (
            <>
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
            </>
          ) : null}
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Afetados no período</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-rose-800">
              {periodKpis.affectedInPeriod.toLocaleString('pt-BR')}
              <DeltaBadge delta={periodKpis.affectedDelta} />
            </p>
          </div>
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Média afetados/protocolo</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-rose-800">
              {periodKpis.affectedAvg.toFixed(1)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Dentro da previsão (SLA)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-800">
              {periodKpis.sla.pct === null ? '—' : `${Math.round(periodKpis.sla.pct)}%`}
            </p>
            <p className="text-[10px] text-emerald-700/70">
              {periodKpis.sla.within}/{periodKpis.sla.evaluated} encerradas
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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-neutral-800">
              Total por {bucketLabel} ({chartMetric === 'afetados' ? 'afetados' : 'protocolos'}) — massivas{' '}
              {scope === 'todas' ? 'selecionadas' : scope}
            </p>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-200/90 bg-white p-0.5">
              {([
                { id: 'afetados', label: 'Afetados' },
                { id: 'protocolos', label: 'Protocolos' },
              ] as Array<{ id: ChartMetric; label: string }>).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, chartMetric: opt.id }))}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                    chartMetric === opt.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-2 text-[11px] text-neutral-500">
            {chartMetric === 'afetados' ? 'Total afetados' : 'Total protocolos'}:{' '}
            <span className="font-bold text-neutral-800">
              {(chartMetric === 'afetados' ? chartTotalAffected : chartTotalProtocols).toLocaleString('pt-BR')}
            </span>
            {periodKpis.topDay && chartMetric === 'afetados' ? (
              <>
                {' · '}Pico por {bucketLabel}:{' '}
                <span className="font-semibold text-neutral-700">{periodKpis.topDay.label}</span>{' '}
                ({periodKpis.topDay.value.toLocaleString('pt-BR')})
              </>
            ) : null}
          </p>
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
                  <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, borderColor: '#e5e7eb' }}
                    formatter={(value: unknown, name: unknown) => [
                      Number(value ?? 0).toLocaleString('pt-BR'),
                      String(name ?? ''),
                    ]}
                  />
                  {chartMetric === 'afetados' ? (
                    <>
                      <Bar stackId="afetados" dataKey="affectedIncident" name="Afetados (incidente)" fill="#fb7185" radius={[0, 0, 0, 0]} />
                      <Bar stackId="afetados" dataKey="affectedEvent" name="Afetados (evento)" fill="#38bdf8" radius={[0, 0, 0, 0]} />
                      {chartHasOtherType ? (
                        <Bar stackId="afetados" dataKey="affectedOther" name="Afetados (outros)" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      ) : null}
                    </>
                  ) : (
                    <Bar dataKey="protocols" name="Protocolos" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {topAccessPoints.length > 0 ? (
            <div className="mt-3 border-t border-neutral-100 pt-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Pontos de acesso recorrentes no período
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {topAccessPoints.map((ap) => (
                  <li
                    key={ap.apCode}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50 px-2 py-1 text-[11px]"
                    title={`${ap.affected.toLocaleString('pt-BR')} afetados`}
                  >
                    <span className="font-semibold text-neutral-800">{ap.apCode}</span>
                    <span className="rounded-full bg-amber-100 px-1.5 font-bold text-amber-800">
                      {ap.protocols}×
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                    setCloseLocalWarning(null)
                  }}
                />
              </li>
              ))}
            </ul>
            {visibleTickets.length < filteredTickets.length ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, visibleCount: prev.visibleCount + MASSIVA_PAGE_SIZE }))}
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
                {closeLocalWarning !== null ? (
                  <p className="text-xs text-amber-700">
                    ⚠️ {closeLocalWarning}
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
                  setCloseLocalWarning(null)
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
                    closedBy: closedByLabel,
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


