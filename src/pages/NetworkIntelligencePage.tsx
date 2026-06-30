import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChartSpline,
  Database,
  Loader2,
  MapPin,
  Moon,
  MoonStar,
  Network,
  Sun,
  Sunrise,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import {
  formatBrazilDateDisplay,
  formatBrazilDateTimeShortDisplay,
  formatBrazilDayMonthDisplay,
} from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'
import type { NetworkStats } from '@/shared/api/fetchNetworkStats'
import {
  countDistinctMassivasByLifecycleBucket,
  toLifecycleBucket,
} from '@/features/massiva/lib/lifecycleMassivaBuckets'
import {
  useNetworkIntelligenceData,
  type IntelligenceDateRangePreset,
  type IntelligenceRiskRankingRow,
  type TrendLabel,
} from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import { MassivaRecurrencePanel } from '@/features/intelligence/ui/MassivaRecurrencePanel'
import { TrendStatusCapacityPanel } from '@/features/intelligence/ui/TrendStatusCapacityPanel'
import { OccupancyCapacityCharts } from '@/features/intelligence/ui/OccupancyCapacityCharts'
import {
  formatDeltaPp,
  PP_TOOLTIP_DELTA_PERIOD,
} from '@/features/intelligence/lib/percentagePointsHelp'
import { buildTopStreetsByNormalizedStreet } from '@/features/intelligence/lib/geoStreetAggregation'

const IntelligenceSaturationMap = lazy(async () => {
  const m = await import('@/features/intelligence/ui/IntelligenceSaturationMap')
  return { default: m.IntelligenceSaturationMap }
})

const OnuSignalHealthPanel = lazy(async () => {
  const m = await import('@/features/onu/ui/OnuSignalHealthPanel')
  return { default: m.OnuSignalHealthPanel }
})

const EquipmentFleetPanel = lazy(async () => {
  const m = await import('@/features/equipamentos/ui/EquipmentFleetPanel')
  return { default: m.EquipmentFleetPanel }
})

const NetworkTopologyPanel = lazy(async () => {
  const m = await import('@/features/intelligence/ui/NetworkTopologyPanel')
  return { default: m.NetworkTopologyPanel }
})

function formatDateLabel(date: Date): string {
  return formatBrazilDayMonthDisplay(date)
}

/** Ocupação da rede = portas ocupadas ÷ soma da capacidade (portas) no catálogo. */
function previewNetworkCapacityPercent(stats: NetworkStats): number | null {
  const cap = stats.totalPortCapacity
  if (cap <= 0) return null
  return Number(((stats.onlineClients / cap) * 100).toFixed(2))
}

function networkCapacityBarClass(percent: number): string {
  if (percent >= 95) return 'bg-rose-500'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function recurrenceShiftIcon(shift: string): { Icon: LucideIcon; label: string } {
  const s = shift.trim().toLowerCase()
  if (s.startsWith('madr')) return { Icon: MoonStar, label: 'Madrugada' }
  if (s.startsWith('man')) return { Icon: Sunrise, label: 'Manhã' }
  if (s.startsWith('tar')) return { Icon: Sun, label: 'Tarde' }
  if (s.startsWith('noi')) return { Icon: Moon, label: 'Noite' }
  return { Icon: Sun, label: shift }
}

function IntelligencePanelLoadingSkeleton() {
  return (
    <motion.section
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 1 }}
      className="grid gap-4 lg:grid-cols-2"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="min-h-[200px] rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10"
        >
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200/90" />
          <div className="mt-4 h-9 w-44 animate-pulse rounded-lg bg-slate-200/80" />
          <div className="mt-2 h-3 w-52 animate-pulse rounded bg-slate-100" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="h-[5.25rem] animate-pulse rounded-2xl bg-slate-100/95" />
            <div className="h-[5.25rem] animate-pulse rounded-2xl bg-slate-100/95" />
            <div className="h-[5.25rem] animate-pulse rounded-2xl bg-slate-100/95" />
          </div>
        </div>
      ))}
      <div className="flex min-h-[5.5rem] flex-col gap-3 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
        <div className="flex gap-2">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
          <div className="space-y-2 pt-0.5">
            <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-14 w-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 w-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-14 w-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
      <div className="h-4 max-w-xl animate-pulse rounded bg-slate-100 lg:col-span-2" />
    </motion.section>
  )
}

function IntelligenceLowerDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 h-80 animate-pulse rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl" />
        <div className="h-80 animate-pulse rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl" />
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 h-80 animate-pulse rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl" />
        <div className="h-80 animate-pulse rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl" />
      </section>
      <div className="h-[min(420px,55vh)] animate-pulse rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl" />
    </div>
  )
}

function DateRangePresetButtons({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  preset: IntelligenceDateRangePreset
  onPresetChange: (value: IntelligenceDateRangePreset) => void
  customStart: string
  customEnd: string
  onCustomStartChange: (value: string) => void
  onCustomEndChange: (value: string) => void
}) {
  const presets: IntelligenceDateRangePreset[] = ['7d', '30d', '90d', 'custom']
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPresetChange(item)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition sm:px-3 sm:py-2 sm:text-xs',
              preset === item
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/25'
                : 'bg-white/80 text-slate-600 hover:bg-amber-50 hover:text-amber-700',
            )}
          >
            {presetButtonLabel(item)}
          </button>
        ))}
      </div>
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[11px] text-slate-700 sm:text-xs"
          />
          <span className="text-[11px] font-semibold text-slate-500">até</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[11px] text-slate-700 sm:text-xs"
          />
        </div>
      ) : null}
    </>
  )
}

const TREND_LABEL_ORDER: TrendLabel[] = [
  'Quase saturando',
  'Em crescimento',
  'Em queda',
  'Estavel',
]

const TREND_PIE_LABEL: Record<TrendLabel, string> = {
  Estavel: 'Estável',
  'Em crescimento': 'Em crescimento',
  'Em queda': 'Em queda',
  'Quase saturando': 'Quase saturando',
}

const TREND_PIE_COLOR: Record<TrendLabel, string> = {
  Estavel: '#10b981',
  'Em crescimento': '#f59e0b',
  'Em queda': '#06b6d4',
  'Quase saturando': '#f43f5e',
}

/** Texto curto para tooltip / ajuda contextual nas fatias da pizza de tendência */
const TREND_SLICE_HELP: Record<TrendLabel, string> = {
  Estavel: 'Uso oscilando pouco em relação ao histórico recente.',
  'Em crescimento': 'Ocupação subindo — vale acompanhar capacidade.',
  'Em queda': 'Ocupação em redução no período observado.',
  'Quase saturando': 'Próximo do limite de portas — alto risco operacional.',
}

/** Rótulos da barra de abas — alinhados ao que cada vista mostra no painel. */
const INTELLIGENCE_TAB_ITEMS: ReadonlyArray<{ id: IntelligenceWindow; label: string }> = [
  { id: 'visao-geral', label: 'Panorama' },
  { id: 'risco', label: 'Priorização' },
  { id: 'operacao', label: 'Uso e massivas' },
  { id: 'geografico', label: 'Mapa e OLTs' },
  { id: 'topologia', label: 'Topologia' },
  { id: 'ciclo-vida', label: 'Idade e cohorts' },
  { id: 'manutencao', label: 'Manutenções ERP' },
  { id: 'sinais', label: 'Sinais ONU' },
  { id: 'equipamentos', label: 'Equipamentos' },
]

const NETWORK_INTELLIGENCE_UI_STATE_KEY = 'nexaview.intelligence.ui.v1'

function readNetworkIntelligenceUiState(): {
  preset: IntelligenceDateRangePreset
  customStart: string
  customEnd: string
  activeWindow: IntelligenceWindow
  riskBandFilter: 'all' | 'critico' | 'alto' | 'moderado' | 'baixo'
  ageFilter: AgeFilter
  splitterSearch: string
  geoTab: 'condominios' | 'ruas'
  selectedMatrixKey:
    | 'altoImpactoAltaUrgencia'
    | 'altoImpactoBaixaUrgencia'
    | 'baixoImpactoAltaUrgencia'
    | 'baixoImpactoBaixaUrgencia'
    | null
  mapCorporateOnly: boolean
} {
  if (typeof window === 'undefined') {
    return {
      preset: '30d',
      customStart: '',
      customEnd: '',
      activeWindow: 'visao-geral',
      riskBandFilter: 'all',
      ageFilter: 'all',
      splitterSearch: '',
      geoTab: 'condominios',
      selectedMatrixKey: null,
      mapCorporateOnly: false,
    }
  }
  try {
    const raw = window.sessionStorage.getItem(NETWORK_INTELLIGENCE_UI_STATE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Partial<ReturnType<typeof readNetworkIntelligenceUiState>>
    return {
      preset:
        parsed.preset === '7d' || parsed.preset === '30d' || parsed.preset === '90d' || parsed.preset === 'custom'
          ? parsed.preset
          : '30d',
      customStart: typeof parsed.customStart === 'string' ? parsed.customStart : '',
      customEnd: typeof parsed.customEnd === 'string' ? parsed.customEnd : '',
      activeWindow:
        parsed.activeWindow === 'visao-geral' ||
        parsed.activeWindow === 'risco' ||
        parsed.activeWindow === 'operacao' ||
        parsed.activeWindow === 'geografico' ||
        parsed.activeWindow === 'topologia' ||
        parsed.activeWindow === 'ciclo-vida' ||
        parsed.activeWindow === 'manutencao' ||
        parsed.activeWindow === 'sinais' ||
        parsed.activeWindow === 'equipamentos'
          ? parsed.activeWindow
          : 'visao-geral',
      riskBandFilter:
        parsed.riskBandFilter === 'critico' ||
        parsed.riskBandFilter === 'alto' ||
        parsed.riskBandFilter === 'moderado' ||
        parsed.riskBandFilter === 'baixo'
          ? parsed.riskBandFilter
          : 'all',
      ageFilter:
        parsed.ageFilter === '0-1' ||
        parsed.ageFilter === '1-3' ||
        parsed.ageFilter === '3-5' ||
        parsed.ageFilter === '5+'
          ? parsed.ageFilter
          : 'all',
      splitterSearch: typeof parsed.splitterSearch === 'string' ? parsed.splitterSearch : '',
      geoTab: parsed.geoTab === 'ruas' ? 'ruas' : 'condominios',
      selectedMatrixKey:
        parsed.selectedMatrixKey === 'altoImpactoAltaUrgencia' ||
        parsed.selectedMatrixKey === 'altoImpactoBaixaUrgencia' ||
        parsed.selectedMatrixKey === 'baixoImpactoAltaUrgencia' ||
        parsed.selectedMatrixKey === 'baixoImpactoBaixaUrgencia'
          ? parsed.selectedMatrixKey
          : null,
      mapCorporateOnly: parsed.mapCorporateOnly === true,
    }
  } catch {
    return {
      preset: '30d',
      customStart: '',
      customEnd: '',
      activeWindow: 'visao-geral',
      riskBandFilter: 'all',
      ageFilter: 'all',
      splitterSearch: '',
      geoTab: 'condominios',
      selectedMatrixKey: null,
      mapCorporateOnly: false,
    }
  }
}

const TAB_INTRO: Record<IntelligenceWindow, string> = {
  'visao-geral':
    'Panorama da rede no período: ocupação global, como os splitters estão classificados por tendência, massivas e indicadores para decisão rápida.',
  risco:
    'Priorização: score único mistura ocupação, variação no tempo, massivas e clientes afetados. A matriz separa “impacto” (volume de gente/tickets) de “urgência” (uso alto, delta forte ou massivas abertas).',
  operacao:
    'Leitura operacional: evolução média da ocupação, volume de massivas por splitter, padrão de horários de abertura e status por equipamento.',
  geografico:
    'Indicadores por cidade, bairro e presença corporativa (cadastro do equipamento), agregações por OLT, contexto de condomínio/rua e mapa de calor — sempre no recorte filtrado.',
  topologia:
    'Drill-down pela hierarquia física da rede: OLT → Slot → PON → splitters. Navegue até a PON exata para ver ocupação, crescimento, massivas e clientes impactados em cada nível — sempre no recorte filtrado.',
  'ciclo-vida':
    'Idade do equipamento cruzada com pressão de uso: buckets de idade, ranking preventivo, alertas e cohorts por ano de implantação.',
  manutencao:
    'Manutenções registradas no ERP no intervalo de datas, consolidadas por splitter e ponto de acesso (útil para cruzar com risco no terreno).',
  sinais:
    'Saúde de sinal das ONUs em tempo quase real (monitoramento): panorama online/atenuado/offline, distribuição de potência RX, piores clientes e mapa de calor geográfico. Atualiza a cada 60s.',
  equipamentos:
    'Frota de equipamentos (patrimônio) na rede: dimensão do parque, modelos mais presentes (curva de Pareto), composição por tipo, distribuição por cidade e bairro e qualidade de cadastro (serial, MAC, duplicidades).',
}

function presetButtonLabel(p: IntelligenceDateRangePreset): string {
  switch (p) {
    case '7d':
      return '7 dias'
    case '30d':
      return '30 dias'
    case '90d':
      return '90 dias'
    case 'custom':
      return 'Personalizado'
    default:
      return p
  }
}

type TrendPieTooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown }>
  totalSplitters: number
}

function TrendPieTooltip({ active, payload, totalSplitters }: TrendPieTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const name = String(item.name ?? '')
  const value = Number(item.value ?? 0)
  const sharePct = totalSplitters > 0 ? (value / totalSplitters) * 100 : 0
  const key = TREND_LABEL_ORDER.find((k) => TREND_PIE_LABEL[k] === name)
  const hint = key ? TREND_SLICE_HELP[key] : ''
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] shadow-lg">
      <p className="font-bold text-slate-900">{name}</p>
      <p className="tabular-nums text-slate-700">
        {value.toLocaleString('pt-BR')} splitter{value === 1 ? '' : 's'} ({sharePct.toFixed(1)}% do total com tendência)
      </p>
      {hint ? <p className="mt-1 max-w-[14rem] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  )
}

function hasValidSplitterCoords(latitude: number | null, longitude: number | null): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  )
}

