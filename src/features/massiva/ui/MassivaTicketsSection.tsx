import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { closeMassivaTicket } from '@/features/massiva/api/closeMassivaTicket'
import { cancelMassivaTicket } from '@/features/massiva/api/cancelMassivaTicket'
import { updateMassivaClassification } from '@/features/massiva/api/updateMassivaClassification'
import { MassivaClassificationFields } from '@/features/massiva/ui/MassivaClassificationFields'
import {
  MASSIVA_CLASSIFICATION_RESET,
  type MassivaClassificationDraft,
} from '@/features/massiva/model/massivaClassificationOptions'
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
  isMassivaCancelledForCounts,
  isMassivaCancelledForPanelList,
  isMassivaClosedForCounts,
  isMassivaClosedForPanelList,
  isMassivaOpenForGlobalDashboard,
  isMassivaOpenForPanelList,
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
import { ChevronDown, ChevronLeft, Download, RefreshCw } from 'lucide-react'
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
type MassivaListScope = 'abertas' | 'encerradas' | 'canceladas' | 'todas'
type PeriodPreset = MassivaPeriodPreset
type ChartMetric = 'afetados' | 'protocolos'
type MassivaRecordTypeFilter = 'all' | 'incidente' | 'evento'
type MassivaCatalogFilter = 'all' | 'catalogo_esperado' | 'fora_catalogo'
const MASSIVA_PAGE_SIZE = 30

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

/** Formata o tempo restante (ou vencido) em relação a um prazo de SLA. */
function formatSlaRisk(expectedCloseAt: Date): string {
  const diffMs = expectedCloseAt.getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 0) {
    const abs = Math.abs(diffMin)
    if (abs < 60) return `venceu há ${abs}min`
    const h = Math.floor(abs / 60)
    const m = abs % 60
    return m > 0 ? `venceu há ${h}h ${m}min` : `venceu há ${h}h`
  }
  if (diffMin < 60) return `vence em ${diffMin}min`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return m > 0 ? `vence em ${h}h ${m}min` : `vence em ${h}h`
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

type HistoryClassifEntry = {
  tipoIncidente: string | null
  impacto: string | null
  area: string | null
  tecnologia: string | null
  classificacao: string | null
  cnl: string | null
  mttdMinutes: number | null
  mttrMinutes: number | null
  classificationUpdatedBy: string | null
  classificationUpdatedAt: Date | null
  affectedVerificationCheckedAt: Date | null
  affectedVerificationTotal: number | null
  affectedVerificationStillOffline: number | null
  affectedVerificationStillDegraded: number | null
  affectedVerificationBy: string | null
}

