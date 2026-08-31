import { type ReactNode, useMemo, useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Server,
  SignalLow,
  Wrench,
  X,
} from 'lucide-react'
import { useInstallationAlerts } from '@/features/splitters/hooks/useInstallationAlerts'
import { useOnuSummaryBySplitter } from '@/features/onu/hooks/useOnuSummaryBySplitter'
import { classifySplitterSignalLevel } from '@/features/onu/model/onuSplitterSummary'
import { fetchOpenMassivaSplitterCodesFromLocalDb } from '@/features/splitters/api/fetchOpenMassivaSplitterCodesFromLocalDb'
import { fetchOnuDiagnosticsBatch } from '@/features/onu/api/fetchOnuDiagnostic'
import { RX_POWER_CRITICAL_DBM, RX_POWER_DEGRADED_DBM } from '@/features/onu/model/onuDiagnostic'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { ResponsiveWrapper } from '@/shared/ui/ResponsiveWrapper'
import { cn } from '@/shared/lib/utils'
import {
  fetchCondoRedistributionFromLocalDb,
  type CondoRedistributionOpportunity,
  type PendingFloorInfoItem,
} from '@/features/splitters/api/fetchCondoRedistributionFromLocalDb'
import {
  exportOpportunitiesToPDF,
  exportOpportunitiesToCSV,
  exportPendingToPDF,
  exportPendingToCSV,
  exportAllOpportunitiesToPDF,
  exportAllOpportunitiesToCSV,
  exportAllPendingToPDF,
  exportAllPendingToCSV,
} from '@/features/splitters/utils/exportCondoRedistribution'

// ── Helpers ──────────────────────────────────────────────────────────────────────

function floorLabel(floor: number | null): string {
  if (floor === null) return '—'
  if (floor === 0) return 'Térreo'
  return `${floor}° andar`
}

/** Extrai a nomenclatura do splitter (parte antes de " - COND."/" - ED."/" - RES."). */
function splitterLabel(title: string): string {
  const match = title.match(/^(.+?)\s*-\s*(?:COND|ED|RES)\./i)
  return match ? match[1].trim() : title
}

function improvementBadgeClass(improvement: number): string {
  if (improvement >= 5) return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/50'
  if (improvement >= 3) return 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/50'
  return 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800/50'
}

type CondoPriority = 'alta' | 'media' | 'baixa'

/**
 * Prioridade heurística do condomínio: combina volume de clientes com a criticidade
 * (maior ganho de andar). Score = clientes × ganho. Ajustável no futuro (ver roadmap ISA).
 */
function condoPriority(count: number, bestImprovement: number): CondoPriority {
  const score = count * bestImprovement
  if (score >= 40 || bestImprovement >= 6) return 'alta'
  if (score >= 15 || bestImprovement >= 3) return 'media'
  return 'baixa'
}