function trendBadgeClass(label: string): string {
  if (label === 'Quase saturando') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (label === 'Em crescimento') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (label === 'Em queda') return 'bg-cyan-50 text-cyan-700 border-cyan-200'
  return 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

type IntelligenceWindow = 'visao-geral' | 'risco' | 'operacao' | 'geografico' | 'topologia' | 'ciclo-vida' | 'manutencao' | 'sinais' | 'equipamentos'

type AgeFilter = 'all' | '0-1' | '1-3' | '3-5' | '5+'

function matrixKeyForRiskRow(
  row: IntelligenceRiskRankingRow,
): 'altoImpactoAltaUrgencia' | 'altoImpactoBaixaUrgencia' | 'baixoImpactoAltaUrgencia' | 'baixoImpactoBaixaUrgencia' {
  const highImpact = row.totalTickets >= 4 || row.openTickets > 0
  const highUrgency = row.currentUsagePercent >= 85 || row.selectedDelta >= 5 || row.openTickets > 0
  if (highImpact && highUrgency) return 'altoImpactoAltaUrgencia'
  if (highImpact && !highUrgency) return 'altoImpactoBaixaUrgencia'
  if (!highImpact && highUrgency) return 'baixoImpactoAltaUrgencia'
  return 'baixoImpactoBaixaUrgencia'
}

type RegionalInsightRow = {
  label: string
  splitters: number
  criticalSplitters: number
  avgUsagePercent: number
  avgDeltaReference: number
  openTickets: number
  /** Σ de massivas (por splitter) no recorte — não é total distinto da rede. */
  massivaTicketsTotal: number
  splittersWithCorporate: number
  directive: string
}

function regionalInsightDirective(args: {
  splitters: number
  criticalSplitters: number
  avgUsagePercent: number
  avgDeltaReference: number
  openTickets: number
  massivaTicketsTotal: number
  splittersWithCorporate: number
}): string {
  const n = args.splitters
  const critShare = n > 0 ? args.criticalSplitters / n : 0
  const parts: string[] = []
  if (critShare >= 0.35 && args.criticalSplitters >= 2) {
    parts.push('Alta fração de equipamentos críticos — priorizar capacidade ou remanejamento na área.')
  } else if (args.criticalSplitters >= 1 && args.avgUsagePercent >= 88) {
    parts.push('Uso médio elevado com saturados — revisar ordem de obra e transmissão.')
  }
  if (args.avgDeltaReference >= 4) {
    parts.push('Crescimento rápido de ocupação — antecipar expansão de porta ou OLT.')
  }
  if (args.openTickets >= 3) {
    parts.push('Várias massivas abertas — investigar causa raiz e plantão.')
  }
  if (args.massivaTicketsTotal >= 25) {
    parts.push('Alto envolvimento com massivas no recorte — reforçar comunicação e priorização operacional.')
  }
  if (args.splittersWithCorporate >= 1 && args.criticalSplitters >= 1) {
    parts.push('Corporativo em zona sensível — dar peso a SLA comercial.')
  }
  if (parts.length === 0) {
    if (args.avgUsagePercent < 72 && args.avgDeltaReference <= 1.5 && args.criticalSplitters === 0) {
      return 'Perfil mais folgado neste recorte — manter monitoramento periódico.'
    }
    return 'Sem alerta prioritário automático; acompanhar tendência no período.'
  }
  return parts.slice(0, 2).join(' ')
}

function corporateRegionalInsightDirective(args: {
  splittersTotal: number
  splittersWithCorporate: number
  criticalAmongCorporate: number
  avgUsageAmongCorporate: number
  openMassivasAmongCorporate: number
  corporateMassivaTickets: number
}): string {
  if (args.splittersTotal === 0) {
    return 'Sem equipamentos no recorte filtrado.'
  }
  if (args.splittersWithCorporate === 0) {
    return 'Nenhum splitter com cliente corporativo no recorte filtrado.'
  }
  const parts: string[] = []
  if (args.criticalAmongCorporate >= 1) {
    parts.push('Há corporativo em uso crítico — priorizar continuidade e escalação N2/N3.')
  }
  if (args.openMassivasAmongCorporate >= 2) {
    parts.push('Massivas abertas envolvendo corporativo — revisar causa raiz com urgência.')
  }
  if (args.avgUsageAmongCorporate >= 90) {
    parts.push('Pressão média alta nos splitters com PJ — planejar capacidade.')
  }
  if (parts.length === 0) {
    return 'Base corporativa presente com pressão moderada — ritmo habitual de governança.'
  }
  return parts.slice(0, 2).join(' ')
}

/**
 * Faixa narrativa reutilizada no topo das abas — frase dinâmica derivada dos
 * dados do recorte (estilo dos painéis de Topologia/Equipamentos/Sinais).
 */
function InsightBanner({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: 'neutral' | 'warning' | 'critical' | 'positive'
  icon: LucideIcon
  children: ReactNode
}) {
  const toneClass = {
    neutral: 'border-slate-200 bg-gradient-to-br from-slate-50 to-white',
    warning: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
    critical: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white',
    positive: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
  }[tone]
  const iconClass = {
    neutral: 'bg-slate-100 text-slate-600',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-rose-100 text-rose-700',
    positive: 'bg-emerald-100 text-emerald-700',
  }[tone]
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border p-3.5', toneClass)}>
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl', iconClass)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="text-sm font-medium leading-relaxed text-slate-700">{children}</p>
    </div>
  )
}