function buildMassivasCsv(
  rows: MassivaTicket[],
  classifLookup?: Map<number, HistoryClassifEntry>,
): string {
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
    'tipo_incidente',
    'impacto',
    'area',
    'tecnologia',
    'classificacao',
    'cnl',
    'mttd_minutos',
    'mttr_minutos',
    'descricao',
  ]
  const lines = rows.map((row) => {
    const classif = classifLookup?.get(row.protocol) ?? null
    return [
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
      String(classif?.tipoIncidente ?? ''),
      String(classif?.impacto ?? ''),
      String(classif?.area ?? ''),
      String(classif?.tecnologia ?? ''),
      String(classif?.classificacao ?? ''),
      String(classif?.cnl ?? ''),
      classif?.mttdMinutes != null ? String(classif.mttdMinutes) : '',
      classif?.mttrMinutes != null ? String(classif.mttrMinutes) : '',
      row.description.trim() || row.title,
    ].map(escapeCsvCell).join(',')
  })
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
  classifTipoFilter: string
  classifImpactoFilter: string
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
    classifTipoFilter: '',
    classifImpactoFilter: '',
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
        parsed.scope === 'encerradas' ||
        parsed.scope === 'canceladas' ||
        parsed.scope === 'todas'
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
      classifTipoFilter:
        typeof parsed.classifTipoFilter === 'string' ? parsed.classifTipoFilter : '',
      classifImpactoFilter:
        typeof parsed.classifImpactoFilter === 'string' ? parsed.classifImpactoFilter : '',
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
    classifTipoFilter,
    classifImpactoFilter,
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

  const [closeClassif, setCloseClassif] = useState({ ...MASSIVA_CLASSIFICATION_RESET })

  const closeMutation = useMutation({
    mutationFn: closeMassivaTicket,
    onSuccess: async (result, variables) => {
      setClosingProtocol(null)
      setCloseDescription('')
      setCloseClassif({ ...MASSIVA_CLASSIFICATION_RESET })
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

  const [cancellingProtocol, setCancellingProtocol] = useState<number | null>(null)
  const [cancelDescription, setCancelDescription] = useState('')
  const [cancelLocalWarning, setCancelLocalWarning] = useState<string | null>(null)
  const selectedCancellingTicket = useMemo(
    () => view.status === 'success'
      ? view.tickets.find((t) => t.protocol === cancellingProtocol) ?? null
      : null,
    [view, cancellingProtocol],
  )

  const cancelMutation = useMutation({
    mutationFn: cancelMassivaTicket,
    onSuccess: async (result, variables) => {
      setCancellingProtocol(null)
      setCancelDescription('')
      setCancelLocalWarning(result?.localHistoryWarning ?? null)
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

  // Manutenção pós-encerramento: reclassifica um protocolo já encerrado, sem tocar na
  // Voalle e sem alterar quem/quando encerrou. Só disponível na aba Encerradas.
  const [maintenanceProtocol, setMaintenanceProtocol] = useState<number | null>(null)
  const [maintenanceClassif, setMaintenanceClassif] = useState<MassivaClassificationDraft>({
    ...MASSIVA_CLASSIFICATION_RESET,
  })
  const selectedMaintenanceTicket = useMemo(
    () => view.status === 'success'
      ? view.tickets.find((t) => t.protocol === maintenanceProtocol) ?? null
      : null,
    [view, maintenanceProtocol],
  )

  const maintenanceMutation = useMutation({
    mutationFn: updateMassivaClassification,
    onSuccess: async () => {
      setMaintenanceProtocol(null)
      setMaintenanceClassif({ ...MASSIVA_CLASSIFICATION_RESET })
      await queryClient.invalidateQueries({ queryKey: massivaKeys.all })
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
      if (scope === 'canceladas') {
        return monitorOutOfCatalog
          ? isMassivaCancelledForPanelList(ticket, recentProtocolSet)
          : isMassivaCancelledForCounts(ticket, recentProtocolSet)
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


  /**
   * Lookup rápido: protocol → dados de classificação + MTTD/MTTR do histórico local.
   * Usado para enriquecer o CSV e os gráficos de distribuição.
   */
  const historyClassificationByProtocol = useMemo(() => {
    const map = new Map<number, HistoryClassifEntry>()
    for (const row of historyQuery.data ?? []) {
      if (row.protocol != null && row.protocol > 0) {
        map.set(row.protocol, {
          tipoIncidente: row.tipoIncidente,
          impacto: row.impacto,
          area: row.area,
          tecnologia: row.tecnologia,
          classificacao: row.classificacao,
          cnl: row.cnl,
          mttdMinutes: row.mttdMinutes,
          mttrMinutes: row.mttrMinutes,
          classificationUpdatedBy: row.classificationUpdatedBy,
          classificationUpdatedAt: row.classificationUpdatedAt,
          affectedVerificationCheckedAt: row.affectedVerificationCheckedAt,
          affectedVerificationTotal: row.affectedVerificationTotal,
          affectedVerificationStillOffline: row.affectedVerificationStillOffline,
          affectedVerificationStillDegraded: row.affectedVerificationStillDegraded,
          affectedVerificationBy: row.affectedVerificationBy,
        })
      }
    }
    return map
  }, [historyQuery.data])

  /**
   * Opções disponíveis para os filtros de classificação — derivadas dos dados reais
   * do historyQuery no período. Só exibe opções que existam na data selecionada.
   */
  const classifOptions = useMemo(() => {
    const s = periodStart.getTime()
    const e = periodEnd.getTime()
    const tipos = new Set<string>()
    const impactos = new Set<string>()
    for (const r of historyQuery.data ?? []) {
      const t = r.openedAt?.getTime()
      if (t == null || t < s || t > e) continue
      if (r.tipoIncidente) tipos.add(r.tipoIncidente)
      if (r.impacto) impactos.add(r.impacto)
    }
    return {
      tipos: [...tipos].sort(),
      impactos: [...impactos].sort(),
    }
  }, [historyQuery.data, periodStart, periodEnd])

  /**
   * Lista final de tickets após aplicar o filtro de classificação.
   * Quando algum filtro de classificação está ativo, mantém apenas tickets cujo
   * protocolo consta no histórico com a classificação correspondente.
   * Tickets sem protocolo (protocol <= 0) são excluídos quando o filtro está ativo.
   */
  const classifFilteredTickets = useMemo(() => {
    if (classifTipoFilter === '' && classifImpactoFilter === '') return filteredTickets
    const matchingProtocols = new Set<number>()
    for (const row of historyQuery.data ?? []) {
      if (row.protocol == null || row.protocol <= 0) continue
      const tipoMatch = classifTipoFilter === '' || row.tipoIncidente === classifTipoFilter
      const impactoMatch = classifImpactoFilter === '' || row.impacto === classifImpactoFilter
      if (tipoMatch && impactoMatch) matchingProtocols.add(row.protocol)
    }
    return filteredTickets.filter((t) => t.protocol > 0 && matchingProtocols.has(t.protocol))
  }, [filteredTickets, classifTipoFilter, classifImpactoFilter, historyQuery.data])

  /**
   * Tickets abertos em risco de SLA: já vencidos ou com menos de 2h para o prazo.
   * Ordenados do mais urgente para o menos urgente.
   */
  const SLA_RISK_WARNING_MS = 2 * 60 * 60 * 1_000
  const slaAtRiskTickets = useMemo(() => {
    if (scope !== 'abertas') return []
    const now = Date.now()
    return classifFilteredTickets
      .filter((t) => {
        if (!t.expectedCloseAt) return false
        return t.expectedCloseAt.getTime() <= now + SLA_RISK_WARNING_MS
      })
      .sort((a, b) => a.expectedCloseAt!.getTime() - b.expectedCloseAt!.getTime())
      .slice(0, 10)
  }, [scope, classifFilteredTickets])

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
  }, [scope, periodPreset, selectedMonth, query, impactRange, recordTypeFilter, catalogFilter, classifTipoFilter, classifImpactoFilter])

  const visibleTickets = useMemo(
    () => classifFilteredTickets.slice(0, visibleCount),
    [classifFilteredTickets, visibleCount],
  )

  const handleExportCsv = async () => {
    const csv = buildMassivasCsv(classifFilteredTickets, historyClassificationByProtocol)
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
              { id: 'canceladas', label: 'Canceladas' },
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
          {/* Filtros de classificação — só aparecem quando existem dados no período */}
          {classifOptions.tipos.length > 0 ? (
            <select
              value={classifTipoFilter}
              onChange={(e) =>
                setUiState((prev) => ({ ...prev, classifTipoFilter: e.target.value }))}
              className={`rounded-xl border bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:outline-none focus:ring-2 focus:ring-sky-500/15 ${classifTipoFilter !== '' ? 'border-sky-400 focus:border-sky-500' : 'border-neutral-200/90 focus:border-sky-500/80'}`}
            >
              <option value="">Tipo incidente: todos</option>
              {classifOptions.tipos.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : null}
          {classifOptions.impactos.length > 0 ? (
            <select
              value={classifImpactoFilter}
              onChange={(e) =>
                setUiState((prev) => ({ ...prev, classifImpactoFilter: e.target.value }))}
              className={`rounded-xl border bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:outline-none focus:ring-2 focus:ring-sky-500/15 ${classifImpactoFilter !== '' ? 'border-sky-400 focus:border-sky-500' : 'border-neutral-200/90 focus:border-sky-500/80'}`}
            >
              <option value="">Impacto: todos</option>
              {classifOptions.impactos.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          ) : null}
          {/* Botão limpar filtros de classificação — aparece quando algum está ativo */}
          {(classifTipoFilter !== '' || classifImpactoFilter !== '') ? (
            <button
              type="button"
              onClick={() => setUiState((prev) => ({ ...prev, classifTipoFilter: '', classifImpactoFilter: '' }))}
              className="rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100/70"
            >
              ✕ Limpar classificação
            </button>
          ) : null}
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
            {classifFilteredTickets.length}
            {classifFilteredTickets.length !== filteredTickets.length
              ? `/${filteredTickets.length}`
              : ''}{' '}
            no período
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
        {/* Painel de abertas em risco de SLA */}
        {slaAtRiskTickets.length > 0 ? (
          <div className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50/60 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-rose-800">
              ⚠ {slaAtRiskTickets.length} massiva{slaAtRiskTickets.length > 1 ? 's' : ''} em risco de SLA
            </p>
            <div className="space-y-1.5">
              {slaAtRiskTickets.map((t) => {
                const isPast = t.expectedCloseAt != null && t.expectedCloseAt.getTime() < Date.now()
                return (
                  <div
                    key={t.protocol}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-[11px] ${isPast ? 'bg-rose-100/80' : 'bg-amber-50/80'}`}
                  >
                    <span className="font-semibold text-neutral-800">
                      #{t.protocol > 0 ? t.protocol : '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-600">
                      {t.apCode || t.title}
                    </span>
                    <span className={`shrink-0 font-bold ${isPast ? 'text-rose-700' : 'text-amber-700'}`}>
                      {t.expectedCloseAt ? formatSlaRisk(t.expectedCloseAt) : '—'}
                    </span>
                    <span className="shrink-0 text-neutral-400">
                      {t.affectedClients.toLocaleString('pt-BR')} af.
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {classifFilteredTickets.length === 0 ? (
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
                    onRequestCancel={(protocol) => {
                      setCancellingProtocol(protocol)
                      setCancelDescription('')
                      setCancelLocalWarning(null)
                    }}
                    onRequestMaintenance={(protocol) => {
                      const current = historyClassificationByProtocol.get(protocol)
                      setMaintenanceProtocol(protocol)
                      setMaintenanceClassif({
                        tipoIncidente: current?.tipoIncidente ?? '',
                        impacto: current?.impacto ?? '',
                        area: current?.area ?? '',
                        tecnologia: current?.tecnologia ?? '',
                        classificacao: current?.classificacao ?? '',
                        cnl: current?.cnl ?? '',
                      })
                    }}
                    lastAffectedVerification={(() => {
                      const current = historyClassificationByProtocol.get(t.protocol)
                      if (current?.affectedVerificationCheckedAt == null) return null
                      return {
                        checkedAt: current.affectedVerificationCheckedAt,
                        total: current.affectedVerificationTotal ?? 0,
                        stillOffline: current.affectedVerificationStillOffline ?? 0,
                        stillDegraded: current.affectedVerificationStillDegraded ?? 0,
                        verifiedBy: current.affectedVerificationBy,
                      }
                    })()}
                    verifiedByLabel={closedByLabel}
                  />
                </li>
              ))}
            </ul>
            {visibleTickets.length < classifFilteredTickets.length ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setUiState((prev) => ({ ...prev, visibleCount: prev.visibleCount + MASSIVA_PAGE_SIZE }))}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Carregar mais ({visibleTickets.length}/{classifFilteredTickets.length})
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {selectedClosingTicket !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
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

                {/* Classificação do incidente */}
                <div className="border-t border-neutral-100 pt-3">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs font-semibold text-neutral-700">Classificação do incidente</p>
                    <span className="text-[10px] text-neutral-400">Opcional</span>
                  </div>
                  <MassivaClassificationFields
                    idPrefix="close"
                    value={closeClassif}
                    onChange={setCloseClassif}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700"
                onClick={() => {
                  setClosingProtocol(null)
                  setCloseDescription('')
                  setCloseClassif({ ...MASSIVA_CLASSIFICATION_RESET })
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
                    tipoIncidente: closeClassif.tipoIncidente || null,
                    impacto: closeClassif.impacto || null,
                    area: closeClassif.area || null,
                    tecnologia: closeClassif.tecnologia || null,
                    classificacao: closeClassif.classificacao || null,
                    cnl: closeClassif.cnl || null,
                  })
                }}
              >
                {closeMutation.isPending ? 'Encerrando...' : 'Confirmar encerramento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedCancellingTicket !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900">Cancelar protocolo</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Protocolo <span className="font-mono font-semibold">{selectedCancellingTicket.protocol}</span>
              {selectedCancellingTicket.assignmentId !== null
                ? (
                  <>
                    {' e Assignment '}
                    <span className="font-mono font-semibold">{selectedCancellingTicket.assignmentId}</span>
                  </>
                )
                : null}
            </p>
            <p className="mt-2 rounded-lg border border-rose-200/70 bg-rose-50/60 px-3 py-2 text-[11px] leading-snug text-rose-700">
              O cancelamento marca o protocolo como <strong>Cancelado</strong> na Voalle (não é
              encerramento). Use para aberturas equivocadas ou duplicadas.
            </p>

            {selectedCancellingTicket.assignmentId === null ? (
              <p className="mt-3 text-sm text-red-700">
                Não é possível cancelar sem o identificador do atendimento (assignment) neste
                protocolo.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-neutral-700">
                  Motivo do cancelamento
                </label>
                <textarea
                  value={cancelDescription}
                  onChange={(e) => setCancelDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  placeholder="Descreva por que o protocolo está sendo cancelado…"
                />
                <p className="text-[11px] text-neutral-500">
                  Mínimo de {CLOSE_DESCRIPTION_MIN_LEN} caracteres (
                  {cancelDescription.trim().length}/{CLOSE_DESCRIPTION_MIN_LEN}).
                </p>
                {cancelMutation.isError ? (
                  <p className="text-xs text-red-700">
                    {formatQueryError(cancelMutation.error)}
                  </p>
                ) : null}
                {cancelLocalWarning !== null ? (
                  <p className="text-xs text-amber-700">⚠️ {cancelLocalWarning}</p>
                ) : null}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700"
                onClick={() => {
                  setCancellingProtocol(null)
                  setCancelDescription('')
                  setCancelLocalWarning(null)
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                disabled={
                  !closeConfigured ||
                  cancelMutation.isPending ||
                  cancelDescription.trim().length < CLOSE_DESCRIPTION_MIN_LEN ||
                  selectedCancellingTicket.assignmentId === null
                }
                onClick={() => {
                  if (selectedCancellingTicket.assignmentId === null) return
                  void cancelMutation.mutateAsync({
                    assignmentId: selectedCancellingTicket.assignmentId,
                    protocol: selectedCancellingTicket.protocol,
                    cancelDescription: cancelDescription.trim(),
                    cancelledBy: closedByLabel,
                  })
                }}
              >
                {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedMaintenanceTicket !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900">Manutenção — Classificação do incidente</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Protocolo <span className="font-mono font-semibold">{selectedMaintenanceTicket.protocol}</span>
              {selectedMaintenanceTicket.assignmentId !== null
                ? (
                  <>
                    {' e Assignment '}
                    <span className="font-mono font-semibold">{selectedMaintenanceTicket.assignmentId}</span>
                  </>
                )
                : null}
            </p>

            <div className="mt-2 space-y-1 rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-2 text-[11px] text-neutral-600">
              <p>
                Encerrado por{' '}
                <span className="font-semibold text-neutral-800">
                  {selectedMaintenanceTicket.closedBy?.trim() || 'não informado'}
                </span>
                {selectedMaintenanceTicket.closedAt !== null ? (
                  <>
                    {' em '}
                    <span className="font-semibold text-neutral-800">
                      {formatMassivaListDateDisplay(selectedMaintenanceTicket.closedAt)}
                    </span>
                  </>
                ) : null}
                . Esta manutenção <strong>não altera</strong> o motivo, a data nem o autor do
                encerramento.
              </p>
              {(() => {
                const entry = historyClassificationByProtocol.get(selectedMaintenanceTicket.protocol)
                if (entry?.classificationUpdatedBy?.trim()) {
                  return (
                    <p>
                      Última manutenção por{' '}
                      <span className="font-semibold text-neutral-800">{entry.classificationUpdatedBy}</span>
                      {entry.classificationUpdatedAt !== null ? (
                        <>
                          {' em '}
                          <span className="font-semibold text-neutral-800">
                            {formatMassivaListDateDisplay(entry.classificationUpdatedAt)}
                          </span>
                        </>
                      ) : null}
                      .
                    </p>
                  )
                }
                return null
              })()}
            </div>

            <div className="mt-4">
              <MassivaClassificationFields
                idPrefix="maint"
                value={maintenanceClassif}
                onChange={setMaintenanceClassif}
                disabled={maintenanceMutation.isPending}
              />
            </div>

            {maintenanceMutation.isError ? (
              <p className="mt-2 text-xs text-red-700">
                {formatQueryError(maintenanceMutation.error)}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700"
                onClick={() => {
                  setMaintenanceProtocol(null)
                  setMaintenanceClassif({ ...MASSIVA_CLASSIFICATION_RESET })
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                disabled={maintenanceMutation.isPending}
                onClick={() => {
                  void maintenanceMutation.mutateAsync({
                    protocol: selectedMaintenanceTicket.protocol,
                    assignmentId: selectedMaintenanceTicket.assignmentId,
                    updatedBy: closedByLabel,
                    tipoIncidente: maintenanceClassif.tipoIncidente || null,
                    impacto: maintenanceClassif.impacto || null,
                    area: maintenanceClassif.area || null,
                    tecnologia: maintenanceClassif.tecnologia || null,
                    classificacao: maintenanceClassif.classificacao || null,
                    cnl: maintenanceClassif.cnl || null,
                  })
                }}
              >
                {maintenanceMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}