const PRIORITY_META: Record<CondoPriority, { label: string; cls: string }> = {
  alta: { label: 'Alta prioridade', cls: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200' },
  media: { label: 'Média', cls: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200' },
  baixa: { label: 'Baixa', cls: 'bg-neutral-100 dark:bg-white/5 text-on-surface-variant' },
}

/**
 * Célula de sinal ONU medido ao vivo (dBm) — mesmo dado/limiares do chip do card.
 * `rx === 0` é o sentinela de LOS (sem luz óptica). Crítico ≤ -28, degradado ≤ -25.
 */
function signalCell(rx: number | null | undefined): { text: string; cls: string } {
  if (rx == null) return { text: '—', cls: 'text-on-surface-variant/60' }
  if (rx === 0) return { text: 'sem luz', cls: 'text-rose-700 dark:text-rose-200 font-semibold' }
  if (rx <= RX_POWER_CRITICAL_DBM) return { text: `${Math.round(rx)}`, cls: 'text-rose-700 dark:text-rose-200 font-semibold' }
  if (rx <= RX_POWER_DEGRADED_DBM) return { text: `${Math.round(rx)}`, cls: 'text-amber-700 dark:text-amber-200 font-semibold' }
  return { text: `${Math.round(rx)}`, cls: 'text-emerald-700 dark:text-emerald-200 font-semibold' }
}

// Malha de rede decorativa do banner ISA (coordenadas no viewBox 0 0 480 120).
// O nó ISA_MESH_HIGHLIGHT_INDEX é destacado em âmbar; os demais em branco tênue.
const ISA_MESH_NODES: ReadonlyArray<readonly [number, number]> = [
  [60, 80], [120, 40], [170, 90], [230, 55], [285, 95], [320, 35],
  [365, 70], [410, 100], [440, 50], [300, 72], [200, 30], [95, 105],
]
const ISA_MESH_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [6, 7],
  [6, 8], [9, 4], [9, 6], [10, 3], [10, 1], [11, 0], [11, 2],
]
const ISA_MESH_HIGHLIGHT_INDEX = 8

// Explicador no topo de cada aba: conta, em linguagem simples, o que a aba
// entrega e o que fazer com ela. Persistente (não é alerta) — é storytelling.
function TabIntro({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'amber' | 'orange'
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  const t =
    tone === 'amber'
      ? { wrap: 'border-amber-200/70 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/40', tile: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-200', title: 'text-amber-900 dark:text-amber-200' }
      : { wrap: 'border-orange-200/70 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/40', tile: 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-200', title: 'text-orange-900 dark:text-orange-200' }
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4', t.wrap)}>
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', t.tile)}>{icon}</div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className={cn('text-sm font-bold', t.title)}>{title}</p>
        <div className="space-y-2 text-xs leading-relaxed text-on-surface-variant">{children}</div>
      </div>
    </div>
  )
}

// Chip de passo do "como usar" (numerado), separados por seta.
function StepChip({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-2 py-1 ring-1 ring-neutral-200 dark:ring-white/10">
      <span className="flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">{n}</span>
      <span className="font-medium text-on-surface-variant">{children}</span>
    </span>
  )
}

type SortField = 'improvement' | 'condoName' | 'clientFloor'
type SortDirection = 'asc' | 'desc'
type ActiveTab = 'opportunities' | 'pending'

// ── Component ────────────────────────────────────────────────────────────────────

export function CondoRedistributionScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('opportunities')

  // Exportação global
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  // Aba oportunidades
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('improvement')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedCondo, setSelectedCondo] = useState<string | null>(null)

  // Filtros geográficos (compartilhados entre as duas abas)
  const [cityFilter, setCityFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')

  // Aba pendências
  const [pendingSearch, setPendingSearch] = useState('')
  const [selectedPendingCondo, setSelectedPendingCondo] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['condo-redistribution'],
    queryFn: fetchCondoRedistributionFromLocalDb,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  // Sinal ONU por código de splitter (para sinalizar sinal crítico no card)
  const onuSummary = useOnuSummaryBySplitter()
  const onuByCode = onuSummary.data

  // Splitters com massiva aberta (para sinalizar "não redistribuir em cima de obra")
  const openMassivaQuery = useQuery({
    queryKey: ['open-massiva-splitter-codes'],
    queryFn: fetchOpenMassivaSplitterCodesFromLocalDb,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const openMassivaCodes = useMemo(
    () => new Set(openMassivaQuery.data ?? []),
    [openMassivaQuery.data],
  )

  // Opções de cidade e site (das duas abas), ordenadas
  const { cityOptions, siteOptions } = useMemo(() => {
    const cities = new Set<string>()
    const sites = new Set<string>()
    for (const o of data?.opportunities ?? []) {
      if (o.city) cities.add(o.city)
      if (o.site) sites.add(o.site)
    }
    for (const p of data?.pendingFloorInfo ?? []) {
      if (p.city) cities.add(p.city)
      if (p.site) sites.add(p.site)
    }
    const byPt = (a: string, b: string) => a.localeCompare(b, 'pt-BR')
    return { cityOptions: [...cities].sort(byPt), siteOptions: [...sites].sort(byPt) }
  }, [data?.opportunities, data?.pendingFloorInfo])

  // ── Oportunidades filtradas ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data?.opportunities) return []
    const q = search.trim().toLowerCase()
    let list = data.opportunities
    if (cityFilter) list = list.filter((o) => o.city === cityFilter)
    if (siteFilter) list = list.filter((o) => o.site === siteFilter)
    if (q) {
      list = list.filter(
        (o) =>
          o.client.name.toLowerCase().includes(q) ||
          o.client.pppoeUser.toLowerCase().includes(q) ||
          o.condoName.toLowerCase().includes(q) ||
          o.currentSplitter.code.toLowerCase().includes(q) ||
          o.suggestedSplitter.code.toLowerCase().includes(q) ||
          o.client.complement.toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q) ||
          o.site.toLowerCase().includes(q),
      )
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'improvement':
          cmp = a.floorDifference.improvement - b.floorDifference.improvement
          break
        case 'condoName':
          cmp = a.condoName.localeCompare(b.condoName, 'pt-BR')
          break
        case 'clientFloor':
          cmp = (a.client.floor ?? 0) - (b.client.floor ?? 0)
          break
      }
      return sortDirection === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [data?.opportunities, search, sortField, sortDirection, cityFilter, siteFilter])

  const groupedByCondo = useMemo(() => {
    const map = new Map<string, CondoRedistributionOpportunity[]>()
    for (const o of filtered) {
      if (!map.has(o.condoName)) map.set(o.condoName, [])
      map.get(o.condoName)!.push(o)
    }
    return [...map.entries()]
  }, [filtered])

  // Stats por condomínio para os cards — ordenados pelo sortField escolhido
  const condoCards = useMemo(() => {
    const cards = groupedByCondo.map(([condoName, opps]) => {
      const splitters = new Set([
        ...opps.map((o) => o.currentSplitter.code),
        ...opps.map((o) => o.suggestedSplitter.code),
      ])
      const bestImprovement = Math.max(...opps.map((o) => o.floorDifference.improvement))
      const blocks = [...new Set(opps.map((o) => o.currentSplitter.block).filter(Boolean))] as string[]
      const city = opps.find((o) => o.city)?.city ?? ''
      const site = opps.find((o) => o.site)?.site ?? ''
      const priority = condoPriority(opps.length, bestImprovement)
      // Splitters atuais deste condomínio com sinal ONU crítico/offline
      const currentCodes = new Set(opps.map((o) => o.currentSplitter.code))
      let criticalSignals = 0
      for (const code of currentCodes) {
        const level = classifySplitterSignalLevel(onuByCode?.get(code))
        if (level === 'critico' || level === 'offline') criticalSignals++
      }
      const hasOpenMassiva = [...currentCodes].some((code) => openMassivaCodes.has(code))
      return { condoName, count: opps.length, splitters: splitters.size, bestImprovement, blocks, city, site, priority, criticalSignals, hasOpenMassiva }
    })

    cards.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'improvement': cmp = a.bestImprovement - b.bestImprovement; break
        case 'condoName':   cmp = a.condoName.localeCompare(b.condoName, 'pt-BR'); break
        case 'clientFloor': cmp = a.count - b.count; break // "Andar" ordena por qtd de clientes no grupo
      }
      return sortDirection === 'desc' ? -cmp : cmp
    })

    return cards
  }, [groupedByCondo, sortField, sortDirection, onuByCode, openMassivaCodes])

  // ── Pendências filtradas ───────────────────────────────────────────────────────
  const filteredPending = useMemo(() => {
    if (!data?.pendingFloorInfo) return []
    const q = pendingSearch.trim().toLowerCase()
    let list = data.pendingFloorInfo
    if (cityFilter) list = list.filter((p) => p.city === cityFilter)
    if (siteFilter) list = list.filter((p) => p.site === siteFilter)
    if (!q) return list
    return list.filter(
      (p) =>
        p.client.name.toLowerCase().includes(q) ||
        p.client.pppoeUser.toLowerCase().includes(q) ||
        p.condoName.toLowerCase().includes(q) ||
        p.currentSplitter.code.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.site.toLowerCase().includes(q),
    )
  }, [data?.pendingFloorInfo, pendingSearch, cityFilter, siteFilter])

  // Pendências agrupadas por condomínio (mesma lógica da aba de oportunidades)
  const pendingByCondo = useMemo(() => {
    const map = new Map<string, PendingFloorInfoItem[]>()
    for (const p of filteredPending) {
      if (!map.has(p.condoName)) map.set(p.condoName, [])
      map.get(p.condoName)!.push(p)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [filteredPending])

  // Dados do modal (oportunidades)
  const selectedCondoOpps = useMemo<CondoRedistributionOpportunity[] | null>(
    () => selectedCondo !== null
      ? (groupedByCondo.find(([n]) => n === selectedCondo)?.[1] ?? [])
      : null,
    [selectedCondo, groupedByCondo],
  )

  // Sinal ONU medido ao vivo por cliente (por pppoe) — só quando o modal de
  // oportunidades abre. Mesma fonte do chip de sinal crítico do card.
  const selectedCondoPppoes = useMemo(
    () => selectedCondoOpps ? selectedCondoOpps.map((o) => o.client.pppoeUser).filter(Boolean) : [],
    [selectedCondoOpps],
  )
  const onuSignals = useQuery({
    queryKey: ['condo-onu-signals', selectedCondo],
    queryFn: () => fetchOnuDiagnosticsBatch(selectedCondoPppoes),
    enabled: selectedCondo !== null && selectedCondoPppoes.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
  const signalByPppoe = onuSignals.data

  // Dados do modal (pendências)
  const selectedPendingItems = useMemo<PendingFloorInfoItem[] | null>(
    () => selectedPendingCondo !== null
      ? (pendingByCondo.find(([n]) => n === selectedPendingCondo)?.[1] ?? [])
      : null,
    [selectedPendingCondo, pendingByCondo],
  )

  // Fechar modal com ESC
  const closeOpportunityModal = useCallback(() => setSelectedCondo(null), [])
  const closePendingModal = useCallback(() => setSelectedPendingCondo(null), [])

  useEffect(() => {
    if (selectedCondo === null && selectedPendingCondo === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeOpportunityModal(); closePendingModal() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedCondo, selectedPendingCondo, closeOpportunityModal, closePendingModal])

  // Travar scroll do body quando modal aberto
  useEffect(() => {
    const hasModal = selectedCondo !== null || selectedPendingCondo !== null
    document.body.style.overflow = hasModal ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [selectedCondo, selectedPendingCondo])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field
      ? <ChevronDown className="inline size-3 opacity-30" />
      : sortDirection === 'desc'
        ? <ChevronDown className="inline size-3.5" />
        : <ChevronUp className="inline size-3.5" />

  // Filtros de cidade e site (compartilhados; limpam a seleção de card ao trocar)
  const clearSelections = () => { setSelectedCondo(null); setSelectedPendingCondo(null) }
  const geoFilters = (cityOptions.length > 0 || siteOptions.length > 0) ? (
    <div className="flex items-center gap-2">
      {cityOptions.length > 0 && (
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-amber-500" />
          <select
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); clearSelections() }}
            className={cn('h-9 appearance-none rounded-xl border bg-surface-container-lowest pl-8 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-200/50 dark:focus:ring-amber-800/50',
              cityFilter ? 'border-amber-300 text-amber-800 dark:text-amber-200' : 'border-neutral-200 dark:border-white/10 text-on-surface-variant')}
          >
            <option value="">Todas as cidades</option>
            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-on-surface-variant/60" />
        </div>
      )}
      {siteOptions.length > 0 && (
        <div className="relative">
          <Server className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sky-500" />
          <select
            value={siteFilter}
            onChange={(e) => { setSiteFilter(e.target.value); clearSelections() }}
            className={cn('h-9 appearance-none rounded-xl border bg-surface-container-lowest pl-8 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-200/50 dark:focus:ring-sky-800/50',
              siteFilter ? 'border-sky-300 text-sky-800 dark:text-sky-200' : 'border-neutral-200 dark:border-white/10 text-on-surface-variant')}
          >
            <option value="">Todos os sites</option>
            {siteOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-on-surface-variant/60" />
        </div>
      )}
    </div>
  ) : null

  // ── Alertas de protocolo em andamento ────────────────────────────────────────
  // Cruza os PPPoEs pendentes de andar com protocolos abertos no Elleven
  const {
    data: alerts = [],
    isLoading: alertsLoading,
  } = useInstallationAlerts(data?.pendingFloorInfo, !isLoading && !isError)

  const [alertDismissed, setAlertDismissed] = useState(false)
  // Reseta dismiss quando chegam novos alertas
  useEffect(() => { if (alerts.length > 0) setAlertDismissed(false) }, [alerts.length])

  const pendingCount = data?.stats?.pendingCount ?? 0
  const opportunitiesCount = data?.stats?.opportunitiesFound ?? 0

  return (
    <>
    <ResponsiveWrapper className="space-y-5 animate-screen-enter">
      {/* Header */}
      <AppPageHeader
        badge="Inteligência de Rede"
        title="Redistribuição de Condomínios"
        description="Identifica clientes conectados em splitters de andares distantes, quando há um splitter mais próximo com portas disponíveis no mesmo bloco."
        icon={Building2}
        primaryAction={{ to: '/splitters', label: 'Voltar aos Splitters' }}
      />

      {/* Banner ISA — fundo desenhado (gradiente vermelho + malha de rede SVG),
          sem imagem raster: escala nítido em qualquer tela e nunca corta mal. A
          malha evapora para a esquerda, deixando o texto sempre legível. */}
      <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 dark:border-white/10 bg-gradient-to-br from-red-950 via-red-800 to-red-950 px-5 py-4 shadow-lg">
        <svg
          aria-hidden="true"
          viewBox="0 0 480 120"
          preserveAspectRatio="xMaxYMid slice"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3"
        >
          <defs>
            <linearGradient id="isa-mesh-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="white" stopOpacity="0" />
              <stop offset="0.5" stopColor="white" stopOpacity="0.5" />
              <stop offset="1" stopColor="white" stopOpacity="1" />
            </linearGradient>
            <mask id="isa-mesh-mask">
              <rect width="480" height="120" fill="url(#isa-mesh-fade)" />
            </mask>
          </defs>
          <g mask="url(#isa-mesh-mask)">
            {ISA_MESH_EDGES.map(([a, b], i) => (
              <line
                key={`e${i}`}
                x1={ISA_MESH_NODES[a][0]}
                y1={ISA_MESH_NODES[a][1]}
                x2={ISA_MESH_NODES[b][0]}
                y2={ISA_MESH_NODES[b][1]}
                stroke="white"
                strokeOpacity={0.18}
                strokeWidth={1}
              />
            ))}
            {ISA_MESH_NODES.map(([cx, cy], i) => {
              const highlight = i === ISA_MESH_HIGHLIGHT_INDEX
              return (
                <circle
                  key={`n${i}`}
                  cx={cx}
                  cy={cy}
                  r={highlight ? 4.5 : 2.6}
                  fill={highlight ? '#fbbf24' : 'white'}
                  fillOpacity={highlight ? 0.95 : 0.35}
                />
              )
            })}
          </g>
        </svg>
        {/* Brilho âmbar suave, ancora o olhar no lado das métricas */}
        <div className="pointer-events-none absolute -right-8 top-1/2 size-52 -translate-y-1/2 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative z-10 flex flex-1 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest/15 ring-1 ring-white/20 backdrop-blur-sm">
            <ArrowRightLeft className="size-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white sm:text-base">
              ISA — Assistente de Redistribuição
            </h2>
            <p className="text-xs text-white/70">
              Análise automatizada por proximidade vertical em edifícios
            </p>
          </div>
        </div>
        {data?.stats && (
          <div className="relative z-10 hidden gap-4 sm:flex">
            <StatPill label="Condomínios" value={data.stats.condos} />
            <StatPill label="Analisados" value={data.stats.clientsAnalyzed} />
            <StatPill label="Oportunidades" value={opportunitiesCount} highlight />
          </div>
        )}
      </div>

      {/* Stats mobile */}
      {data?.stats && (
        <div className="grid grid-cols-3 gap-3 sm:hidden">
          <StatCard label="Condomínios" value={data.stats.condos} />
          <StatCard label="Analisados" value={data.stats.clientsAnalyzed} />
          <StatCard label="Oportunidades" value={opportunitiesCount} highlight />
        </div>
      )}

      {/* Banner de alertas: protocolos abertos cruzados com pendências de andar */}
      {!alertDismissed && alerts.length > 0 && (
        <div className="relative rounded-2xl border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-950/40 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-300">
              <Bell className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-orange-900 dark:text-orange-200">
                {alerts.length === 1
                  ? '1 protocolo em andamento com pendência de andar'
                  : `${alerts.length} protocolos em andamento com pendência de andar`}
              </p>
              <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-200">
                Os técnicos abaixo estão em campo. Solicite que informem o andar do apartamento para regularizar o cadastro.
              </p>
              <ul className="mt-3 space-y-2">
                {alerts.map((a) => (
                  <li key={`${a.protocolo}-${a.pppoe}`}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-100 bg-surface-container-lowest px-3 py-2 text-xs">
                    <span className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 font-bold',
                      a.categoria === 'MANUTENCAO'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200'
                        : 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200',
                    )}>
                      {a.categoria === 'MANUTENCAO'
                        ? <Wrench className="size-3" />
                        : <ArrowRightLeft className="size-3" />}
                      {a.categoria === 'MANUTENCAO' ? 'Manutenção' : 'Instalação'}
                    </span>
                    <span className="font-mono font-semibold text-on-surface-variant">{a.protocolo}</span>
                    <span className="font-semibold text-on-surface">{a.cliente}</span>
                    <span className="text-on-surface-variant/60">·</span>
                    <span className="text-on-surface-variant">{a.pppoe}</span>
                    {a.splitter && a.splitter !== 'Nao identificado' && (
                      <>
                        <span className="text-on-surface-variant/60">·</span>
                        <span className="text-on-surface-variant">{a.splitter}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setAlertDismissed(true)}
              className="shrink-0 rounded-lg p-1 text-orange-400 transition hover:bg-orange-100 dark:hover:bg-orange-950/50 hover:text-orange-700 dark:hover:text-orange-200"
              aria-label="Fechar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="flex items-center gap-1 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 p-1">
        <TabButton
          active={activeTab === 'opportunities'}
          onClick={() => setActiveTab('opportunities')}
          icon={<ArrowRightLeft className="size-4" />}
          label="Oportunidades"
          count={opportunitiesCount}
          countColor="amber"
        />
        <TabButton
          active={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          icon={<AlertTriangle className="size-4" />}
          label="Pendências"
          count={pendingCount}
          countColor="orange"
          alertCount={alerts.length}
          alertLoading={alertsLoading}
        />
        <div className="ml-auto flex items-center gap-2">
          {/* Exportar tudo — só aparece com dados */}
          {data && !isLoading && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((p) => !p)}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-low"
              >
                <Download className="size-3.5" />
                Exportar tudo
                <ChevronDown className="size-3" />
              </button>

              {exportMenuOpen && (
                <>
                  {/* Backdrop para fechar */}
                  <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />

                  <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest shadow-lg">
                    <p className="border-b border-neutral-100 dark:border-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                      {activeTab === 'opportunities' ? 'Oportunidades' : 'Pendências'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false)
                        if (activeTab === 'opportunities') exportAllOpportunitiesToCSV(data.opportunities)
                        else exportAllPendingToCSV(data.pendingFloorInfo)
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-on-surface-variant transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-200"
                    >
                      <FileSpreadsheet className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                      <div>
                        <p className="font-semibold">CSV</p>
                        <p className="text-[10px] text-on-surface-variant/60">Abre no Excel direto</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false)
                        if (activeTab === 'opportunities') exportAllOpportunitiesToPDF(data.opportunities)
                        else exportAllPendingToPDF(data.pendingFloorInfo)
                      }}
                      className="flex w-full items-center gap-3 border-t border-neutral-100 dark:border-white/5 px-3 py-2.5 text-left text-xs text-on-surface-variant transition hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-200"
                    >
                      <FileText className="size-4 shrink-0 text-red-500" />
                      <div>
                        <p className="font-semibold">PDF</p>
                        <p className="text-[10px] text-on-surface-variant/60">
                          {activeTab === 'opportunities'
                            ? `${data.opportunities.length} clientes, ${[...new Set(data.opportunities.map(o => o.condoName))].length} condos`
                            : `${data.pendingFloorInfo.length} pendências`}
                        </p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-low disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 dark:border-white/5 bg-surface-container-lowest py-16">
          <Loader2 className="size-8 animate-spin text-amber-500" />
          <p className="text-sm text-on-surface-variant">Analisando condomínios...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 p-6 text-center">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
            Erro ao carregar análise:{' '}
            {error instanceof Error ? error.message : 'Erro desconhecido'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-rose-100 dark:bg-rose-950/50 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-200 transition hover:bg-rose-200 dark:hover:bg-rose-950/60"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Aba: Oportunidades ──────────────────────────────────────────────── */}
      {!isLoading && !isError && activeTab === 'opportunities' && (
        <div key="tab-opportunities" className="space-y-4 animate-tab-enter">
          <TabIntro
            tone="amber"
            icon={<ArrowRightLeft className="size-5" />}
            title="Onde vale a pena mover um cliente de splitter"
          >
            <p>
              Clientes ligados a um splitter de <strong className="font-semibold text-on-surface">andar distante</strong>,
              quando existe outro splitter <strong className="font-semibold text-on-surface">mais próximo, no mesmo bloco</strong>,
              com portas livres. Mover encurta a distância óptica e tende a melhorar o sinal do cliente.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[11px] font-semibold text-on-surface-variant">Como usar:</span>
              <StepChip n={1}>Escolha um condomínio</StepChip>
              <ArrowRight className="size-3 text-on-surface-variant/60" />
              <StepChip n={2}>Veja cliente, splitter atual → sugerido e o sinal</StepChip>
              <ArrowRight className="size-3 text-on-surface-variant/60" />
              <StepChip n={3}>Exporte a lista para o time de campo</StepChip>
            </div>
          </TabIntro>

          {/* Busca + ordenação */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60" />
              <input
                type="text"
                placeholder="Buscar por cliente, condomínio, splitter..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedCondo(null) }}
                className="h-9 w-full rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200/50 dark:focus:ring-amber-800/50"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="font-medium">Ordenar:</span>
              {([
                { field: 'improvement' as SortField, label: 'Mais crítico', desc: 'maior ganho de andar primeiro' },
                { field: 'clientFloor' as SortField, label: 'Mais clientes', desc: 'maior nº de clientes por cond.' },
                { field: 'condoName'   as SortField, label: 'A–Z',           desc: 'ordem alfabética' },
              ]).map(({ field, label, desc }) => (
                <button key={field} type="button" onClick={() => toggleSort(field)}
                  title={desc}
                  className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold transition',
                    sortField === field ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200' : 'bg-neutral-100 dark:bg-white/5 text-on-surface-variant hover:bg-neutral-200 dark:hover:bg-white/10')}
                >
                  {label}
                  <SortIcon field={field} />
                </button>
              ))}
            </div>
            {geoFilters}
          </div>

          {/* Empty */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 dark:border-white/5 bg-surface-container-lowest py-16">
              <Building2 className="size-10 text-emerald-400" />
              <p className="text-sm font-semibold text-on-surface-variant">
                {search ? 'Nenhum resultado para a busca' : 'Nenhuma oportunidade encontrada'}
              </p>
            </div>
          )}

          {/* Grid de cards — 2 col em tablet, 3 col em desktop */}
          {condoCards.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {condoCards.map(({ condoName, count, splitters, bestImprovement, blocks, city, site, priority, criticalSignals, hasOpenMassiva }) => {
                const isSelected = selectedCondo === condoName
                return (
                  <button
                    key={condoName}
                    type="button"
                    onClick={() => setSelectedCondo((prev) => prev === condoName ? null : condoName)}
                    className={cn(
                      'flex items-start gap-4 rounded-xl border-l-4 border-r border-t border-b p-4 text-left transition',
                      isSelected
                        ? 'border-l-amber-500 border-r-amber-200 dark:border-amber-800/50 border-t-amber-200 dark:border-amber-800/50 border-b-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/40'
                        : 'border-l-amber-400 border-r-neutral-200 dark:border-white/10 border-t-neutral-200 dark:border-white/10 border-b-neutral-200 dark:border-white/10 bg-surface-container-lowest hover:border-l-amber-500 hover:bg-surface-container-low',
                    )}
                  >
                    {/* Ícone */}
                    <div className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      isSelected ? 'bg-amber-200 dark:bg-amber-950/60' : 'bg-amber-100 dark:bg-amber-950/50',
                    )}>
                      <Building2 className="size-5 text-amber-700 dark:text-amber-200" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">{condoName}</p>
                      {(city || site) && (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-on-surface-variant">
                          {city && (<span className="inline-flex items-center gap-1"><MapPin className="size-3 text-amber-500" />{city}</span>)}
                          {city && site && <span className="text-on-surface-variant/60">·</span>}
                          {site && (<span className="inline-flex items-center gap-1"><Server className="size-3 text-sky-500" />{site}</span>)}
                        </p>
                      )}
                      <div className="mb-3 mt-1 flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', PRIORITY_META[priority].cls)}>
                          {PRIORITY_META[priority].label}
                        </span>
                        {criticalSignals > 0 && (
                          <span
                            title={`${criticalSignals} splitter(s) com sinal crítico/offline`}
                            className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-200"
                          >
                            <SignalLow className="size-3" />
                            {criticalSignals} sinal crítico
                          </span>
                        )}
                        {hasOpenMassiva && (
                          <span
                            title="Há massiva aberta neste condomínio — avaliar antes de redistribuir"
                            className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-950/50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-200"
                          >
                            <AlertTriangle className="size-3" />
                            massiva aberta
                          </span>
                        )}
                        <span className="text-xs text-on-surface-variant">
                          {blocks.length > 0 ? `BL ${blocks.join(' · BL ')}` : 'Bloco único'}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-lg font-semibold tabular-nums text-on-surface">{count}</p>
                          <p className="text-[10px] text-on-surface-variant/60">clientes</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold tabular-nums text-on-surface">{splitters}</p>
                          <p className="text-[10px] text-on-surface-variant/60">splitters</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold tabular-nums text-on-surface">{bestImprovement}°</p>
                          <p className="text-[10px] text-on-surface-variant/60">maior ganho</p>
                        </div>
                      </div>
                    </div>

                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Pendências ─────────────────────────────────────────────────── */}
      {!isLoading && !isError && activeTab === 'pending' && (
        <div key="tab-pending" className="space-y-4 animate-tab-enter">
          <TabIntro
            tone="orange"
            icon={<AlertTriangle className="size-5" />}
            title="O que falta para estes casos virarem oportunidade"
          >
            <p>
              Casos que <strong className="font-semibold text-on-surface">ainda não puderam ser avaliados</strong> por
              falta de cadastro — sem esses dados o sistema não consegue comparar os andares. Há dois motivos:
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded-full bg-orange-100 dark:bg-orange-950/50 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-200">
                  Splitter sem andar
                </span>
                <span>o andar não está na descrição do splitter.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded-full bg-orange-100 dark:bg-orange-950/50 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-200">
                  Cliente sem complemento
                </span>
                <span>falta o andar/apartamento no cadastro do cliente.</span>
              </li>
            </ul>
            <p>
              Corrija no ERP e o caso passa a ser analisado na próxima atualização.
            </p>
          </TabIntro>

          {/* Busca + filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60" />
              <input
                type="text"
                placeholder="Filtrar por cliente, condomínio ou splitter..."
                value={pendingSearch}
                onChange={(e) => { setPendingSearch(e.target.value); setSelectedPendingCondo(null) }}
                className="h-9 w-full rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200/50 dark:focus:ring-amber-800/50"
              />
            </div>
            {geoFilters}
          </div>

          {/* Empty */}
          {filteredPending.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-neutral-100 dark:border-white/5 bg-surface-container-lowest py-16">
              <AlertTriangle className="size-10 text-emerald-400" />
              <p className="text-sm font-semibold text-on-surface-variant">
                {pendingSearch ? 'Nenhum resultado para a busca' : 'Sem pendências de andar'}
              </p>
            </div>
          )}

          {/* Grid de cards — 2 col em tablet, 3 col em desktop */}
          {pendingByCondo.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingByCondo.map(([condoName, items]) => {
                const isSelected = selectedPendingCondo === condoName
                const nSplitter = items.filter((i) => i.pendingReason === 'splitter_sem_andar').length
                const nClient = items.filter((i) => i.pendingReason === 'cliente_sem_complemento').length
                return (
                  <button
                    key={condoName}
                    type="button"
                    onClick={() => setSelectedPendingCondo((prev) => prev === condoName ? null : condoName)}
                    className={cn(
                      'flex items-start gap-4 rounded-xl border-l-4 border-r border-t border-b p-4 text-left transition',
                      isSelected
                        ? 'border-l-orange-400 border-r-orange-200 dark:border-orange-800/50 border-t-orange-200 dark:border-orange-800/50 border-b-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/40'
                        : 'border-l-orange-300 border-r-neutral-200 dark:border-white/10 border-t-neutral-200 dark:border-white/10 border-b-neutral-200 dark:border-white/10 bg-surface-container-lowest hover:border-l-orange-400 hover:bg-surface-container-low',
                    )}
                  >
                    <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', isSelected ? 'bg-orange-200 dark:bg-orange-950/60' : 'bg-orange-100 dark:bg-orange-950/50')}>
                      <AlertTriangle className="size-5 text-orange-600 dark:text-orange-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">{condoName}</p>
                      {(() => {
                        const city = items.find((i) => i.city)?.city ?? ''
                        const site = items.find((i) => i.site)?.site ?? ''
                        return (city || site) ? (
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-on-surface-variant">
                            {city && (<span className="inline-flex items-center gap-1"><MapPin className="size-3 text-amber-500" />{city}</span>)}
                            {city && site && <span className="text-on-surface-variant/60">·</span>}
                            {site && (<span className="inline-flex items-center gap-1"><Server className="size-3 text-sky-500" />{site}</span>)}
                          </p>
                        ) : null
                      })()}
                      <p className="mb-3 mt-0.5 text-xs text-on-surface-variant">{items.length} pendência{items.length !== 1 ? 's' : ''}</p>
                      <div className="flex gap-3">
                        {nSplitter > 0 && (
                          <span className="rounded-full bg-orange-100 dark:bg-orange-950/50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-200">
                            {nSplitter} splitter sem andar
                          </span>
                        )}
                        {nClient > 0 && (
                          <span className="rounded-full bg-sky-100 dark:bg-sky-950/50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-200">
                            {nClient} sem complemento
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </ResponsiveWrapper>

      {/* Modais renderizados FORA do wrapper animado: o transform da animação de
          entrada cria um containing block que quebraria o position:fixed dos modais
          (o painel iria parar no meio do conteúdo, fora da viewport). */}

      {/* ── Modal: Oportunidades ─────────────────────────────────────────────── */}
      {selectedCondoOpps !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeOpportunityModal}
          />

          {/* Painel */}
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-2xl sm:rounded-2xl dark:ring-1 dark:ring-white/10">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 dark:border-white/5 bg-surface-container-lowest px-6 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50">
                <Building2 className="size-5 text-amber-700 dark:text-amber-200" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-on-surface">{selectedCondo}</h2>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-on-surface-variant">
                  <span>{selectedCondoOpps.length} cliente{selectedCondoOpps.length !== 1 ? 's' : ''} para redistribuir</span>
                  {selectedCondoOpps[0]?.city && (<span className="inline-flex items-center gap-1 text-on-surface-variant/60"><MapPin className="size-3 text-amber-500" />{selectedCondoOpps[0].city}</span>)}
                  {selectedCondoOpps[0]?.site && (<span className="inline-flex items-center gap-1 text-on-surface-variant/60"><Server className="size-3 text-sky-500" />{selectedCondoOpps[0].site}</span>)}
                </p>
              </div>
              {/* Botões de exportação */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden items-center gap-1 text-xs text-on-surface-variant/60 sm:flex">
                  <Download className="size-3" /> Exportar:
                </span>
                <button
                  type="button"
                  onClick={() => exportOpportunitiesToCSV(selectedCondo!, selectedCondoOpps)}
                  title="Exportar CSV"
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-200"
                >
                  <FileSpreadsheet className="size-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportOpportunitiesToPDF(selectedCondo!, selectedCondoOpps)}
                  title="Exportar PDF"
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-200"
                >
                  <FileText className="size-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              </div>
              <button
                type="button"
                onClick={closeOpportunityModal}
                className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant/60 transition hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-on-surface-variant"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tabela com scroll */}
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-surface-container-low">
                  <tr className="border-b border-neutral-200 dark:border-white/10">
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Cliente</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Telefone</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Complemento</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Andar</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Splitter atual</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Splitter sugerido</th>
                    <th className="px-4 py-3 text-center font-semibold text-on-surface-variant">Portas livres</th>
                    <th className="px-4 py-3 text-center font-semibold text-on-surface-variant">Sinal</th>
                    <th className="px-4 py-3 text-center font-semibold text-on-surface-variant">Melhoria</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCondoOpps.map((o, i) => (
                    <tr key={`${o.client.pppoeUser}-${i}`} className="border-b border-neutral-50 transition hover:bg-amber-50/30 dark:hover:bg-amber-950/40 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-on-surface">{o.client.name}</div>
                        <div className="text-[10px] text-on-surface-variant/60">{o.client.pppoeUser}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{o.client.phone || '—'}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{o.client.complement || '—'}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-on-surface">{floorLabel(o.client.floor)}</td>
                      <td className="px-4 py-3">
                        <Link to={`/splitters/${o.currentSplitter.code}`} className="font-medium text-sky-700 dark:text-sky-200 hover:underline" title={o.currentSplitter.title} onClick={closeOpportunityModal}>
                          {splitterLabel(o.currentSplitter.title)}
                        </Link>
                        <div className="text-[10px] text-on-surface-variant/60">
                          {floorLabel(o.currentSplitter.floor)}{o.currentSplitter.block ? ` · BL ${o.currentSplitter.block}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/splitters/${o.suggestedSplitter.code}`} className="font-medium text-emerald-700 dark:text-emerald-200 hover:underline" title={o.suggestedSplitter.title} onClick={closeOpportunityModal}>
                          {splitterLabel(o.suggestedSplitter.title)}
                        </Link>
                        <div className="text-[10px] text-on-surface-variant/60">
                          {floorLabel(o.suggestedSplitter.floor)}{o.suggestedSplitter.block ? ` · BL ${o.suggestedSplitter.block}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
                          {o.suggestedSplitter.availablePorts}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {onuSignals.isLoading ? (
                          <Loader2 className="mx-auto size-3.5 animate-spin text-on-surface-variant/60" />
                        ) : (() => {
                          const rx = signalByPppoe?.get(o.client.pppoeUser)?.rxPower
                          const cell = signalCell(rx)
                          const hasReading = rx != null && rx !== 0
                          return (
                            <span
                              className={cn('inline-flex items-center gap-1 tabular-nums', cell.cls)}
                              title={rx != null ? 'Sinal ONU medido ao vivo' : 'Sem leitura de ONU disponível'}
                            >
                              {rx != null && <SignalLow className="size-3.5" />}{cell.text}{hasReading ? ' dBm' : ''}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums', improvementBadgeClass(o.floorDifference.improvement))}>
                          ↑ {o.floorDifference.improvement} andar{o.floorDifference.improvement !== 1 ? 'es' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Pendências ────────────────────────────────────────────────── */}
      {selectedPendingItems !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closePendingModal}
          />

          {/* Painel */}
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-2xl sm:rounded-2xl dark:ring-1 dark:ring-white/10">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 dark:border-white/5 bg-surface-container-lowest px-6 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/50">
                <AlertTriangle className="size-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold text-on-surface">{selectedPendingCondo}</h2>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-on-surface-variant">
                  <span>{selectedPendingItems.length} pendência{selectedPendingItems.length !== 1 ? 's' : ''} sem informação de andar</span>
                  {selectedPendingItems[0]?.city && (<span className="inline-flex items-center gap-1 text-on-surface-variant/60"><MapPin className="size-3 text-amber-500" />{selectedPendingItems[0].city}</span>)}
                  {selectedPendingItems[0]?.site && (<span className="inline-flex items-center gap-1 text-on-surface-variant/60"><Server className="size-3 text-sky-500" />{selectedPendingItems[0].site}</span>)}
                </p>
              </div>
              {/* Botões de exportação */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden items-center gap-1 text-xs text-on-surface-variant/60 sm:flex">
                  <Download className="size-3" /> Exportar:
                </span>
                <button
                  type="button"
                  onClick={() => exportPendingToCSV(selectedPendingCondo!, selectedPendingItems)}
                  title="Exportar CSV"
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-200"
                >
                  <FileSpreadsheet className="size-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPendingToPDF(selectedPendingCondo!, selectedPendingItems)}
                  title="Exportar PDF"
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-200"
                >
                  <FileText className="size-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              </div>
              <button
                type="button"
                onClick={closePendingModal}
                className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant/60 transition hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-on-surface-variant"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tabela com scroll */}
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-surface-container-low">
                  <tr className="border-b border-neutral-200 dark:border-white/10">
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Cliente</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Telefone</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Splitter atual</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Complemento</th>
                    <th className="px-4 py-3 font-semibold text-on-surface-variant">Pendência</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPendingItems.map((p, i) => {
                    const isSplitter = p.pendingReason === 'splitter_sem_andar'
                    return (
                      <tr key={`${p.client.pppoeUser}-${i}`} className="border-b border-neutral-50 transition hover:bg-surface-container-low last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-on-surface">{p.client.name}</div>
                          <div className="text-[10px] text-on-surface-variant/60">{p.client.pppoeUser}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{p.client.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <Link to={`/splitters/${p.currentSplitter.code}`} className="font-medium text-sky-700 dark:text-sky-200 hover:underline" title={p.currentSplitter.title} onClick={closePendingModal}>
                            {splitterLabel(p.currentSplitter.title)}
                          </Link>
                          <div className="text-[10px] text-on-surface-variant/60">{p.currentSplitter.code}</div>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">
                          {p.client.complement || <span className="italic text-on-surface-variant/60">sem complemento</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                            isSplitter ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-200' : 'bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-200')}>
                            {isSplitter ? 'Splitter sem andar' : 'Sem complemento'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── TabButton ─────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  countColor,
  alertCount = 0,
  alertLoading = false,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
  countColor: 'amber' | 'orange'
  alertCount?: number
  alertLoading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
        active
          ? 'bg-surface-container-lowest text-on-surface shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface-variant',
      )}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
            active
              ? countColor === 'amber'
                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-200'
                : 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-200'
              : 'bg-neutral-200 dark:bg-white/10 text-on-surface-variant',
          )}
        >
          {count}
        </span>
      )}
      {/* Slot de alerta: enquanto verifica → spinner; ao concluir → badge com contagem.
          Ocupa sempre o mesmo lugar, então a troca não desloca o layout. */}
      {alertLoading ? (
        <span
          title="Verificando protocolos de instalação/manutenção em andamento…"
          className="flex items-center gap-1 rounded-full bg-neutral-200/80 dark:bg-white/10 px-1.5 py-0.5 text-on-surface-variant"
        >
          <Loader2 className="size-2.5 animate-spin" />
        </span>
      ) : alertCount > 0 ? (
        <span
          title={`${alertCount} cliente${alertCount !== 1 ? 's' : ''} com protocolo em andamento`}
          className="flex animate-tab-enter items-center gap-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm shadow-orange-500/30"
        >
          <Bell className="size-2.5" />
          {alertCount}
        </span>
      ) : null}
    </button>
  )
}

// ── StatPill / StatCard ───────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl px-5 py-2.5 shadow-sm',
        highlight
          ? 'bg-amber-400 ring-1 ring-amber-300 dark:ring-amber-800/50'
          : 'bg-surface-container-lowest/90 ring-1 ring-white/50 backdrop-blur-sm',
      )}
    >
      <span
        className={cn(
          'text-xl font-extrabold tabular-nums',
          highlight ? 'text-on-surface' : 'text-on-surface',
        )}
      >
        {value.toLocaleString('pt-BR')}
      </span>
      <span
        className={cn(
          'text-[10px] font-medium',
          highlight ? 'text-on-surface-variant' : 'text-on-surface-variant',
        )}
      >
        {label}
      </span>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border p-3',
        highlight ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40' : 'border-neutral-200 dark:border-white/10 bg-surface-container-lowest',
      )}
    >
      <span
        className={cn(
          'text-lg font-bold tabular-nums',
          highlight ? 'text-amber-700 dark:text-amber-200' : 'text-on-surface',
        )}
      >
        {value.toLocaleString('pt-BR')}
      </span>
      <span className="text-[10px] text-on-surface-variant">{label}</span>
    </div>
  )
}