export function NetworkIntelligencePage() {
  const [uiState, setUiState] = useState(readNetworkIntelligenceUiState)
  const {
    preset,
    customStart,
    customEnd,
    activeWindow,
    riskBandFilter,
    ageFilter,
    splitterSearch,
    geoTab,
    selectedMatrixKey,
    mapCorporateOnly,
  } = uiState
  const setPreset = (value: IntelligenceDateRangePreset) =>
    setUiState((prev) => ({ ...prev, preset: value }))
  const setCustomStart = (value: string) =>
    setUiState((prev) => ({ ...prev, customStart: value }))
  const setCustomEnd = (value: string) =>
    setUiState((prev) => ({ ...prev, customEnd: value }))
  const setActiveWindow = (value: IntelligenceWindow) =>
    setUiState((prev) => ({ ...prev, activeWindow: value }))
  const setRiskBandFilter = (value: 'all' | 'critico' | 'alto' | 'moderado' | 'baixo') =>
    setUiState((prev) => ({ ...prev, riskBandFilter: value }))
  const setAgeFilter = (value: AgeFilter) =>
    setUiState((prev) => ({ ...prev, ageFilter: value }))
  const setSplitterSearch = (value: string) =>
    setUiState((prev) => ({ ...prev, splitterSearch: value }))
  const setGeoTab = (value: 'condominios' | 'ruas') =>
    setUiState((prev) => ({ ...prev, geoTab: value }))
  const setSelectedMatrixKey = (
    value:
      | 'altoImpactoAltaUrgencia'
      | 'altoImpactoBaixaUrgencia'
      | 'baixoImpactoAltaUrgencia'
      | 'baixoImpactoBaixaUrgencia'
      | null
      | ((
          prev:
            | 'altoImpactoAltaUrgencia'
            | 'altoImpactoBaixaUrgencia'
            | 'baixoImpactoAltaUrgencia'
            | 'baixoImpactoBaixaUrgencia'
            | null,
        ) =>
          | 'altoImpactoAltaUrgencia'
          | 'altoImpactoBaixaUrgencia'
          | 'baixoImpactoAltaUrgencia'
          | 'baixoImpactoBaixaUrgencia'
          | null),
  ) =>
    setUiState((prev) => ({
      ...prev,
      selectedMatrixKey:
        typeof value === 'function' ? value(prev.selectedMatrixKey) : value,
    }))
  const setMapCorporateOnly = (value: boolean | ((prev: boolean) => boolean)) =>
    setUiState((prev) => ({
      ...prev,
      mapCorporateOnly:
        typeof value === 'function' ? value(prev.mapCorporateOnly) : value,
    }))

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      NETWORK_INTELLIGENCE_UI_STATE_KEY,
      JSON.stringify(uiState),
    )
  }, [uiState])

  const customStartDate = customStart ? new Date(`${customStart}T00:00:00`) : null
  const customEndDate = customEnd ? new Date(`${customEnd}T23:59:59`) : null

  const {
    query,
    maintenanceQuery,
    networkStatsPreview,
    source,
    kpis,
    trends,
    areaPoints,
    massivaRecurrenceInsights,
    recurrenceCells,
    saturationCells,
    decisionKpis,
    riskRanking,
    impactUrgencyMatrix,
    topology,
    massivaRollup,
    massivaPeriodLinks,
    deltaReferenceLabel,
    lifecycleCohorts,
    lifecycleAlerts,
    maintenanceBySplitter,
    maintenanceTotals,
  } = useNetworkIntelligenceData(preset, customStartDate, customEndDate, mapCorporateOnly)

  const mapCorporateEmptyHint = useMemo(() => {
    if (!mapCorporateOnly || saturationCells.length > 0) return null
    if (trends.length === 0) return null
    return 'Com «só corporativo» ativo, nenhum splitter com cliente PJ entrou na amostra de tendência deste período com os filtros atuais. Desligue o filtro ou afrouxe período / busca.'
  }, [mapCorporateOnly, saturationCells.length, trends.length])

  /** Só skeleton “vazio” na primeira carga; com cache (Dashboard ou visita anterior) mostra dados logo. */
  const showFullSkeleton = query.fetchStatus === 'fetching' && query.dataUpdatedAt === 0
  const showBackgroundRefresh = query.isFetching && query.dataUpdatedAt > 0

  const intelligenceSnapshot = useMemo(() => {
    const folga = trends.filter((t) => t.currentUsagePercent < 70).length
    const atencao = trends.filter(
      (t) => t.currentUsagePercent >= 70 && t.currentUsagePercent < 95,
    ).length
    const critico = trends.filter((t) => t.currentUsagePercent >= 95).length

    const labelCounts = new Map<TrendLabel, number>()
    for (const l of TREND_LABEL_ORDER) labelCounts.set(l, 0)
    for (const t of trends) {
      labelCounts.set(t.label, (labelCounts.get(t.label) ?? 0) + 1)
    }
    const trendPieData = TREND_LABEL_ORDER.map((key) => ({
      key,
      name: TREND_PIE_LABEL[key],
      value: labelCounts.get(key) ?? 0,
    })).filter((d) => d.value > 0)

    const massivaAgg = {
      totalTickets: massivaRollup.distinctMassivaCount,
      openTickets: massivaRollup.openMassivasCount,
      closedTickets: massivaRollup.closedMassivasCount,
      affectedClientsTotal: massivaRollup.affectedClientsDistinctSum,
    }

    let topUsage: (typeof trends)[number] | null = null
    let topDelta: (typeof trends)[number] | null = null
    for (const t of trends) {
      if (!topUsage || t.currentUsagePercent > topUsage.currentUsagePercent) topUsage = t
      const currentDelta = deltaReferenceLabel === 'Δ7d' ? t.delta7d : t.delta30d
      const topDeltaValue = topDelta == null ? Number.NEGATIVE_INFINITY : deltaReferenceLabel === 'Δ7d' ? topDelta.delta7d : topDelta.delta30d
      if (!topDelta || currentDelta > topDeltaValue) topDelta = t
    }

    const topRanked = massivaRecurrenceInsights.ranking[0]
    const topMassiva = topRanked
      ? {
          code: topRanked.splitterCode,
          title: topRanked.splitterTitle,
          totalTickets: topRanked.distinctMassivas,
        }
      : null

    const geoTotal = trends.length
    const geoWithCoords = trends.filter((t) =>
      hasValidSplitterCoords(t.latitude, t.longitude),
    ).length
    const geoWithoutCoords = geoTotal - geoWithCoords

    return {
      folga,
      atencao,
      critico,
      trendPieData,
      massivaAgg,
      topUsage,
      topDelta,
      topMassiva,
      geoTotal,
      geoWithCoords,
      geoWithoutCoords,
    }
  }, [trends, massivaRollup, massivaRecurrenceInsights, deltaReferenceLabel])

  const mapGeoSnapshot = useMemo(() => {
    const sliceTotal = saturationCells.length
    const sliceWithCoords = saturationCells.filter((c) =>
      hasValidSplitterCoords(c.latitude, c.longitude),
    ).length
    return { sliceTotal, sliceWithCoords }
  }, [saturationCells])

  const maxRecurrence = Math.max(1, ...recurrenceCells.map((cell) => cell.count))

  const intelligencePeriodLabel = useMemo(
    () =>
      preset === 'custom' && customStart.trim() !== '' && customEnd.trim() !== ''
        ? `${customStart} → ${customEnd}`
        : presetButtonLabel(preset),
    [preset, customStart, customEnd],
  )

  const trendDeltaReference = deltaReferenceLabel === 'Δ30d' ? '30d' : '7d'

  const contextualRiskRanking = useMemo(() => {
    let rows = riskRanking
    if (ageFilter !== 'all') {
      rows = rows.filter((row) => {
        if (ageFilter === '0-1') return row.ageYears < 1
        if (ageFilter === '1-3') return row.ageYears >= 1 && row.ageYears < 3
        if (ageFilter === '3-5') return row.ageYears >= 3 && row.ageYears < 5
        return row.ageYears >= 5
      })
    }
    if (selectedMatrixKey) {
      rows = rows.filter((row) => matrixKeyForRiskRow(row) === selectedMatrixKey)
    }
    if (riskBandFilter !== 'all') {
      rows = rows.filter((row) => row.riskBand === riskBandFilter)
    }
    const q = splitterSearch.trim().toLowerCase()
    if (q !== '') {
      rows = rows.filter((row) => {
        const title = row.splitterTitle.trim().toLowerCase()
        return (
          row.splitterCode.toLowerCase().includes(q) ||
          title.includes(q) ||
          (row.oltCode ?? '').toLowerCase().includes(q) ||
          (row.oltDescription ?? '').toLowerCase().includes(q)
        )
      })
    }
    return rows
  }, [riskRanking, ageFilter, selectedMatrixKey, riskBandFilter, splitterSearch])

  const contextualOltDrilldown = useMemo(() => {
    const grouped = new Map<string, {
      oltCode: string
      oltDescription: string
      splitters: number
      criticalSplitters: number
      sumUsage: number
      sumDeltaReference: number
      sumAgeYears: number
      openTickets: number
      totalTickets: number
      affectedClientsTotal: number
    }>()
    for (const row of contextualRiskRanking) {
      const key = row.oltCode?.trim() || row.oltDescription?.trim() || 'SEM_OLT'
      const current = grouped.get(key) ?? {
        oltCode: row.oltCode?.trim() || 'SEM_OLT',
        oltDescription: row.oltDescription?.trim() || 'OLT não informada',
        splitters: 0,
        criticalSplitters: 0,
        sumUsage: 0,
        sumDeltaReference: 0,
        sumAgeYears: 0,
        openTickets: 0,
        totalTickets: 0,
        affectedClientsTotal: 0,
      }
      current.splitters += 1
      if (row.currentUsagePercent >= 95) current.criticalSplitters += 1
      current.sumUsage += row.currentUsagePercent
      current.sumDeltaReference += row.selectedDelta
      current.sumAgeYears += row.ageYears
      current.openTickets += row.openTickets
      current.totalTickets += row.totalTickets
      current.affectedClientsTotal += row.affectedClientsTotal
      grouped.set(key, current)
    }
    return [...grouped.values()]
      .map((entry) => ({
        oltCode: entry.oltCode,
        oltDescription: entry.oltDescription,
        splitters: entry.splitters,
        criticalSplitters: entry.criticalSplitters,
        avgUsagePercent: Number((entry.sumUsage / Math.max(1, entry.splitters)).toFixed(1)),
        avgDeltaReference: Number((entry.sumDeltaReference / Math.max(1, entry.splitters)).toFixed(2)),
        avgAgeYears: Number((entry.sumAgeYears / Math.max(1, entry.splitters)).toFixed(2)),
        openTickets: entry.openTickets,
        totalTickets: entry.totalTickets,
        affectedClientsTotal: entry.affectedClientsTotal,
      }))
      .sort((a, b) => b.criticalSplitters - a.criticalSplitters || b.avgUsagePercent - a.avgUsagePercent)
      .slice(0, 8)
  }, [contextualRiskRanking])

  const contextualGeoDrilldown = useMemo(() => {
    const tipoCounts = new Map<'CONDOMÍNIO' | 'UNIDADE' | 'SEM_CLASSIFICACAO', number>([
      ['CONDOMÍNIO', 0],
      ['UNIDADE', 0],
      ['SEM_CLASSIFICACAO', 0],
    ])
    const condos = new Map<string, { nome: string; splitters: number; massivaTickets: number }>()
    for (const row of contextualRiskRanking) {
      const tipo = row.tipoLocal ?? 'SEM_CLASSIFICACAO'
      tipoCounts.set(tipo, (tipoCounts.get(tipo) ?? 0) + 1)
      const condoName = row.nomeCondominio?.trim() ?? ''
      if (condoName !== '') {
        const c = condos.get(condoName) ?? { nome: condoName, splitters: 0, massivaTickets: 0 }
        c.splitters += 1
        c.massivaTickets += row.totalTickets
        condos.set(condoName, c)
      }
    }
    return {
      tipoLocal: [
        { key: 'CONDOMÍNIO', count: tipoCounts.get('CONDOMÍNIO') ?? 0 },
        { key: 'UNIDADE', count: tipoCounts.get('UNIDADE') ?? 0 },
        { key: 'SEM_CLASSIFICACAO', count: tipoCounts.get('SEM_CLASSIFICACAO') ?? 0 },
      ],
      topCondominios: [...condos.values()]
        .sort((a, b) => b.massivaTickets - a.massivaTickets || b.splitters - a.splitters)
        .slice(0, 6),
      topStreets: buildTopStreetsByNormalizedStreet(contextualRiskRanking),
    }
  }, [contextualRiskRanking])

  const contextualRegionalInsights = useMemo(() => {
    type Agg = {
      splitters: number
      criticalSplitters: number
      sumUsage: number
      sumDelta: number
      openTickets: number
      massivaTicketsTotal: number
      corporateCodes: Set<string>
    }
    const mk = (): Agg => ({
      splitters: 0,
      criticalSplitters: 0,
      sumUsage: 0,
      sumDelta: 0,
      openTickets: 0,
      massivaTicketsTotal: 0,
      corporateCodes: new Set<string>(),
    })
    const bump = (agg: Agg, row: IntelligenceRiskRankingRow) => {
      agg.splitters += 1
      if (row.currentUsagePercent >= 95) agg.criticalSplitters += 1
      agg.sumUsage += row.currentUsagePercent
      agg.sumDelta += row.selectedDelta
      agg.openTickets += row.openTickets
      agg.massivaTicketsTotal += row.totalTickets
      if (row.hasCorporateClients) agg.corporateCodes.add(row.splitterCode)
    }
    const finalize = (label: string, agg: Agg): RegionalInsightRow => {
      const n = agg.splitters
      return {
        label,
        splitters: n,
        criticalSplitters: agg.criticalSplitters,
        avgUsagePercent: Number((agg.sumUsage / Math.max(1, n)).toFixed(1)),
        avgDeltaReference: Number((agg.sumDelta / Math.max(1, n)).toFixed(2)),
        openTickets: agg.openTickets,
        massivaTicketsTotal: agg.massivaTicketsTotal,
        splittersWithCorporate: agg.corporateCodes.size,
        directive: regionalInsightDirective({
          splitters: n,
          criticalSplitters: agg.criticalSplitters,
          avgUsagePercent: Number((agg.sumUsage / Math.max(1, n)).toFixed(1)),
          avgDeltaReference: Number((agg.sumDelta / Math.max(1, n)).toFixed(2)),
          openTickets: agg.openTickets,
          massivaTicketsTotal: agg.massivaTicketsTotal,
          splittersWithCorporate: agg.corporateCodes.size,
        }),
      }
    }

    const byCity = new Map<string, Agg>()
    const byBairro = new Map<string, Agg>()
    for (const row of contextualRiskRanking) {
      const cityLabel = row.cityCadastro?.trim() ? row.cityCadastro.trim() : 'Sem cidade no cadastro'
      let cAgg = byCity.get(cityLabel)
      if (!cAgg) {
        cAgg = mk()
        byCity.set(cityLabel, cAgg)
      }
      bump(cAgg, row)

      const nh = row.neighborhoodCadastro?.trim()
      const bairroLabel = nh ? `${nh} · ${cityLabel}` : `Sem bairro · ${cityLabel}`
      let bAgg = byBairro.get(bairroLabel)
      if (!bAgg) {
        bAgg = mk()
        byBairro.set(bairroLabel, bAgg)
      }
      bump(bAgg, row)
    }

    const topCidades = [...byCity.entries()]
      .map(([label, agg]) => finalize(label, agg))
      .sort(
        (a, b) =>
          b.criticalSplitters - a.criticalSplitters ||
          b.avgUsagePercent - a.avgUsagePercent ||
          b.openTickets - a.openTickets,
      )
      .slice(0, 8)

    const topBairros = [...byBairro.entries()]
      .map(([label, agg]) => finalize(label, agg))
      .sort(
        (a, b) =>
          b.criticalSplitters - a.criticalSplitters ||
          b.massivaTicketsTotal - a.massivaTicketsTotal ||
          b.splitters - a.splitters,
      )
      .slice(0, 12)

    const splittersTotal = contextualRiskRanking.length
    const corpRows = contextualRiskRanking.filter((r) => r.hasCorporateClients)
    const splittersWithCorporate = corpRows.length
    const criticalAmongCorporate = corpRows.filter((r) => r.currentUsagePercent >= 95).length
    const avgUsageAmongCorporate =
      corpRows.length > 0
        ? Number(
            (corpRows.reduce((s, r) => s + r.currentUsagePercent, 0) / corpRows.length).toFixed(1),
          )
        : 0
    const openMassivasAmongCorporate = corpRows.reduce((s, r) => s + r.openTickets, 0)
    const corporateMassivaTickets = corpRows.reduce((s, r) => s + r.totalTickets, 0)

    return {
      topCidades,
      topBairros,
      corporateSnapshot: {
        splittersTotal,
        splittersWithCorporate,
        criticalAmongCorporate,
        avgUsageAmongCorporate,
        openMassivasAmongCorporate,
        corporateMassivaTickets,
        directive: corporateRegionalInsightDirective({
          splittersTotal,
          splittersWithCorporate,
          criticalAmongCorporate,
          avgUsageAmongCorporate,
          openMassivasAmongCorporate,
          corporateMassivaTickets,
        }),
      },
    }
  }, [contextualRiskRanking])

  const contextualLifecycle = useMemo(() => {
    const rows = contextualRiskRanking
    const codeToBucket = new Map(
      rows.map((row) => [row.splitterCode, toLifecycleBucket(row.ageYears)] as const),
    )
    const distinctMassivasByBucket = countDistinctMassivasByLifecycleBucket(
      massivaPeriodLinks,
      codeToBucket,
    )
    const kpis = {
      avgAgeYears:
        rows.length > 0
          ? Number((rows.reduce((sum, row) => sum + row.ageYears, 0) / rows.length).toFixed(2))
          : 0,
      agedSplitters: rows.filter((row) => row.ageYears >= 5).length,
      agedCriticalSplitters: rows.filter((row) => row.ageYears >= 5 && row.currentUsagePercent >= 95).length,
      agedPressurePercent:
        rows.length > 0
          ? Number(
              ((rows.filter((row) => row.ageYears >= 5 && row.currentUsagePercent >= 85).length / rows.length) * 100).toFixed(1),
            )
          : 0,
    }

    const bucketOrder: Array<'0-1' | '1-3' | '3-5' | '5+'> = ['0-1', '1-3', '3-5', '5+']
    const buckets = bucketOrder.map((bucket) => {
      const scoped = rows.filter((row) =>
        bucket === '0-1'
          ? row.ageYears < 1
          : bucket === '1-3'
            ? row.ageYears >= 1 && row.ageYears < 3
            : bucket === '3-5'
              ? row.ageYears >= 3 && row.ageYears < 5
              : row.ageYears >= 5,
      )
      return {
        bucket,
        splitters: scoped.length,
        avgUsagePercent:
          scoped.length > 0
            ? Number((scoped.reduce((sum, row) => sum + row.currentUsagePercent, 0) / scoped.length).toFixed(1))
            : 0,
        avgDeltaReference:
          scoped.length > 0
            ? Number((scoped.reduce((sum, row) => sum + row.selectedDelta, 0) / scoped.length).toFixed(2))
            : 0,
        massivaLinkages: scoped.reduce((sum, row) => sum + row.totalTickets, 0),
        distinctMassivas: distinctMassivasByBucket[bucket] ?? 0,
      }
    })

    const usageBands: Array<'<70' | '70-94' | '95+'> = ['<70', '70-94', '95+']
    const heatmap = bucketOrder.flatMap((bucket) =>
      usageBands.map((usageBand) => {
        const count = rows.filter((row) => {
          const bucketMatch =
            bucket === '0-1'
              ? row.ageYears < 1
              : bucket === '1-3'
                ? row.ageYears >= 1 && row.ageYears < 3
                : bucket === '3-5'
                  ? row.ageYears >= 3 && row.ageYears < 5
                  : row.ageYears >= 5
          const usageMatch =
            usageBand === '95+'
              ? row.currentUsagePercent >= 95
              : usageBand === '70-94'
                ? row.currentUsagePercent >= 70 && row.currentUsagePercent < 95
                : row.currentUsagePercent < 70
          return bucketMatch && usageMatch
        }).length
        return { bucket, usageBand, count }
      }),
    )

    return { kpis, buckets, heatmap }
  }, [contextualRiskRanking, massivaPeriodLinks])

  const contextualMaintenanceRows = useMemo(() => {
    const term = splitterSearch.trim().toLowerCase()
    if (term === '') return maintenanceBySplitter
    return maintenanceBySplitter.filter((row) => {
      return (
        row.splitterCode.toLowerCase().includes(term) ||
        row.splitterTitle.toLowerCase().includes(term) ||
        row.accessPointCode.toLowerCase().includes(term)
      )
    })
  }, [maintenanceBySplitter, splitterSearch])

  const maintenanceOpenRate = useMemo(() => {
    if (maintenanceTotals.totalMaintenances <= 0) return 0
    return Number(
      ((maintenanceTotals.openMaintenances / maintenanceTotals.totalMaintenances) * 100).toFixed(1),
    )
  }, [maintenanceTotals.openMaintenances, maintenanceTotals.totalMaintenances])

  // ── Narrativas dinâmicas (storytelling) das abas Risco / Ciclo de vida / Manutenção ──

  const riskInsight = useMemo<{ tone: 'critical' | 'warning' | 'neutral'; text: string } | null>(() => {
    const top = contextualRiskRanking[0]
    if (!top) return null
    let text = `Prioridade nº1: ${top.splitterTitle || top.splitterCode}`
    if (top.oltCode) text += ` (OLT ${top.oltCode})`
    text += ` — score ${top.riskScore.toFixed(1)}, ${top.currentUsagePercent.toFixed(1)}% de uso`
    if (top.openTickets > 0) text += `, ${top.openTickets} massiva(s) aberta(s)`
    text += '.'
    if (top.etaTo95Days != null) {
      text += ` No ritmo atual, satura em ~${top.etaTo95Days} ${top.etaTo95Days === 1 ? 'dia' : 'dias'}.`
    }
    const tone = top.riskBand === 'critico' ? 'critical' : top.riskBand === 'alto' ? 'warning' : 'neutral'
    return { tone, text }
  }, [contextualRiskRanking])

  const riskOltConcentration = useMemo<string | null>(() => {
    const topN = contextualRiskRanking.slice(0, 12)
    if (topN.length < 3) return null
    const byOlt = new Map<string, { label: string; count: number }>()
    for (const row of topN) {
      const key = row.oltCode?.trim() || row.oltDescription?.trim()
      if (!key) continue
      const label = row.oltDescription?.trim() || row.oltCode?.trim() || key
      const cur = byOlt.get(key) ?? { label, count: 0 }
      cur.count += 1
      byOlt.set(key, cur)
    }
    let worst: { label: string; count: number } | null = null
    for (const v of byOlt.values()) if (!worst || v.count > worst.count) worst = v
    if (!worst || worst.count < 3) return null
    return `Concentração: ${worst.label} responde por ${worst.count} dos ${topN.length} maiores riscos — investigar transmissão/obra na origem.`
  }, [contextualRiskRanking])

  const lifecycleInsight = useMemo<{ tone: 'critical' | 'warning' | 'positive'; text: string } | null>(() => {
    if (contextualRiskRanking.length === 0) return null
    const k = contextualLifecycle.kpis
    const fmt1 = (n: number) => n.toFixed(1).replace('.', ',')
    if (k.agedCriticalSplitters === 0) {
      return {
        tone: 'positive',
        text: `Nenhum equipamento 5+ anos saturado no recorte — risco de ciclo de vida sob controle. Idade média ${fmt1(k.avgAgeYears)} anos.`,
      }
    }
    const aged = contextualRiskRanking.filter((r) => r.ageYears >= 5)
    const worst = (aged.length > 0 ? aged : contextualRiskRanking)
      .slice()
      .sort((a, b) => b.ageYears - a.ageYears || b.currentUsagePercent - a.currentUsagePercent)[0]
    let text = `${k.agedCriticalSplitters} equipamento(s) com 5+ anos já saturados (${fmt1(k.agedPressurePercent)}% da base sob pressão envelhecida). Idade média ${fmt1(k.avgAgeYears)} anos.`
    if (worst) {
      text += ` Comece por ${worst.splitterTitle || worst.splitterCode}: ${fmt1(worst.ageYears)} anos e ${worst.currentUsagePercent.toFixed(1)}% de uso.`
    }
    return { tone: k.agedPressurePercent >= 20 ? 'critical' : 'warning', text }
  }, [contextualLifecycle.kpis, contextualRiskRanking])

  const lifecycleHeatmapInsight = useMemo<string | null>(() => {
    const cell = contextualLifecycle.heatmap.find((c) => c.bucket === '5+' && c.usageBand === '95+')
    if (!cell || cell.count === 0) return null
    return `${cell.count} splitter(s) com 5+ anos E ≥95% de uso — prioridade máxima de troca.`
  }, [contextualLifecycle.heatmap])

  const maintenanceInsight = useMemo<{ tone: 'warning' | 'neutral'; text: string } | null>(() => {
    if (contextualMaintenanceRows.length === 0) return null
    const top = contextualMaintenanceRows.reduce((a, b) =>
      b.totalMaintenances > a.totalMaintenances ? b : a,
    )
    return {
      tone: top.openMaintenances > 0 ? 'warning' : 'neutral',
      text: `Equipamento mais reincidente: ${top.splitterTitle || top.splitterCode} — ${top.totalMaintenances} manutenção(ões), ${top.openMaintenances} em aberto, afetando ${top.uniqueClients} cliente(s).`,
    }
  }, [contextualMaintenanceRows])

  const maintenanceFailureMix = useMemo(() => {
    let rompimento = 0
    let troca = 0
    for (const r of contextualMaintenanceRows) {
      rompimento += r.rompimentoCount
      troca += r.trocaFlatCount
    }
    const known = rompimento + troca
    if (known === 0) return null
    const rompPct = Math.round((rompimento / known) * 100)
    return {
      rompimento,
      troca,
      rompPct,
      trocaPct: 100 - rompPct,
      dominant: rompimento >= troca ? 'rompimento' : 'troca de flat',
    }
  }, [contextualMaintenanceRows])

  const hasActiveFilters =
    selectedMatrixKey !== null || riskBandFilter !== 'all' || ageFilter !== 'all' || splitterSearch.trim() !== ''

  function clearAllFilters() {
    setSelectedMatrixKey(null)
    setRiskBandFilter('all')
    setAgeFilter('all')
    setSplitterSearch('')
  }

  return (
    <div className="min-w-0 space-y-5">
      <AppPageHeader
        icon={ChartSpline}
        badge="Inteligência de rede"
        title="Painel da rede"
        description="Cruza ocupação de portas, tendência por splitter, massivas e, nas outras abas, risco, geografia e manutenções. Escolha o período abaixo e use busca e filtros para focar OLT, faixa de risco ou idade; os números respondem sempre à mesma janela."
        trailing={
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            {showBackgroundRefresh ? (
              <span className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-amber-200/80 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-neutral-800 shadow-sm">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-700" aria-hidden />
                <span className="text-[10px] font-bold normal-case text-neutral-600">Atualizando dados...</span>
              </span>
            ) : (
              <span />
            )}
            <div className="relative hidden h-[8.5rem] w-[17rem] self-center overflow-hidden xl:block">
              <div
                aria-hidden
                className="absolute right-[-5%] top-[-8%] h-[120%] w-[110%] bg-contain bg-right bg-no-repeat opacity-100 saturate-105"
                style={{ backgroundImage: "url('/isa-network-header.png')" }}
              />
            </div>
          </div>
        }
      />

      <section className="rounded-2xl border border-white/45 bg-white/70 p-3 shadow-md shadow-amber-500/10 backdrop-blur-xl md:p-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Período
            </span>
            <DateRangePresetButtons
              preset={preset}
              onPresetChange={setPreset}
              customStart={customStart}
              customEnd={customEnd}
              onCustomStartChange={setCustomStart}
              onCustomEndChange={setCustomEnd}
            />
          </div>
          <div className="min-w-0 flex-1 lg:max-w-none">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:text-right">
              Aba
            </p>
            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:thin] lg:flex lg:justify-end">
              <div className="inline-flex items-center gap-1.5 lg:flex-wrap lg:justify-end">
                {INTELLIGENCE_TAB_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveWindow(item.id)}
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition sm:px-3 sm:py-2 sm:text-xs',
                      activeWindow === item.id
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/25'
                        : 'bg-white/80 text-slate-600 hover:bg-amber-50 hover:text-amber-700',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200/40 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            value={splitterSearch}
            onChange={(e) => setSplitterSearch(e.target.value)}
            placeholder="Buscar splitter/OLT..."
            className="w-full rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-xs text-slate-700 sm:w-48 md:w-52"
          />
          <select
            value={riskBandFilter}
            onChange={(e) =>
              setRiskBandFilter(e.target.value as 'all' | 'critico' | 'alto' | 'moderado' | 'baixo')
            }
            className="w-full rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-xs text-slate-700 sm:w-auto"
          >
            <option value="all">Risco: todos</option>
            <option value="critico">Risco crítico</option>
            <option value="alto">Risco alto</option>
            <option value="moderado">Risco moderado</option>
            <option value="baixo">Risco baixo</option>
          </select>
          <select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value as AgeFilter)}
            className="w-full rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-xs text-slate-700 sm:w-auto"
          >
            <option value="all">Idade: todas</option>
            <option value="0-1">Idade: 0-1 ano</option>
            <option value="1-3">Idade: 1-3 anos</option>
            <option value="3-5">Idade: 3-5 anos</option>
            <option value="5+">Idade: 5+ anos</option>
          </select>
          <button
            type="button"
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
            className={cn(
              'rounded-lg border px-2 py-1.5 text-xs font-bold transition sm:ml-auto',
              hasActiveFilters
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400',
            )}
          >
            Limpar filtros
          </button>
        </div>

        <details className="mt-2 border-t border-slate-200/40 pt-2">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800">
              Ajuda: período, filtros e o que esta aba mostra
            </span>
          </summary>
          <div className="mt-2 space-y-2 rounded-lg border border-white/50 bg-white/50 px-3 py-2 text-[11px] leading-relaxed text-slate-700">
            <p>
              Todo o painel usa a mesma janela de datas. Em{' '}
              <span className="font-semibold">Personalizado</span>, defina início e fim inclusivos.
            </p>
            <p>
              <span className="font-bold text-slate-800">Esta aba:</span> {TAB_INTRO[activeWindow]}
            </p>
          </div>
        </details>
      </section>

      <details className="group rounded-xl border border-amber-200/80 bg-amber-50/80 text-[11px] text-amber-950 shadow-sm">
        <summary className="cursor-pointer list-none px-3 py-2 font-semibold text-amber-950 [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-amber-300/80 underline-offset-2 group-open:no-underline">
            Como lemos ranking, score e matriz impacto × urgência
          </span>
        </summary>
        <div className="space-y-1.5 border-t border-amber-200/60 px-3 pb-3 pt-2 text-amber-900/95">
          <p className="font-semibold">
            Base do ranking: <span className="font-black">{deltaReferenceLabel}</span>
            <span className="font-normal text-amber-800/95">
              {' '}
              (variação de ocupação em 7 ou 30 dias, conforme o período escolhido)
            </span>
          </p>
          <p>
            Score, deltas das tabelas e séries temporais usam a mesma janela do seletor de datas. Na matriz impacto ×
            urgência: <span className="font-semibold">impacto alto</span> = ≥4 massivas ligadas ao splitter ou alguma
            massiva ainda aberta; <span className="font-semibold">urgência alta</span> = ocupação ≥85%, ou {deltaReferenceLabel} ≥5
            pontos percentuais, ou massivas ainda abertas.
          </p>
        </div>
      </details>

      {showFullSkeleton && networkStatsPreview ? (
        <div
          className="rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <p className="flex items-center gap-2 font-bold text-amber-900">
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            Carregando tendências, massivas e mapa por splitter…
          </p>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-amber-900/85">
            Indicadores gerais da rede já disponíveis:{' '}
            <span className="font-bold tabular-nums">
              {(() => {
                const pct = previewNetworkCapacityPercent(networkStatsPreview)
                return pct == null ? '—' : `${pct.toFixed(1)}%`
              })()}
            </span>{' '}
            ocupação (portas) ·{' '}
            <span className="font-semibold tabular-nums">
              {networkStatsPreview.activeSplitters.toLocaleString('pt-BR')}
            </span>{' '}
            equipamentos ·{' '}
            <span className="font-semibold tabular-nums">
              {networkStatsPreview.onlineClients.toLocaleString('pt-BR')}
            </span>{' '}
            portas ocupadas ·{' '}
            <span className="font-semibold tabular-nums">
              {networkStatsPreview.oltCount.toLocaleString('pt-BR')}
            </span>{' '}
            OLTs.
          </p>
        </div>
      ) : null}

      {showFullSkeleton ? <IntelligencePanelLoadingSkeleton /> : null}

      {query.isError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          Falha ao carregar dados de inteligência. O fallback mock deve assumir automaticamente no próximo ciclo.
        </section>
      ) : null}

      {!showFullSkeleton && kpis && activeWindow === 'visao-geral' ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-4 lg:grid-cols-2"
        >
          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Saturação no período
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">
              {kpis.totalPortCapacity > 0 ? (
                <>
                  {(kpis.overallOccupancyPercent ?? 0).toFixed(1)}%
                  <span className="ml-1.5 text-sm font-semibold text-slate-500">ocupação geral (rede)</span>
                </>
              ) : (
                <>
                  <span className="text-lg font-bold text-slate-600">—</span>
                  <span className="ml-1.5 text-sm font-semibold text-slate-500">ocupação geral (rede)</span>
                </>
              )}
            </p>
            {kpis.totalPortCapacity > 0 ? (
              <>
                <div
                  className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-slate-200/80"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, kpis.overallOccupancyPercent ?? 0)}
                  aria-label="Ocupação da rede em relação à capacidade total de portas"
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500 ease-out',
                      networkCapacityBarClass(kpis.overallOccupancyPercent ?? 0),
                    )}
                    style={{
                      width: `${Math.min(100, Math.max(0, kpis.overallOccupancyPercent ?? 0))}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs tabular-nums text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {kpis.occupiedPorts.toLocaleString('pt-BR')}
                  </span>{' '}
                  de{' '}
                  <span className="font-semibold text-slate-800">
                    {kpis.totalPortCapacity.toLocaleString('pt-BR')}
                  </span>{' '}
                  portas (capacidade somada no catálogo)
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Percentual = portas ocupadas ÷ portas totais no snapshot (soma da capacidade dos splitters), não a média
                  aritmética dos percentuais por equipamento abaixo.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Ocupação por capacidade total de portas ficará disponível após o backend publicar a soma da capacidade do
                catálogo junto às demais estatísticas.
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">
              {trends.length} splitter{trends.length === 1 ? '' : 's'} com histórico de tendência capturado neste
              intervalo
            </p>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              Contagem de splitters pela <span className="font-semibold text-slate-600">ocupação atual de portas</span>{" "}
              (não pela tendência): verde folga, âmbar atenção, vermelho saturado.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-emerald-50/90 px-2 py-3 text-center ring-1 ring-emerald-200/80">
                <p className="text-2xl font-black tabular-nums text-emerald-800">{intelligenceSnapshot.folga}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/90">&lt; 70%</p>
                <p className="text-[9px] font-medium text-emerald-700/70">folga</p>
              </div>
              <div className="rounded-2xl bg-amber-50/90 px-2 py-3 text-center ring-1 ring-amber-200/80">
                <p className="text-2xl font-black tabular-nums text-amber-900">{intelligenceSnapshot.atencao}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/90">70–94%</p>
                <p className="text-[9px] font-medium text-amber-800/70">atenção</p>
              </div>
              <div className="rounded-2xl bg-rose-50/90 px-2 py-3 text-center ring-1 ring-rose-200/80">
                <p className="text-2xl font-black tabular-nums text-rose-800">{intelligenceSnapshot.critico}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-800/90">≥ 95%</p>
                <p className="text-[9px] font-medium text-rose-800/70">crítico</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Distribuição de tendência
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Cada fatia é quantos splitters receberam o rótulo operacional (comparando ocupação atual com movimento
              recente). Passe o mouse na fatia para ver quantidade e percentual. Verde = estável; âmbar = crescimento;
              ciano = queda; vermelho = quase saturando.
            </p>
            <div className="mt-2 h-56">
              {intelligenceSnapshot.trendPieData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                  Sem splitters com tendência neste período.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={intelligenceSnapshot.trendPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={62}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {intelligenceSnapshot.trendPieData.map((entry) => (
                        <Cell key={entry.key} fill={TREND_PIE_COLOR[entry.key]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={(props) => (
                        <TrendPieTooltip
                          active={props.active}
                          payload={props.payload as TrendPieTooltipProps['payload']}
                          totalSplitters={trends.length}
                        />
                      )}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Massivas no período</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Contagem <span className="font-semibold text-slate-700">distinta</span> de ocorrências (massivas) com
              vínculo a algum splitter do cadastro, após o filtro de data por abertura.{" "}
              <span className="font-semibold text-slate-700">Afetados</span> é o total informado no cadastro da massiva,
              somado uma vez por ocorrência — não por equipamento.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Massivas (ún.)</dt>
                <dd className="mt-0.5 text-xl font-black tabular-nums text-slate-900">
                  {intelligenceSnapshot.massivaAgg.totalTickets.toLocaleString('pt-BR')}
                </dd>
              </div>
              <div className="rounded-xl bg-amber-50/80 px-3 py-2.5 ring-1 ring-amber-200/70">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-900/80">Abertas</dt>
                <dd className="mt-0.5 text-xl font-black tabular-nums text-amber-950">
                  {intelligenceSnapshot.massivaAgg.openTickets.toLocaleString('pt-BR')}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Fechadas</dt>
                <dd className="mt-0.5 text-xl font-black tabular-nums text-slate-900">
                  {intelligenceSnapshot.massivaAgg.closedTickets.toLocaleString('pt-BR')}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Afetados</dt>
                <dd className="mt-0.5 text-xl font-black tabular-nums text-slate-900">
                  {intelligenceSnapshot.massivaAgg.affectedClientsTotal.toLocaleString('pt-BR')}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Destaques</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Três campeões no recorte: maior ocupação atual; maior {deltaReferenceLabel} (mudança de ocupação em 7 ou 30
              dias); mais tickets de massiva registrados.
            </p>
            <ul className="mt-3 space-y-3">
              <li className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Maior ocupação</p>
                {intelligenceSnapshot.topUsage ? (
                  <>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                      {intelligenceSnapshot.topUsage.splitterTitle.trim() ||
                        intelligenceSnapshot.topUsage.splitterCode}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">{intelligenceSnapshot.topUsage.splitterCode}</p>
                    <p className="mt-1 text-xs font-black tabular-nums text-amber-700">
                      {intelligenceSnapshot.topUsage.currentUsagePercent.toFixed(1)}% uso
                    </p>
                    <Link
                      to={`/splitters/${encodeURIComponent(intelligenceSnapshot.topUsage.splitterCode)}`}
                      className="mt-1 inline-block text-[11px] font-bold text-amber-700 underline-offset-2 hover:underline"
                    >
                      Abrir splitter
                    </Link>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">—</p>
                )}
              </li>
              <li className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Maior {deltaReferenceLabel}</p>
                {intelligenceSnapshot.topDelta ? (
                  <>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                      {intelligenceSnapshot.topDelta.splitterTitle.trim() ||
                        intelligenceSnapshot.topDelta.splitterCode}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">{intelligenceSnapshot.topDelta.splitterCode}</p>
                    <p className="mt-1 text-xs font-black tabular-nums text-amber-700">
                      {(deltaReferenceLabel === 'Δ7d'
                        ? intelligenceSnapshot.topDelta.delta7d
                        : intelligenceSnapshot.topDelta.delta30d) >= 0
                        ? '+'
                        : ''}
                      {formatDeltaPp(
                        deltaReferenceLabel === 'Δ7d'
                          ? intelligenceSnapshot.topDelta.delta7d
                          : intelligenceSnapshot.topDelta.delta30d,
                      )}{' '}
                      no período
                    </p>
                    <Link
                      to={`/splitters/${encodeURIComponent(intelligenceSnapshot.topDelta.splitterCode)}`}
                      className="mt-1 inline-block text-[11px] font-bold text-amber-700 underline-offset-2 hover:underline"
                    >
                      Abrir splitter
                    </Link>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">—</p>
                )}
              </li>
              <li className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Mais massivas</p>
                {intelligenceSnapshot.topMassiva ? (
                  <>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                      {intelligenceSnapshot.topMassiva.title || intelligenceSnapshot.topMassiva.code}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">{intelligenceSnapshot.topMassiva.code}</p>
                    <p className="mt-1 text-xs font-black tabular-nums text-amber-700">
                      {intelligenceSnapshot.topMassiva.totalTickets} ticket
                      {intelligenceSnapshot.topMassiva.totalTickets === 1 ? '' : 's'}
                    </p>
                    <Link
                      to={`/splitters/${encodeURIComponent(intelligenceSnapshot.topMassiva.code)}`}
                      className="mt-1 inline-block text-[11px] font-bold text-amber-700 underline-offset-2 hover:underline"
                    >
                      Abrir splitter
                    </Link>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">—</p>
                )}
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 shrink-0 rounded-xl bg-amber-100 p-2 text-amber-700">
                <MapPin size={16} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Cobertura de dados (GPS)
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Splitters com tendência no intervalo e quantos têm latitude/longitude válidas no cadastro (BFF).
                </p>
              </div>
            </div>
            <dl className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <div className="rounded-xl bg-slate-50/90 px-3 py-2 text-center ring-1 ring-slate-200/80 sm:min-w-[5.5rem]">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Com tendência</dt>
                <dd className="text-lg font-black tabular-nums text-slate-900">
                  {intelligenceSnapshot.geoTotal.toLocaleString('pt-BR')}
                </dd>
              </div>
              <div className="rounded-xl bg-emerald-50/90 px-3 py-2 text-center ring-1 ring-emerald-200/80 sm:min-w-[5.5rem]">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-emerald-800/90">Com GPS</dt>
                <dd className="text-lg font-black tabular-nums text-emerald-900">
                  {intelligenceSnapshot.geoWithCoords.toLocaleString('pt-BR')}
                </dd>
              </div>
              <div className="rounded-xl bg-amber-50/90 px-3 py-2 text-center ring-1 ring-amber-200/80 sm:min-w-[5.5rem]">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-amber-900/80">Sem GPS</dt>
                <dd className="text-lg font-black tabular-nums text-amber-950">
                  {intelligenceSnapshot.geoWithoutCoords.toLocaleString('pt-BR')}
                </dd>
              </div>
            </dl>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 lg:col-span-2">
            <span className="font-semibold text-slate-600">Mapa de saturação:</span> até 80 pontos no período, misturando faixas
            crítico / atenção / folga quando existirem (evita só críticos); vagas restantes pelos maiores usos. Neste intervalo:{' '}
            {mapGeoSnapshot.sliceTotal.toLocaleString('pt-BR')} no recorte; com GPS no mapa:{' '}
            {mapGeoSnapshot.sliceWithCoords.toLocaleString('pt-BR')}.
          </p>

          {decisionKpis ? (
            <div className="lg:col-span-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Indicadores de decisão (mesmo período e filtros)
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Risco crítico</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-rose-800">
                  {decisionKpis.criticalSplitters.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] leading-snug text-rose-700/90">
                  Splitters em uso de portas ≥95% — prioridade máxima de capacidade ou remanejamento.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Crescimento forte</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-amber-900">
                  {decisionKpis.growthSplitters.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] leading-snug text-amber-800/90">
                  Subiram pelo menos 5 pontos percentuais de ocupação no {deltaReferenceLabel} — checar tendência antes de
                  virar crítico.
                </p>
              </div>
              <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">Massivas em risco alto</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-violet-900">
                  {decisionKpis.highRiskMassivaTickets.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] leading-snug text-violet-800/90">
                  Soma de vínculos “massiva × splitter” (tickets) nos equipamentos em risco alto ou crítico; a mesma
                  massiva pode contar em mais de um splitter.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Pressão operacional</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-sky-900">
                  {decisionKpis.attentionSharePercent.toFixed(1)}%
                </p>
                <p className="text-[11px] leading-snug text-sky-800/90">
                  Participação dos splitters que estão críticos OU em crescimento forte — mostra quanto da base exige
                  atenção simultânea.
                </p>
              </div>
              </div>
            </div>
          ) : null}
        </motion.section>
      ) : null}

      {showFullSkeleton ? <IntelligenceLowerDashboardSkeleton /> : null}

      {!showFullSkeleton ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeWindow}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
      {(activeWindow === 'risco' || activeWindow === 'ciclo-vida') ? (
        <>
      {activeWindow === 'risco' ? (
        <>
      {riskInsight ? (
        <div className="space-y-2">
          <InsightBanner tone={riskInsight.tone} icon={AlertTriangle}>
            {riskInsight.text}
          </InsightBanner>
          {riskOltConcentration ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] font-semibold text-amber-900">
              {riskOltConcentration}
            </p>
          ) : null}
        </div>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.03 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Ranking de risco por splitter</h2>
              <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">
                Ordenação pelo score composto (maior = mais prioridade). Colunas: uso atual de portas;{" "}
                {deltaReferenceLabel} (quanto a ocupação mudou); massivas abertas vs total no período (por splitter)
                somados nas massivas. Clique na matriz ao lado para filtrar este quadro por quadrante.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-slate-500 shrink-0">Faixas de cor = banda de risco do score</p>
              {selectedMatrixKey ? (
                <button
                  type="button"
                  onClick={() => setSelectedMatrixKey(null)}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100"
                >
                  Limpar filtro da matriz
                </button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2 sm:hidden">
            {contextualRiskRanking.slice(0, 10).map((row) => (
              <article key={row.splitterCode} className="rounded-xl bg-slate-50/90 p-2.5 ring-1 ring-slate-200/70">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{row.splitterTitle || row.splitterCode}</p>
                    <p className="font-mono text-[10px] text-slate-500">{row.splitterCode}</p>
                  </div>
                  <span className={cn(
                    'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    row.riskBand === 'critico'
                      ? 'bg-rose-100 text-rose-800'
                      : row.riskBand === 'alto'
                        ? 'bg-amber-100 text-amber-900'
                        : row.riskBand === 'moderado'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-emerald-100 text-emerald-800',
                  )}>
                    Score {row.riskScore.toFixed(1)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <p><span className="font-semibold">Uso:</span> {row.currentUsagePercent.toFixed(1)}%</p>
                  <p>
                    <span className="font-semibold">{deltaReferenceLabel}:</span>{' '}
                    <span title={PP_TOOLTIP_DELTA_PERIOD(deltaReferenceLabel)}>{formatDeltaPp(row.selectedDelta)}</span>
                  </p>
                  <p><span className="font-semibold">Massivas:</span> {row.openTickets}/{row.totalTickets}</p>
                  {row.etaTo95Days != null ? (
                    <p className="font-bold text-rose-600">Satura em ~{row.etaTo95Days}d</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Splitter</th>
                  <th className="px-2 py-2" title="Índice composto de prioridade (quanto maior, mais urgente atuar)">
                    Score
                  </th>
                  <th className="px-2 py-2" title="Percentual de portas de saída em uso neste splitter">
                    Uso
                  </th>
                  <th
                    className="px-2 py-2"
                    title={PP_TOOLTIP_DELTA_PERIOD(deltaReferenceLabel)}
                  >
                    {deltaReferenceLabel} (pp)
                  </th>
                  <th className="px-2 py-2" title="Tickets abertos no período / total histórico considerado">
                    Massivas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contextualRiskRanking.slice(0, 12).map((row) => (
                  <tr key={row.splitterCode} className="hover:bg-slate-50/70">
                    <td className="px-2 py-2">
                      <p className="truncate font-semibold text-slate-900">{row.splitterTitle || row.splitterCode}</p>
                      <p className="font-mono text-[10px] text-slate-500">{row.splitterCode}</p>
                    </td>
                    <td className="px-2 py-2">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold',
                        row.riskBand === 'critico'
                          ? 'bg-rose-100 text-rose-800'
                          : row.riskBand === 'alto'
                            ? 'bg-amber-100 text-amber-900'
                            : row.riskBand === 'moderado'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-emerald-100 text-emerald-800',
                      )}>
                        {row.riskScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-semibold tabular-nums text-slate-800">{row.currentUsagePercent.toFixed(1)}%</td>
                    <td
                      className="px-2 py-2 font-semibold tabular-nums text-slate-800"
                      title={PP_TOOLTIP_DELTA_PERIOD(deltaReferenceLabel)}
                    >
                      {formatDeltaPp(row.selectedDelta)}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-slate-700">
                      {row.openTickets}/{row.totalTickets}
                      {row.etaTo95Days != null ? (
                        <span className="mt-0.5 block text-[10px] font-bold text-rose-600">
                          satura em ~{row.etaTo95Days}d
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Matriz impacto × urgência</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Cada quadrante conta splitters no filtro atual. Alto impacto: várias massivas ligadas ao equipamento ou
            massiva ainda aberta. Alta urgência: uso elevado, forte variação de ocupação ou massivas abertas. O quadrante
            superior esquerdo costuma ser o primeiro a tratar.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {impactUrgencyMatrix.map((cell) => (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedMatrixKey((prev) => (prev === cell.key ? null : cell.key))}
                className={cn(
                  'rounded-xl bg-slate-50/90 px-2.5 py-2 text-left ring-1 transition hover:bg-amber-50',
                  selectedMatrixKey === cell.key
                    ? 'ring-amber-400 bg-amber-50'
                    : cell.key === 'altoImpactoAltaUrgencia' && cell.count > 0
                      ? 'ring-rose-300 bg-rose-50/50'
                      : 'ring-slate-200/70',
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{cell.label}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{cell.count}</p>
                {cell.splitters[0] ? (
                  <p className="truncate text-[11px] text-slate-600">
                    ex.: {cell.splitters[0].splitterTitle || cell.splitters[0].splitterCode}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
          {(() => {
            const action = impactUrgencyMatrix.find((c) => c.key === 'altoImpactoAltaUrgencia')
            if (action && action.count > 0) {
              return (
                <p className="mt-2 text-[11px] font-semibold text-rose-700">
                  Ação imediata: {action.count} splitter(s) em alto impacto × alta urgência
                  {action.splitters[0]
                    ? ` — comece por ${action.splitters[0].splitterTitle || action.splitters[0].splitterCode}`
                    : ''}
                  . Clique para filtrar o ranking.
                </p>
              )
            }
            return (
              <p className="mt-2 text-[11px] text-slate-500">
                Clique em um quadrante para filtrar ranking e drill-down de forma contextual.
              </p>
            )
          })()}
        </motion.article>
      </section>
        </>
      ) : null}

      {activeWindow === 'ciclo-vida' ? (
        <>
      {lifecycleInsight ? (
        <InsightBanner tone={lifecycleInsight.tone} icon={AlertTriangle}>
          {lifecycleInsight.text}
        </InsightBanner>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Risco por ciclo de vida</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Idade calculada a partir da data de implantação no cadastro. Combine com uso e massivas para decidir troca
            preventiva ou reforço de porta.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50/90 px-2 py-2 ring-1 ring-slate-200/70">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Idade média</p>
              <p className="text-xl font-black tabular-nums text-slate-900">{contextualLifecycle.kpis.avgAgeYears.toFixed(2)} anos</p>
            </div>
            <div className="rounded-xl bg-slate-50/90 px-2 py-2 ring-1 ring-slate-200/70">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Splitters 5+ anos</p>
              <p className="text-xl font-black tabular-nums text-slate-900">{contextualLifecycle.kpis.agedSplitters.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-xl bg-rose-50/90 px-2 py-2 ring-1 ring-rose-200/70">
              <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">5+ anos críticos</p>
              <p className="text-xl font-black tabular-nums text-rose-800">{contextualLifecycle.kpis.agedCriticalSplitters.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-xl bg-amber-50/90 px-2 py-2 ring-1 ring-amber-200/70">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Pressão envelhecida</p>
              <p className="text-xl font-black tabular-nums text-amber-900">{contextualLifecycle.kpis.agedPressurePercent.toFixed(1)}%</p>
            </div>
          </div>
        </motion.article>
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Ranking de substituição preventiva</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Ordenação pelo mesmo score de risco, enfatizando equipamentos velhos com pressão de uso.{" "}
            <span className="font-semibold">ETA 95%</span>: estimativa em dias para chegar a 95% de ocupação se a taxa
            recente de variação continuar linear — é cenário simplificado, não previsão garantida.
          </p>
          <div className="mt-3 space-y-2 sm:hidden">
            {contextualRiskRanking.slice(0, 8).map((row) => (
              <article key={row.splitterCode} className="rounded-xl bg-slate-50/90 p-2.5 ring-1 ring-slate-200/70">
                <p className="truncate text-xs font-bold text-slate-900">{row.splitterTitle || row.splitterCode}</p>
                <p className="font-mono text-[10px] text-slate-500">{row.splitterCode}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <p><span className="font-semibold">Score:</span> {row.riskScore.toFixed(1)}</p>
                  <p><span className="font-semibold">Idade:</span> {row.ageYears.toFixed(2)} anos</p>
                  <p><span className="font-semibold">Uso:</span> {row.currentUsagePercent.toFixed(1)}%</p>
                  <p><span className="font-semibold">ETA 95%:</span> {row.etaTo95Days == null ? '—' : `${row.etaTo95Days}d`}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Splitter</th>
                  <th className="px-2 py-2">Score ciclo</th>
                  <th className="px-2 py-2">Idade</th>
                  <th className="px-2 py-2">Uso</th>
                  <th className="px-2 py-2" title={PP_TOOLTIP_DELTA_PERIOD(deltaReferenceLabel)}>
                    {deltaReferenceLabel} (pp)
                  </th>
                  <th className="px-2 py-2" title="Projeção linear simplificada: dias até 95% de ocupação se o ritmo recente se mantiver">
                    ETA 95%
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contextualRiskRanking.slice(0, 12).map((row) => (
                  <tr key={row.splitterCode} className="hover:bg-slate-50/70">
                    <td className="px-2 py-2">
                      <p className="truncate font-semibold text-slate-900">{row.splitterTitle || row.splitterCode}</p>
                      <p className="font-mono text-[10px] text-slate-500">{row.splitterCode}</p>
                    </td>
                    <td className="px-2 py-2 tabular-nums font-semibold">{row.riskScore.toFixed(1)}</td>
                    <td className="px-2 py-2 tabular-nums">{row.ageYears.toFixed(2)} anos</td>
                    <td className="px-2 py-2 tabular-nums">{row.currentUsagePercent.toFixed(1)}%</td>
                    <td className="px-2 py-2 tabular-nums" title={PP_TOOLTIP_DELTA_PERIOD(deltaReferenceLabel)}>
                      {formatDeltaPp(row.selectedDelta)}
                    </td>
                    <td className="px-2 py-2 tabular-nums" title={row.etaTo95Days == null ? undefined : `Projeção: ~${row.etaTo95Days} dias para 95% ao ritmo atual`}>{row.etaTo95Days == null ? '—' : `${row.etaTo95Days} dias`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.article>
      </section>
      <section className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
        <h2 className="text-sm font-bold text-slate-800">Alertas de ciclo de vida</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          Regras automáticas (ex.: idade alta + uso alto ou queda brusca). Só aparecem equipamentos que continuam no filtro
          atual da página.
        </p>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {lifecycleAlerts.filter((item) => contextualRiskRanking.some((row) => row.splitterCode === item.splitterCode)).length === 0 ? (
            <li className="rounded-xl bg-slate-50/90 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200/70">
              Sem alertas de ciclo de vida no filtro atual.
            </li>
          ) : (
            lifecycleAlerts
              .filter((item) => contextualRiskRanking.some((row) => row.splitterCode === item.splitterCode))
              .map((alert) => (
              <li key={alert.splitterCode} className="rounded-xl bg-amber-50/90 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200/70">
                <p className="font-semibold">{alert.splitterTitle || alert.splitterCode}</p>
                <p className="font-mono text-[10px] text-amber-800/80">{alert.splitterCode}</p>
                <p className="mt-1">{alert.reason}</p>
              </li>
            ))
          )}
        </ul>
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Curva de envelhecimento por faixa</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Linhas = faixa de idade do equipamento no recorte.{' '}
            <span className="font-semibold text-slate-700">Massivas (ún.)</span> = ocorrências distintas com splitter na
            faixa; <span className="font-semibold text-slate-700">Vínculos</span> = soma massiva × splitter (a mesma
            massiva pode contar mais de uma vez).
          </p>
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Faixa (anos)</th>
                  <th className="px-2 py-2">Splitters</th>
                  <th className="px-2 py-2">Uso médio</th>
                  <th className="px-2 py-2">{deltaReferenceLabel} médio</th>
                  <th className="px-2 py-2">Massivas (ún.)</th>
                  <th className="px-2 py-2">Vínculos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contextualLifecycle.buckets.map((row) => (
                  <tr key={row.bucket} className="hover:bg-slate-50/70">
                    <td className="px-2 py-2 font-semibold">{row.bucket}</td>
                    <td className="px-2 py-2 tabular-nums">{row.splitters}</td>
                    <td className="px-2 py-2 tabular-nums">{row.avgUsagePercent.toFixed(1)}%</td>
                    <td className="px-2 py-2 tabular-nums">{row.avgDeltaReference >= 0 ? '+' : ''}{row.avgDeltaReference.toFixed(2)}%</td>
                    <td className="px-2 py-2 tabular-nums">{row.distinctMassivas.toLocaleString('pt-BR')}</td>
                    <td className="px-2 py-2 tabular-nums">{row.massivaLinkages.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.article>
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.24 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Heatmap idade × saturação</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Linhas = faixa etária (anos); colunas = faixa de uso atual (&lt;70%, 70–94%, ≥95%). Número = quantidade de
            splitters na interseção; tom mais escuro = mais equipamentos (compare relativamente ao quadro).
          </p>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {contextualLifecycle.heatmap.map((cell) => {
              const intensity = Math.min(1, cell.count / Math.max(1, contextualLifecycle.heatmap.reduce((m, c) => Math.max(m, c.count), 0)))
              const alpha = 0.12 + intensity * 0.78
              return (
                <div key={`${cell.bucket}-${cell.usageBand}`} className="rounded-lg p-2 text-center" style={{ backgroundColor: `rgba(245, 158, 11, ${alpha})` }}>
                  <p className="text-[9px] font-bold text-slate-700">{cell.bucket}</p>
                  <p className="text-[9px] text-slate-600">{cell.usageBand}</p>
                  <p className="text-sm font-black text-slate-900">{cell.count}</p>
                </div>
              )
            })}
          </div>
          {lifecycleHeatmapInsight ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11px] font-semibold text-rose-800">
              {lifecycleHeatmapInsight}
            </p>
          ) : null}
        </motion.article>
      </section>
      <section className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
        <h2 className="text-sm font-bold text-slate-800">Cohorts por ano de implantação</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          Agrupa splitters pelo ano de entrada em operação.{" "}
          <span className="font-semibold">Incidentes/ano</span> divide tickets de massiva do cohort pela idade média em
          anos — útil para comparar gerações de equipamento.
        </p>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">Ano</th>
                <th className="px-2 py-2">Splitters</th>
                <th className="px-2 py-2">Uso médio</th>
                <th className="px-2 py-2">Incidentes/ano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lifecycleCohorts.map((row) => (
                <tr key={row.cohortYear} className="hover:bg-slate-50/70">
                  <td className="px-2 py-2 font-semibold">{row.cohortYear}</td>
                  <td className="px-2 py-2 tabular-nums">{row.splitters}</td>
                  <td className="px-2 py-2 tabular-nums">{row.avgUsagePercent.toFixed(1)}%</td>
                  <td className="px-2 py-2 tabular-nums">{row.incidentsPerYear.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </>
      ) : null}
        </>
      ) : null}

      {activeWindow === 'operacao' ? (
        <>
      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChartSpline size={16} className="text-amber-600" />
              <h2 className="text-sm font-bold text-slate-800">Tendência de ocupação (média)</h2>
            </div>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-600">
            Para cada splitter são estimados três pontos no tempo (hoje, menos 7 dias e menos 30 dias) a partir da
            ocupação atual e dos deltas; a linha mostra a <span className="font-semibold">média entre todos os
            splitters</span> em cada dia. Serve para ver direção da rede, não o valor exato de um equipamento isolado.
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaPoints.map((point) => ({ ...point, date: formatDateLabel(point.at) }))}>
                <defs>
                  <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  formatter={(value: unknown) => [`${Number(value ?? 0).toFixed(2)}%`, 'Ocupação média']}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Area type="monotone" dataKey="usagePercent" name="Ocupação média (%)" stroke="#f59e0b" strokeWidth={2.2} fill="url(#usageGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <OccupancyCapacityCharts
            trends={trends}
            formatDateLabel={formatDateLabel}
            deltaReferenceLabel={deltaReferenceLabel}
            trendDeltaReference={trendDeltaReference}
          />
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-slate-800">Status por splitter</h2>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
            Gatilhos de <span className="font-semibold">capacidade</span> (ocupação de portas). Variações em{' '}
            <span className="font-semibold">pp</span> (pontos percentuais) — veja o quadro abaixo. O Δ usa snapshots — só
            grava quando a ocupação muda. Massivas, score de risco e campeões de uso/Δ ficam nos cards acima e no ranking.
          </p>
          <TrendStatusCapacityPanel
            trends={trends}
            deltaReferenceLabel={deltaReferenceLabel}
            trendDeltaReference={trendDeltaReference}
            trendBadgeClass={trendBadgeClass}
          />
        </motion.article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="xl:col-span-2"
        >
          <MassivaRecurrencePanel
            insights={massivaRecurrenceInsights}
            periodLabel={intelligencePeriodLabel}
            deltaReferenceLabel={deltaReferenceLabel}
            distinctMassivaCountInPeriod={massivaRollup.distinctMassivaCount}
          />
        </motion.div>


        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center gap-2">
            <Database size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-slate-800">Recorrência dia × turno</h2>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-slate-600">
            Cada célula conta <span className="font-semibold">massivas distintas</span> cuja{' '}
            <span className="font-semibold">abertura</span> caiu naquele dia da semana e faixa de horário (madrugada
            &lt;6h, manhã 6–12h, tarde 12–18h, noite 18–24h — fuso do servidor). Não repete por splitter: uma
            ocorrência com muitos equipamentos entra uma vez. Quanto mais escura, maior o volume.
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {recurrenceCells.map((cell) => {
              const intensity = cell.count / maxRecurrence
              const alpha = 0.1 + intensity * 0.85
              const { Icon: ShiftIcon, label: shiftAria } = recurrenceShiftIcon(cell.shift)
              return (
                <div
                  key={`${cell.weekday}-${cell.shift}`}
                  title={`${cell.weekday} · ${cell.shift}: ${cell.count}`}
                  className="rounded-lg p-2 text-center"
                  style={{ backgroundColor: `rgba(245, 158, 11, ${alpha})` }}
                >
                  <p className="text-[10px] font-semibold text-slate-700">{cell.weekday}</p>
                  <span
                    className="mx-auto my-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/55 text-slate-800 shadow-sm ring-1 ring-slate-200/60"
                    aria-label={shiftAria}
                  >
                    <ShiftIcon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                  </span>
                  <p className="text-[10px] text-slate-600">{cell.shift.slice(0, 3)}</p>
                  <p className="text-xs font-black text-slate-900">{cell.count}</p>
                </div>
              )
            })}
          </div>
        </motion.article>
      </section>
        </>
      ) : null}

      {activeWindow === 'topologia' && !showFullSkeleton ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.02 }}
          className="rounded-3xl border border-primary/20 bg-white/70 p-4 shadow-xl shadow-primary/5 backdrop-blur-xl ring-1 ring-primary/10"
        >
          <div className="mb-3 flex items-center gap-2">
            <Network size={18} className="shrink-0 text-primary" aria-hidden />
            <h2 className="text-sm font-bold text-slate-800">
              Topologia física — <span className="font-extrabold text-primary">OLT → Slot → PON</span>
            </h2>
          </div>
          <Suspense
            fallback={
              <p className="rounded-2xl border border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
                Carregando topologia…
              </p>
            }
          >
            <NetworkTopologyPanel topology={topology} deltaReferenceLabel={deltaReferenceLabel} />
          </Suspense>
        </motion.section>
      ) : null}

      {activeWindow === 'geografico' ? (
        <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.02 }}
        className="rounded-3xl border border-[#7c3aed]/25 bg-white/70 p-4 shadow-xl shadow-amber-500/10 shadow-[#7c3aed]/08 backdrop-blur-xl ring-1 ring-[#7c3aed]/15"
      >
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="shrink-0 text-amber-600" aria-hidden />
            <h2 className="text-sm font-bold text-slate-800">
              Indicadores por cidade, bairro e{' '}
              <span className="font-extrabold text-[#7c3aed]">corporativo</span>
            </h2>
          </div>
          <p className="max-w-3xl text-[11px] leading-relaxed text-slate-600">
            Cidade e bairro usam o cadastro do equipamento (
            <span className="font-mono text-[10px] text-slate-500">CIDADE/BAIRRO[SPLT.SECUNDARIO]</span>). Corporativo:
            pelo menos um cliente PJ (insígnia contrato corporativo / PME). Tudo abaixo obedece aos filtros desta página —
            serve para comparar regiões e decidir onde concentrar obra, NOC ou relacionamento com cliente.
          </p>
        </div>

        {contextualRiskRanking.length === 0 ? (
          <p className="rounded-xl bg-slate-50/90 px-3 py-4 text-center text-sm text-slate-600">
            Nenhum splitter no recorte atual. Afrouxe filtros ou o período para ver indicadores regionais.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-3 ring-1 ring-slate-200/60">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Splitters no recorte</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">
                  {contextualRegionalInsights.corporateSnapshot.splittersTotal.toLocaleString('pt-BR')}
                </p>
              </article>
              <article className="rounded-2xl border-2 border-[#7c3aed]/45 bg-[#7c3aed]/[0.07] px-3 py-3 shadow-sm shadow-[#7c3aed]/10">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#5b21b6]">
                  <Briefcase size={12} className="shrink-0 text-[#7c3aed]" aria-hidden />
                  Com corporativo
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-[#4c1d95]">
                  {contextualRegionalInsights.corporateSnapshot.splittersWithCorporate.toLocaleString('pt-BR')}
                  <span className="ml-1 text-xs font-semibold text-[#7c3aed]">
                    (
                    {contextualRegionalInsights.corporateSnapshot.splittersTotal > 0
                      ? (
                          (contextualRegionalInsights.corporateSnapshot.splittersWithCorporate /
                            contextualRegionalInsights.corporateSnapshot.splittersTotal) *
                          100
                        ).toFixed(1)
                      : '0.0'}
                    %)
                  </span>
                </p>
              </article>
              <article className="rounded-2xl border-2 border-[#7c3aed]/35 bg-gradient-to-br from-rose-50/95 to-[#7c3aed]/10 px-3 py-3 shadow-sm shadow-[#7c3aed]/10">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#5b21b6]">
                  Críticos (≥95%) entre PJ
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-rose-700">
                  {contextualRegionalInsights.corporateSnapshot.criticalAmongCorporate.toLocaleString('pt-BR')}
                </p>
              </article>
              <article className="rounded-2xl border-2 border-[#7c3aed]/40 bg-[#7c3aed]/[0.09] px-3 py-3 shadow-sm shadow-[#7c3aed]/12">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#5b21b6]">Uso médio nos splitters PJ</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-[#4c1d95]">
                  {contextualRegionalInsights.corporateSnapshot.splittersWithCorporate > 0
                    ? `${contextualRegionalInsights.corporateSnapshot.avgUsageAmongCorporate.toFixed(1)}%`
                    : '—'}
                </p>
                <p className="mt-1 text-[10px] text-[#5b21b6]/95">
                  Massivas abertas (soma):{' '}
                  <span className="font-bold tabular-nums text-[#4c1d95]">
                    {contextualRegionalInsights.corporateSnapshot.openMassivasAmongCorporate.toLocaleString('pt-BR')}
                  </span>
                  {' · '}
                  Tickets massiva (Σ PJ):{' '}
                  <span className="font-bold tabular-nums text-[#4c1d95]">
                    {contextualRegionalInsights.corporateSnapshot.corporateMassivaTickets.toLocaleString('pt-BR')}
                  </span>
                </p>
              </article>
            </div>

            <div className="mt-4 rounded-xl border-2 border-[#7c3aed]/35 bg-[#7c3aed]/[0.08] px-3 py-2.5 text-[11px] leading-snug text-[#4c1d95]">
              <span className="font-bold text-[#7c3aed]">Direção (corporativo):</span>{' '}
              {contextualRegionalInsights.corporateSnapshot.directive}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/60 p-3 ring-1 ring-slate-200/50">
                <h3 className="text-xs font-bold text-slate-800">Por cidade</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Ordenado por criticidade e uso médio. Última coluna sugere foco de ação.
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[11px]">
                    <thead className="border-b border-slate-200/80 text-[9px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-1.5 py-1.5">Cidade</th>
                        <th className="px-1.5 py-1.5">Spl.</th>
                        <th className="px-1.5 py-1.5">Crít.</th>
                        <th className="px-1.5 py-1.5">Uso ∅</th>
                        <th className="px-1.5 py-1.5">{deltaReferenceLabel} ∅</th>
                        <th className="px-1.5 py-1.5">M.ab.</th>
                        <th className="px-1.5 py-1.5" title="Σ vínculos massiva × splitter no recorte">
                          Mtickets Σ
                        </th>
                        <th className="px-1.5 py-1.5 font-bold text-[#7c3aed]">PJ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contextualRegionalInsights.topCidades.map((row) => (
                        <tr key={row.label} className="align-top hover:bg-slate-50/70">
                          <td className="px-1.5 py-1.5 font-semibold text-slate-900">{row.label}</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.splitters}</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.criticalSplitters}</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.avgUsagePercent.toFixed(1)}%</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">
                            {row.avgDeltaReference >= 0 ? '+' : ''}
                            {row.avgDeltaReference.toFixed(2)}%
                          </td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.openTickets}</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">
                            {row.massivaTicketsTotal.toLocaleString('pt-BR')}
                          </td>
                          <td
                            className={cn(
                              'px-1.5 py-1.5 tabular-nums',
                              row.splittersWithCorporate > 0
                                ? 'font-bold text-[#7c3aed]'
                                : 'text-slate-700',
                            )}
                          >
                            {row.splittersWithCorporate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                  {contextualRegionalInsights.topCidades.slice(0, 4).map((row) => (
                    <li key={`d-${row.label}`} className="text-[10px] leading-snug text-slate-600">
                      <span className="font-semibold text-slate-700">{row.label}:</span> {row.directive}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/60 p-3 ring-1 ring-slate-200/50">
                <h3 className="text-xs font-bold text-slate-800">Por bairro</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Chave &quot;bairro · cidade&quot; para evitar homônimos. Mesmas métricas da cidade.
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[11px]">
                    <thead className="border-b border-slate-200/80 text-[9px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-1.5 py-1.5">Bairro · cidade</th>
                        <th className="px-1.5 py-1.5">Spl.</th>
                        <th className="px-1.5 py-1.5">Crít.</th>
                        <th className="px-1.5 py-1.5">Uso ∅</th>
                        <th className="px-1.5 py-1.5">{deltaReferenceLabel} ∅</th>
                        <th className="px-1.5 py-1.5">M.ab.</th>
                        <th className="px-1.5 py-1.5" title="Σ vínculos massiva × splitter no recorte">
                          Mtickets Σ
                        </th>
                        <th className="px-1.5 py-1.5 font-bold text-[#7c3aed]">PJ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contextualRegionalInsights.topBairros.map((row) => (
                        <tr key={row.label} className="align-top hover:bg-slate-50/70">
                          <td className="max-w-[14rem] px-1.5 py-1.5 font-semibold text-slate-900">
                            <span className="line-clamp-2">{row.label}</span>
                          </td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.splitters}</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.criticalSplitters}</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.avgUsagePercent.toFixed(1)}%</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">
                            {row.avgDeltaReference >= 0 ? '+' : ''}
                            {row.avgDeltaReference.toFixed(2)}%
                          </td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">{row.openTickets}</td>
                          <td className="px-1.5 py-1.5 tabular-nums text-slate-700">
                            {row.massivaTicketsTotal.toLocaleString('pt-BR')}
                          </td>
                          <td
                            className={cn(
                              'px-1.5 py-1.5 tabular-nums',
                              row.splittersWithCorporate > 0
                                ? 'font-bold text-[#7c3aed]'
                                : 'text-slate-700',
                            )}
                          >
                            {row.splittersWithCorporate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                  {contextualRegionalInsights.topBairros.slice(0, 5).map((row) => (
                    <li key={`bd-${row.label}`} className="text-[10px] leading-snug text-slate-600">
                      <span className="font-semibold text-slate-700">{row.label}:</span> {row.directive}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </motion.section>

      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Drill-down por AP/OLT</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Agrega apenas splitters que passam pelos filtros desta página. Mostra onde se concentram uso, criticidade e
            volume de massivas por equipamento de origem (OLT).
          </p>
          <div className="mt-3 space-y-2 sm:hidden">
            {contextualOltDrilldown.map((row) => (
              <article key={`${row.oltCode}-${row.oltDescription}`} className="rounded-xl bg-slate-50/90 p-2.5 ring-1 ring-slate-200/70">
                <p className="truncate text-xs font-bold text-slate-900">{row.oltDescription}</p>
                <p className="font-mono text-[10px] text-slate-500">{row.oltCode}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <p><span className="font-semibold">Splitters:</span> {row.splitters}</p>
                  <p><span className="font-semibold">Críticos:</span> {row.criticalSplitters}</p>
                  <p><span className="font-semibold">Idade méd.:</span> {row.avgAgeYears.toFixed(2)} anos</p>
                  <p><span className="font-semibold">Uso méd.:</span> {row.avgUsagePercent.toFixed(1)}%</p>
                  <p>
                    <span className="font-semibold">{deltaReferenceLabel} méd.:</span> {row.avgDeltaReference >= 0 ? '+' : ''}
                    {row.avgDeltaReference.toFixed(2)}%
                  </p>
                  <p><span className="font-semibold">Massivas:</span> {row.openTickets}/{row.totalTickets}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-3 hidden overflow-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">OLT</th>
                  <th className="px-2 py-2">Splitters</th>
                  <th className="px-2 py-2">Críticos</th>
                  <th className="px-2 py-2">Idade méd.</th>
                  <th className="px-2 py-2">Uso médio</th>
                  <th className="px-2 py-2">{deltaReferenceLabel} médio</th>
                  <th className="px-2 py-2">Massivas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contextualOltDrilldown.map((row) => (
                  <tr key={`${row.oltCode}-${row.oltDescription}`} className="hover:bg-slate-50/70">
                    <td className="px-2 py-2">
                      <p className="font-semibold text-slate-900">{row.oltDescription}</p>
                      <p className="font-mono text-[10px] text-slate-500">{row.oltCode}</p>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{row.splitters}</td>
                    <td className="px-2 py-2 tabular-nums">{row.criticalSplitters}</td>
                    <td className="px-2 py-2 tabular-nums">{row.avgAgeYears.toFixed(2)} anos</td>
                    <td className="px-2 py-2 tabular-nums">{row.avgUsagePercent.toFixed(1)}%</td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.avgDeltaReference >= 0 ? '+' : ''}
                      {row.avgDeltaReference.toFixed(2)}%
                    </td>
                    <td className="px-2 py-2 tabular-nums">{row.openTickets}/{row.totalTickets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Geo e contexto local</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Resumo do mesmo conjunto filtrado: tipo de local (condomínio/unidade), condomínios com mais vínculos a
            massivas no período (Σ por splitter) e ruas com mais equipamentos em uso crítico (≥95%). Ruas
            agrupadas com a mesma normalização do mapa (cadastro/caixa; ex.: Av. = Avenida).
          </p>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {contextualGeoDrilldown.tipoLocal.map((item) => (
                <div key={item.key} className="rounded-xl bg-slate-50/90 px-2 py-2 text-center ring-1 ring-slate-200/70">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{item.key.replace('_', ' ')}</p>
                  <p className="text-lg font-black tabular-nums text-slate-900">{item.count}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white/50 p-2 ring-1 ring-slate-200/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Destaques do recorte
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                    Use para achar concentração de impacto (condomínios) e pressão operacional (ruas com críticos).
                  </p>
                </div>
                {/* Mobile tabs */}
                <div className="flex items-center gap-1 rounded-full bg-slate-50 p-1 ring-1 ring-slate-200/80 sm:hidden">
                  <button
                    type="button"
                    onClick={() => setGeoTab('condominios')}
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition',
                      geoTab === 'condominios'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    <Building2 className="size-3.5" aria-hidden />
                    Condomínios
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeoTab('ruas')}
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition',
                      geoTab === 'ruas'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    <MapPin className="size-3.5" aria-hidden />
                    Ruas críticas
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {/* Top condomínios */}
                <section className={cn('min-w-0 rounded-xl bg-slate-50/70 p-2.5 ring-1 ring-slate-200/70', geoTab !== 'condominios' ? 'hidden sm:block' : '')}>
                  <header className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-900 ring-1 ring-amber-200/70">
                        <Building2 className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-600">
                          Top condomínios por impacto
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Ordenado por Σ massivas (por splitter) no período
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200/70">
                      Top {contextualGeoDrilldown.topCondominios.length}
                    </span>
                  </header>
                  <ul className="mt-2 space-y-2">
                    {contextualGeoDrilldown.topCondominios.map((item, idx) => (
                      <li
                        key={item.nome}
                        className="rounded-xl bg-white/80 px-3 py-2 text-[11px] text-slate-700 ring-1 ring-slate-200/70"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-50 text-[10px] font-black text-amber-800 ring-1 ring-amber-200/70">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="font-bold leading-snug text-slate-900 break-words [overflow-wrap:anywhere]"
                              title={item.nome}
                            >
                              {item.nome}
                            </p>
                            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <p className="text-slate-600">
                                {item.splitters} splitter{item.splitters === 1 ? '' : 's'}
                              </p>
                              <div className="shrink-0 text-right">
                                <p className="tabular-nums font-black text-slate-900">
                                  {item.massivaTickets.toLocaleString('pt-BR')}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                  Σ massivas
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                    {contextualGeoDrilldown.topCondominios.length === 0 ? (
                      <li className="rounded-xl bg-white/70 px-3 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200/70">
                        Sem dados de condomínio no recorte atual.
                      </li>
                    ) : null}
                  </ul>
                </section>

                {/* Top ruas críticas */}
                <section className={cn('min-w-0 rounded-xl bg-slate-50/70 p-2.5 ring-1 ring-slate-200/70', geoTab !== 'ruas' ? 'hidden sm:block' : '')}>
                  <header className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-rose-100 text-rose-900 ring-1 ring-rose-200/70">
                        <MapPin className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-600">
                          Top ruas com criticidade
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Mais splitters em uso crítico (≥95%) — mesma regra de “mesma rua” do mapa
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200/70">
                      Top {contextualGeoDrilldown.topStreets.length}
                    </span>
                  </header>
                  <ul className="mt-2 space-y-2">
                    {contextualGeoDrilldown.topStreets.map((item, idx) => (
                      <li
                        key={item.streetKey}
                        className="rounded-xl bg-white/80 px-3 py-2 text-[11px] text-slate-700 ring-1 ring-slate-200/70"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-rose-50 text-[10px] font-black text-rose-800 ring-1 ring-rose-200/70">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="font-bold leading-snug text-slate-900 break-words [overflow-wrap:anywhere]"
                              title={item.nome}
                            >
                              {item.nome}
                            </p>
                            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <p className="text-slate-600">
                                {item.splitters} splitter{item.splitters === 1 ? '' : 's'}
                              </p>
                              <div className="shrink-0 text-right">
                                <p className="tabular-nums font-black text-slate-900">{item.criticalSplitters}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                  críticos
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                    {contextualGeoDrilldown.topStreets.length === 0 ? (
                      <li className="rounded-xl bg-white/70 px-3 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200/70">
                        Sem dados de rua no recorte atual.
                      </li>
                    ) : null}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </motion.article>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.22 }}
        className="overflow-visible rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
      >
        <h2 className="mb-1 text-sm font-bold text-slate-800">Mapa inteligente de pressão na rede</h2>
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          Até 80 splitters em amostra estratificada. Além do calor regional, cada ponto combina{' '}
          <span className="font-semibold text-slate-800">tamanho</span> (índice de atenção: uso + massivas + tendência),{' '}
          <span className="font-semibold text-slate-800">halo</span> (volume de vínculos com massivas distintas no período) e{' '}
          <span className="font-semibold text-[#7c3aed]">destaque roxo</span> para equipamentos com cliente corporativo.
          Com o filtro abaixo você vê <span className="font-semibold text-slate-800">apenas splitters com PJ</span>; desligado,
          a amostra mistura toda a base (crítico / atenção / folga), e o <span className="font-semibold text-[#7c3aed]">roxo</span>{' '}
          marca só quem tem corporativo.
          Passe o mouse ou clique para métricas completas e link para a ficha.
        </p>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-slate-500">
            Filtro do mapa (não altera tabelas acima).
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={mapCorporateOnly}
            onClick={() => setMapCorporateOnly((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[11px] font-bold transition',
              mapCorporateOnly
                ? 'border-[#7c3aed] bg-[#7c3aed]/12 text-[#5b21b6] shadow-sm shadow-[#7c3aed]/15'
                : 'border-slate-200 bg-white/90 text-slate-600 hover:border-[#7c3aed]/35',
            )}
          >
            <Briefcase className="size-3.5 shrink-0 text-[#7c3aed]" aria-hidden />
            Só corporativo no mapa
          </button>
        </div>
        <Suspense
          fallback={
            <div
              className="h-[min(420px,55vh)] w-full animate-pulse rounded-2xl bg-slate-100/90"
              aria-hidden
            />
          }
        >
          <IntelligenceSaturationMap cells={saturationCells} mapEmptyHint={mapCorporateEmptyHint} />
        </Suspense>
      </motion.section>
        </>
      ) : null}

      {activeWindow === 'manutencao' ? (
        <>
          <p className="break-words text-[11px] leading-relaxed text-slate-600">
            Dados do Elleven/ERP no intervalo de datas. Protocolos podem incluir rompimento, troca de flat e outros tipos
            mapeados na consulta. KPIs são globais ao período; a tabela abaixo respeita busca e filtros da barra superior.
          </p>
          {maintenanceInsight ? (
            <div className="mt-3 space-y-2">
              <InsightBanner tone={maintenanceInsight.tone} icon={Wrench}>
                {maintenanceInsight.text}
              </InsightBanner>
              {maintenanceFailureMix ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-700">
                  Mix de falhas no recorte:{' '}
                  <span className="font-bold text-slate-900">{maintenanceFailureMix.rompPct}%</span> rompimento (
                  {maintenanceFailureMix.rompimento}) ·{' '}
                  <span className="font-bold text-slate-900">{maintenanceFailureMix.trocaPct}%</span> troca de flat (
                  {maintenanceFailureMix.troca}). Predominante:{' '}
                  <span className="font-bold text-slate-900">{maintenanceFailureMix.dominant}</span>.
                </p>
              ) : null}
            </div>
          ) : null}
          <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.04 }}
              className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Splitters com manutenção
              </p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black tabular-nums text-slate-900">
                <Wrench size={20} className="text-amber-600" />
                {maintenanceTotals.splittersWithMaintenances.toLocaleString('pt-BR')}
              </p>
            </motion.article>
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Manutenções no período
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">
                {maintenanceTotals.totalMaintenances.toLocaleString('pt-BR')}
              </p>
              {maintenanceTotals.splittersWithMaintenances > 0 ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {(maintenanceTotals.totalMaintenances / maintenanceTotals.splittersWithMaintenances)
                    .toFixed(1)
                    .replace('.', ',')}{' '}
                  por splitter
                </p>
              ) : null}
            </motion.article>
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Protocolos únicos
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">
                {maintenanceTotals.totalProtocols.toLocaleString('pt-BR')}
              </p>
            </motion.article>
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Protocolos em aberto
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-amber-900">
                {maintenanceTotals.openMaintenances.toLocaleString('pt-BR')}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{maintenanceOpenRate.toFixed(1)}% do total</p>
            </motion.article>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.14 }}
              className="min-w-0 xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
            >
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Ranking de manutenção por splitter</h2>
                  <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">
                    Uma linha por combinação splitter + ponto de acesso quando aplicável. Rompimento/troca flat contam
                    tipos de manutenção registrados; Abertas = protocolos sem encerramento no ERP.
                  </p>
                </div>
                {maintenanceQuery.isFetching ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                    <Loader2 className="size-3 animate-spin" />
                    Atualizando…
                  </span>
                ) : null}
              </div>

              {maintenanceQuery.isPending ? (
                <div className="h-40 animate-pulse rounded-2xl bg-slate-100/90" />
              ) : maintenanceQuery.isError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  Não foi possível carregar as manutenções por splitter no período.
                </p>
              ) : contextualMaintenanceRows.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Nenhum dado de manutenção encontrado para o filtro selecionado.
                </p>
              ) : (
                <>
                  <div className="space-y-3 lg:hidden">
                    {contextualMaintenanceRows.slice(0, 80).map((row) => (
                      <article
                        key={`m-${row.splitterCode}-${row.accessPointCode}`}
                        className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm ring-1 ring-slate-200/50"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-semibold leading-snug text-slate-900">
                            {row.splitterTitle || row.splitterCode}
                          </p>
                          <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
                            {row.splitterCode}
                          </p>
                          <p className="mt-2 text-xs text-slate-600">
                            <span className="font-semibold text-slate-500">AP</span>{' '}
                            <span className="font-mono">{row.accessPointCode || '—'}</span>
                          </p>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
                          <div className="rounded-lg bg-slate-50/90 px-2.5 py-2 ring-1 ring-slate-200/60">
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Manutenções
                            </dt>
                            <dd className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                              {row.totalMaintenances.toLocaleString('pt-BR')}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-slate-50/90 px-2.5 py-2 ring-1 ring-slate-200/60">
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Protocolos
                            </dt>
                            <dd className="mt-0.5 tabular-nums font-semibold text-slate-800">
                              {row.uniqueProtocols.toLocaleString('pt-BR')}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-slate-50/90 px-2.5 py-2 ring-1 ring-slate-200/60">
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Clientes
                            </dt>
                            <dd className="mt-0.5 tabular-nums font-semibold text-slate-800">
                              {row.uniqueClients.toLocaleString('pt-BR')}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-amber-50/90 px-2.5 py-2 ring-1 ring-amber-200/70">
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                              Abertas
                            </dt>
                            <dd className="mt-0.5 tabular-nums font-bold text-amber-950">
                              {row.openMaintenances.toLocaleString('pt-BR')}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-slate-50/90 px-2.5 py-2 ring-1 ring-slate-200/60">
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Rompimento
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-slate-800">
                              {row.rompimentoCount.toLocaleString('pt-BR')}
                            </dd>
                          </div>
                          <div className="rounded-lg bg-slate-50/90 px-2.5 py-2 ring-1 ring-slate-200/60">
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Troca flat
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-slate-800">
                              {row.trocaFlatCount.toLocaleString('pt-BR')}
                            </dd>
                          </div>
                        </dl>
                        <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-600">
                          <span className="font-semibold text-slate-500">Última</span>{' '}
                          {row.latestCreatedAt ? formatBrazilDateTimeShortDisplay(row.latestCreatedAt) : '—'}
                        </p>
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[820px] text-left text-xs">
                      <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-2 py-2">Splitter</th>
                          <th className="px-2 py-2">AP</th>
                          <th className="px-2 py-2">Manutenções</th>
                          <th className="px-2 py-2">Protocolos</th>
                          <th className="px-2 py-2">Clientes</th>
                          <th className="px-2 py-2">Abertas</th>
                          <th className="px-2 py-2">Rompimento</th>
                          <th className="px-2 py-2">Troca flat</th>
                          <th className="px-2 py-2">Última</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {contextualMaintenanceRows.slice(0, 80).map((row) => (
                          <tr key={`${row.splitterCode}-${row.accessPointCode}`} className="hover:bg-slate-50/70">
                            <td className="px-2 py-2">
                              <p className="font-semibold text-slate-900">
                                {row.splitterTitle || row.splitterCode}
                              </p>
                              <p className="font-mono text-[10px] text-slate-500">{row.splitterCode}</p>
                            </td>
                            <td className="px-2 py-2 font-mono text-[11px] text-slate-700">{row.accessPointCode || '—'}</td>
                            <td className="px-2 py-2 tabular-nums font-semibold text-slate-900">{row.totalMaintenances.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-700">{row.uniqueProtocols.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-700">{row.uniqueClients.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-2 tabular-nums text-amber-900">{row.openMaintenances.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-700">{row.rompimentoCount.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-700">{row.trocaFlatCount.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-2 text-[11px] text-slate-600">
                              {row.latestCreatedAt ? formatBrazilDateTimeShortDisplay(row.latestCreatedAt) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="min-w-0 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
            >
              <h2 className="text-sm font-bold text-slate-800">Qualidade do mapeamento</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                Clientes únicos ligados a protocolos; registros sem vínculo claro com splitter aparecem como não mapeados.
              </p>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="rounded-xl bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/70">
                  <dt className="font-semibold text-slate-600">Clientes únicos afetados</dt>
                  <dd className="mt-0.5 text-lg font-black tabular-nums text-slate-900">
                    {maintenanceTotals.totalClients.toLocaleString('pt-BR')}
                  </dd>
                </div>
                <div className="rounded-xl bg-amber-50/85 px-3 py-2 ring-1 ring-amber-200/70">
                  <dt className="font-semibold text-amber-800">Sem splitter mapeado</dt>
                  <dd className="mt-0.5 text-lg font-black tabular-nums text-amber-900">
                    {maintenanceTotals.unmappedMaintenances.toLocaleString('pt-BR')}
                  </dd>
                  {maintenanceTotals.totalMaintenances > 0 ? (
                    (() => {
                      const coverage = Number(
                        (100 - (maintenanceTotals.unmappedMaintenances / maintenanceTotals.totalMaintenances) * 100).toFixed(1),
                      )
                      return (
                        <p
                          className={cn(
                            'mt-1 text-[11px] font-bold',
                            coverage >= 90 ? 'text-emerald-700' : coverage >= 70 ? 'text-amber-700' : 'text-rose-700',
                          )}
                        >
                          Cobertura: {coverage.toFixed(1).replace('.', ',')}% das manutenções vinculadas a um splitter
                        </p>
                      )
                    })()
                  ) : null}
                </div>
                <div className="rounded-xl bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/70">
                  <dt className="font-semibold text-slate-600">Janela analisada</dt>
                  <dd className="mt-0.5 text-[11px] font-semibold text-slate-800">
                    {formatBrazilDateDisplay(customStartDate ?? new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))}
                    {' '}até{' '}
                    {formatBrazilDateDisplay(customEndDate ?? new Date())}
                  </dd>
                </div>
              </dl>
            </motion.article>
          </section>
        </>
      ) : null}
          </motion.div>
        </AnimatePresence>
      ) : null}

      {/* Saúde de sinal das ONUs (monitoramento) — fonte de dados independente
          da inteligência de splitters, por isso fora do gate de skeleton. */}
      {activeWindow === 'sinais' ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.02 }}
        >
          <Suspense
            fallback={
              <p className="rounded-2xl border border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
                Carregando painel de sinais…
              </p>
            }
          >
            <OnuSignalHealthPanel />
          </Suspense>
        </motion.section>
      ) : null}

      {activeWindow === 'equipamentos' ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.02 }}
        >
          <Suspense
            fallback={
              <p className="rounded-2xl border border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
                Carregando painel de equipamentos…
              </p>
            }
          >
            <EquipmentFleetPanel />
          </Suspense>
        </motion.section>
      ) : null}

      {source === 'mock' ? (
        <p className="text-xs font-semibold text-slate-500">
          Backend local indisponível no momento. A tela segue funcional com mock mantendo o mesmo shape dos endpoints.
        </p>
      ) : null}
    </div>
  )
}
