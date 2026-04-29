import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
  ChartSpline,
  Database,
  Loader2,
  MapPin,
  Moon,
  MoonStar,
  Sun,
  Sunrise,
  Ticket,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { NetworkStats } from '@/shared/api/fetchNetworkStats'
import {
  useNetworkIntelligenceData,
  type IntelligenceDateRangePreset,
  type IntelligenceRiskRankingRow,
  type TrendLabel,
} from '@/features/intelligence/hooks/useNetworkIntelligenceData'

const IntelligenceSaturationMap = lazy(async () => {
  const m = await import('@/features/intelligence/ui/IntelligenceSaturationMap')
  return { default: m.IntelligenceSaturationMap }
})

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

function previewOccupancyPercent(stats: NetworkStats): number {
  const total = stats.activeSplitters
  return total > 0 ? Number(((stats.onlineClients / total) * 100).toFixed(2)) : 0
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

function DateRangeSelector({
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
    <section className="rounded-3xl border border-white/45 bg-white/65 p-4 shadow-lg shadow-amber-500/10 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPresetChange(item)}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide transition',
              preset === item
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-white/80 text-slate-600 hover:bg-amber-50 hover:text-amber-700',
            )}
          >
            {item}
          </button>
        ))}
        {preset === 'custom' ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-xs text-slate-700"
            />
            <span className="text-xs font-semibold text-slate-500">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-xs text-slate-700"
            />
          </div>
        ) : null}
      </div>
    </section>
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

type IntelligenceWindow = 'visao-geral' | 'risco' | 'operacao' | 'geografico' | 'ciclo-vida'

type AgeFilter = 'all' | '0-1' | '1-3' | '3-5' | '5+'

function matrixKeyForRiskRow(
  row: IntelligenceRiskRankingRow,
): 'altoImpactoAltaUrgencia' | 'altoImpactoBaixaUrgencia' | 'baixoImpactoAltaUrgencia' | 'baixoImpactoBaixaUrgencia' {
  const highImpact = row.affectedClientsTotal >= 50 || row.totalTickets >= 4
  const highUrgency = row.currentUsagePercent >= 85 || row.selectedDelta >= 5 || row.openTickets > 0
  if (highImpact && highUrgency) return 'altoImpactoAltaUrgencia'
  if (highImpact && !highUrgency) return 'altoImpactoBaixaUrgencia'
  if (!highImpact && highUrgency) return 'baixoImpactoAltaUrgencia'
  return 'baixoImpactoBaixaUrgencia'
}

export function NetworkIntelligencePage() {
  const [preset, setPreset] = useState<IntelligenceDateRangePreset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [activeWindow, setActiveWindow] = useState<IntelligenceWindow>('visao-geral')
  const [riskBandFilter, setRiskBandFilter] = useState<'all' | 'critico' | 'alto' | 'moderado' | 'baixo'>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')
  const [splitterSearch, setSplitterSearch] = useState('')
  const [selectedMatrixKey, setSelectedMatrixKey] = useState<
    'altoImpactoAltaUrgencia' | 'altoImpactoBaixaUrgencia' | 'baixoImpactoAltaUrgencia' | 'baixoImpactoBaixaUrgencia' | null
  >(null)

  const customStartDate = customStart ? new Date(`${customStart}T00:00:00`) : null
  const customEndDate = customEnd ? new Date(`${customEnd}T23:59:59`) : null

  const {
    query,
    networkStatsPreview,
    source,
    kpis,
    trends,
    massivaStats,
    areaPoints,
    barPoints,
    recurrenceCells,
    saturationCells,
    decisionKpis,
    riskRanking,
    impactUrgencyMatrix,
    deltaReferenceLabel,
    lifecycleCohorts,
    lifecycleAlerts,
  } = useNetworkIntelligenceData(preset, customStartDate, customEndDate)

  const showFullSkeleton = query.isPending && query.isFetching
  const showBackgroundRefresh = query.isFetching && !query.isPending

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

    const massivaAgg = massivaStats.reduce(
      (acc, r) => ({
        totalTickets: acc.totalTickets + r.totalTickets,
        openTickets: acc.openTickets + r.openTickets,
        closedTickets: acc.closedTickets + r.closedTickets,
        affectedClientsTotal: acc.affectedClientsTotal + r.affectedClientsTotal,
      }),
      { totalTickets: 0, openTickets: 0, closedTickets: 0, affectedClientsTotal: 0 },
    )

    let topUsage: (typeof trends)[number] | null = null
    let topDelta: (typeof trends)[number] | null = null
    for (const t of trends) {
      if (!topUsage || t.currentUsagePercent > topUsage.currentUsagePercent) topUsage = t
      const currentDelta = deltaReferenceLabel === 'Δ7d' ? t.delta7d : t.delta30d
      const topDeltaValue = topDelta == null ? Number.NEGATIVE_INFINITY : deltaReferenceLabel === 'Δ7d' ? topDelta.delta7d : topDelta.delta30d
      if (!topDelta || currentDelta > topDeltaValue) topDelta = t
    }

    const titleByCode = new Map(trends.map((t) => [t.splitterCode, t.splitterTitle.trim()]))

    const topMassiva = barPoints[0]
      ? {
          code: barPoints[0].splitterCode,
          title: titleByCode.get(barPoints[0].splitterCode) ?? '',
          totalTickets: barPoints[0].totalTickets,
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
  }, [trends, massivaStats, barPoints, deltaReferenceLabel])

  const mapGeoSnapshot = useMemo(() => {
    const sliceTotal = saturationCells.length
    const sliceWithCoords = saturationCells.filter((c) =>
      hasValidSplitterCoords(c.latitude, c.longitude),
    ).length
    return { sliceTotal, sliceWithCoords }
  }, [saturationCells])

  const maxRecurrence = Math.max(1, ...recurrenceCells.map((cell) => cell.count))

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
    const condos = new Map<string, { nome: string; splitters: number; affectedClientsTotal: number }>()
    const streets = new Map<string, { nome: string; splitters: number; criticalSplitters: number }>()
    for (const row of contextualRiskRanking) {
      const tipo = row.tipoLocal ?? 'SEM_CLASSIFICACAO'
      tipoCounts.set(tipo, (tipoCounts.get(tipo) ?? 0) + 1)
      const condoName = row.nomeCondominio?.trim() ?? ''
      if (condoName !== '') {
        const c = condos.get(condoName) ?? { nome: condoName, splitters: 0, affectedClientsTotal: 0 }
        c.splitters += 1
        c.affectedClientsTotal += row.affectedClientsTotal
        condos.set(condoName, c)
      }
      const streetName = row.street?.trim() ?? ''
      if (streetName !== '') {
        const s = streets.get(streetName) ?? { nome: streetName, splitters: 0, criticalSplitters: 0 }
        s.splitters += 1
        if (row.currentUsagePercent >= 95) s.criticalSplitters += 1
        streets.set(streetName, s)
      }
    }
    return {
      tipoLocal: [
        { key: 'CONDOMÍNIO', count: tipoCounts.get('CONDOMÍNIO') ?? 0 },
        { key: 'UNIDADE', count: tipoCounts.get('UNIDADE') ?? 0 },
        { key: 'SEM_CLASSIFICACAO', count: tipoCounts.get('SEM_CLASSIFICACAO') ?? 0 },
      ],
      topCondominios: [...condos.values()]
        .sort((a, b) => b.affectedClientsTotal - a.affectedClientsTotal || b.splitters - a.splitters)
        .slice(0, 6),
      topStreets: [...streets.values()]
        .sort((a, b) => b.criticalSplitters - a.criticalSplitters || b.splitters - a.splitters)
        .slice(0, 6),
    }
  }, [contextualRiskRanking])

  const contextualLifecycle = useMemo(() => {
    const rows = contextualRiskRanking
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
        massivaTickets: scoped.reduce((sum, row) => sum + row.totalTickets, 0),
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
  }, [contextualRiskRanking])

  const hasActiveFilters =
    selectedMatrixKey !== null || riskBandFilter !== 'all' || ageFilter !== 'all' || splitterSearch.trim() !== ''

  function clearAllFilters() {
    setSelectedMatrixKey(null)
    setRiskBandFilter('all')
    setAgeFilter('all')
    setSplitterSearch('')
  }

  return (
    <div className="space-y-5">
      <header className="rounded-[28px] border border-white/50 bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 p-6 text-white shadow-2xl shadow-amber-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Novo Módulo</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Painel da rede</h1>
            <p className="mt-1 text-sm text-white/80">
              Tendências e recorrência operacional para suporte à decisão de rede.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
            {showBackgroundRefresh ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-white/95" aria-hidden />
            ) : null}
            {showBackgroundRefresh ? (
              <span className="text-[10px] font-bold normal-case tracking-normal text-white/90">
                Atualizando dados…
              </span>
            ) : null}
            <span>Fonte: {source === 'mock' ? 'Mock fallback' : 'BFF local'}</span>
          </span>
        </div>
      </header>

      <DateRangeSelector
        preset={preset}
        onPresetChange={setPreset}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <section className="rounded-3xl border border-white/45 bg-white/65 p-3 shadow-lg shadow-amber-500/10 backdrop-blur-xl">
        <div className="space-y-2.5">
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex min-w-full items-center gap-2 pr-2 sm:flex sm:min-w-0 sm:flex-wrap sm:pr-0">
              {([
                { id: 'visao-geral', label: 'Visão Geral' },
                { id: 'risco', label: 'Risco' },
                { id: 'operacao', label: 'Operação' },
                { id: 'geografico', label: 'Geográfico' },
                { id: 'ciclo-vida', label: 'Ciclo de Vida' },
              ] as Array<{ id: IntelligenceWindow; label: string }>).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveWindow(item.id)}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition sm:text-xs',
                    activeWindow === item.id
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30'
                      : 'bg-white/80 text-slate-600 hover:bg-amber-50 hover:text-amber-700',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input
              value={splitterSearch}
              onChange={(e) => setSplitterSearch(e.target.value)}
              placeholder="Buscar splitter/OLT..."
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-xs text-slate-700 sm:w-52 sm:py-1.5"
            />
            <select
              value={riskBandFilter}
              onChange={(e) =>
                setRiskBandFilter(
                  e.target.value as 'all' | 'critico' | 'alto' | 'moderado' | 'baixo',
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-xs text-slate-700 sm:w-auto sm:py-1.5"
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
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-xs text-slate-700 sm:w-auto sm:py-1.5"
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
                'w-full rounded-lg border px-2 py-2 text-xs font-bold transition sm:w-auto sm:py-1.5',
                hasActiveFilters
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400',
              )}
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900">
        <p className="font-semibold">
          Base do ranking: <span className="font-black">{deltaReferenceLabel}</span>
        </p>
        <p className="text-amber-800/90">
          O score e os deltas exibidos seguem o período selecionado no filtro de datas.
        </p>
      </section>

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
              {previewOccupancyPercent(networkStatsPreview).toFixed(1)}%
            </span>{' '}
            ocupação ·{' '}
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
              {(kpis.overallOccupancyPercent ?? 0).toFixed(1)}%
              <span className="ml-1.5 text-sm font-semibold text-slate-500">ocupação geral (rede)</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {trends.length} splitter{trends.length === 1 ? '' : 's'} com tendência no intervalo
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
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
            <p className="mt-0.5 text-xs text-slate-500">Classificação dos splitters no intervalo (rótulo de tendência).</p>
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
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }} />
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
            <p className="mt-0.5 text-xs text-slate-500">Soma no recorte temporal (histórico por splitter).</p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50/90 px-3 py-2.5 ring-1 ring-slate-200/80">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tickets</dt>
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
            <p className="mt-0.5 text-xs text-slate-500">Maior uso, maior {deltaReferenceLabel} e mais massivas no intervalo.</p>
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
                      {(
                        deltaReferenceLabel === 'Δ7d'
                          ? intelligenceSnapshot.topDelta.delta7d
                          : intelligenceSnapshot.topDelta.delta30d
                      ).toFixed(2)}
                      % no período
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
            <div className="grid gap-3 lg:col-span-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Risco crítico</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-rose-800">
                  {decisionKpis.criticalSplitters.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-rose-700/90">splitters ≥95% ocupação</p>
              </div>
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">Crescimento forte</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-amber-900">
                  {decisionKpis.growthSplitters.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-amber-800/90">splitters com {deltaReferenceLabel} ≥ 5%</p>
              </div>
              <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">Impacto em risco alto</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-violet-900">
                  {decisionKpis.highRiskAffectedClients.toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-violet-800/90">clientes afetados (alto/crítico)</p>
              </div>
              <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">Pressão operacional</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-sky-900">
                  {decisionKpis.attentionSharePercent.toFixed(1)}%
                </p>
                <p className="text-[11px] text-sky-800/90">crítico + crescimento forte</p>
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
      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.03 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-bold text-slate-800">Ranking de risco por splitter</h2>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] text-slate-500">Score combina ocupação, crescimento, massivas e afetados</p>
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
                    <span className="font-semibold">{deltaReferenceLabel}:</span> {row.selectedDelta >= 0 ? '+' : ''}
                    {row.selectedDelta.toFixed(2)}%
                  </p>
                  <p><span className="font-semibold">Massivas:</span> {row.openTickets}/{row.totalTickets}</p>
                  <p><span className="font-semibold">Afetados:</span> {row.affectedClientsTotal.toLocaleString('pt-BR')}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Splitter</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">Uso</th>
                  <th className="px-2 py-2">{deltaReferenceLabel}</th>
                  <th className="px-2 py-2">Massivas</th>
                  <th className="px-2 py-2">Afetados</th>
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
                    <td className="px-2 py-2 font-semibold tabular-nums text-slate-800">
                      {row.selectedDelta >= 0 ? '+' : ''}
                      {row.selectedDelta.toFixed(2)}%
                    </td>
                    <td className="px-2 py-2 tabular-nums text-slate-700">{row.openTickets}/{row.totalTickets}</td>
                    <td className="px-2 py-2 tabular-nums text-slate-700">{row.affectedClientsTotal.toLocaleString('pt-BR')}</td>
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
          <h2 className="text-sm font-bold text-slate-800">Matriz impacto x urgência</h2>
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
          <p className="mt-2 text-[11px] text-slate-500">
            Clique em um quadrante para filtrar ranking e drill-down de forma contextual.
          </p>
        </motion.article>
      </section>
        </>
      ) : null}

      {activeWindow === 'ciclo-vida' ? (
        <>
      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Risco por ciclo de vida</h2>
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
                  <th className="px-2 py-2">{deltaReferenceLabel}</th>
                  <th className="px-2 py-2">ETA 95%</th>
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
                    <td className="px-2 py-2 tabular-nums">{row.selectedDelta >= 0 ? '+' : ''}{row.selectedDelta.toFixed(2)}%</td>
                    <td className="px-2 py-2 tabular-nums">{row.etaTo95Days == null ? '—' : `${row.etaTo95Days} dias`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.article>
      </section>
      <section className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
        <h2 className="text-sm font-bold text-slate-800">Alertas de ciclo de vida</h2>
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
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Faixa (anos)</th>
                  <th className="px-2 py-2">Splitters</th>
                  <th className="px-2 py-2">Uso médio</th>
                  <th className="px-2 py-2">{deltaReferenceLabel} médio</th>
                  <th className="px-2 py-2">Tickets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contextualLifecycle.buckets.map((row) => (
                  <tr key={row.bucket} className="hover:bg-slate-50/70">
                    <td className="px-2 py-2 font-semibold">{row.bucket}</td>
                    <td className="px-2 py-2 tabular-nums">{row.splitters}</td>
                    <td className="px-2 py-2 tabular-nums">{row.avgUsagePercent.toFixed(1)}%</td>
                    <td className="px-2 py-2 tabular-nums">{row.avgDeltaReference >= 0 ? '+' : ''}{row.avgDeltaReference.toFixed(2)}%</td>
                    <td className="px-2 py-2 tabular-nums">{row.massivaTickets.toLocaleString('pt-BR')}</td>
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
          <h2 className="text-sm font-bold text-slate-800">Heatmap idade x saturação</h2>
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
        </motion.article>
      </section>
      <section className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl">
        <h2 className="text-sm font-bold text-slate-800">Cohorts por ano de implantação</h2>
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
              <h2 className="text-sm font-bold text-slate-800">Tendência de Ocupação (Média)</h2>
            </div>
          </div>
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
                  formatter={(value: unknown) => [`${Number(value ?? 0).toFixed(2)}%`, 'Uso']}
                />
                <Area type="monotone" dataKey="usagePercent" stroke="#f59e0b" strokeWidth={2.2} fill="url(#usageGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-slate-800">Status por Splitter</h2>
          </div>
          <ul className="space-y-2">
            {trends.slice(0, 8).map((row) => (
              <li key={row.splitterCode} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50/80 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  {row.splitterTitle.trim() !== '' ? (
                    <>
                      <p className="truncate text-xs font-bold text-slate-800" title={row.splitterTitle.trim()}>
                        {row.splitterTitle.trim()}
                      </p>
                      <p className="font-mono text-[10px] font-semibold text-slate-500">{row.splitterCode}</p>
                    </>
                  ) : (
                    <p className="text-xs font-bold text-slate-700">{row.splitterCode}</p>
                  )}
                  <p className="text-[11px] text-slate-500">delta7d: {row.delta7d.toFixed(2)}%</p>
                </div>
                <span className={cn('rounded-full border px-2 py-1 text-[10px] font-bold', trendBadgeClass(row.label))}>
                  {row.label}
                </span>
              </li>
            ))}
          </ul>
        </motion.article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center gap-2">
            <Ticket size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-slate-800">Histórico de Massivas por Splitter</h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barPoints}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="splitterCode" hide />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                  formatter={(value: unknown, name: unknown) => [
                    Number(value ?? 0).toLocaleString('pt-BR'),
                    String(name ?? ''),
                  ]}
                />
                <Bar dataKey="totalTickets" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                <Bar dataKey="affectedClientsTotal" fill="#fbbf24" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18 }}
          className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center gap-2">
            <Database size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-slate-800">Recorrência (Dia x Turno)</h2>
          </div>
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

      {activeWindow === 'geografico' ? (
        <>
      <section className="grid gap-4 xl:grid-cols-3">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="xl:col-span-2 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
        >
          <h2 className="text-sm font-bold text-slate-800">Drill-down por AP/OLT</h2>
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
                  <p><span className="font-semibold">Afetados:</span> {row.affectedClientsTotal.toLocaleString('pt-BR')}</p>
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
                  <th className="px-2 py-2">Afetados</th>
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
                    <td className="px-2 py-2 tabular-nums">{row.affectedClientsTotal.toLocaleString('pt-BR')}</td>
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
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {contextualGeoDrilldown.tipoLocal.map((item) => (
                <div key={item.key} className="rounded-xl bg-slate-50/90 px-2 py-2 text-center ring-1 ring-slate-200/70">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{item.key.replace('_', ' ')}</p>
                  <p className="text-lg font-black tabular-nums text-slate-900">{item.count}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Top condomínios por impacto</p>
              <ul className="mt-1.5 space-y-1.5">
                {contextualGeoDrilldown.topCondominios.map((item) => (
                  <li key={item.nome} className="rounded-lg bg-slate-50/80 px-2 py-1.5 text-[11px] text-slate-700">
                    <p className="truncate font-semibold">{item.nome}</p>
                    <p>{item.splitters} splitters · {item.affectedClientsTotal.toLocaleString('pt-BR')} afetados</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Top ruas com criticidade</p>
              <ul className="mt-1.5 space-y-1.5">
                {contextualGeoDrilldown.topStreets.map((item) => (
                  <li key={item.nome} className="rounded-lg bg-slate-50/80 px-2 py-1.5 text-[11px] text-slate-700">
                    <p className="truncate font-semibold">{item.nome}</p>
                    <p>{item.splitters} splitters · {item.criticalSplitters} críticos</p>
                  </li>
                ))}
              </ul>
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
        <h2 className="mb-1 text-sm font-bold text-slate-800">Mapa de saturação por splitter</h2>
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Pontos na posição cadastrada (OpenStreetMap), cores por uso de portas; passe o mouse para o resumo ou clique para
          abrir o splitter — mesmo estilo de mapa da ficha individual.
        </p>
        <Suspense
          fallback={
            <div
              className="h-[min(420px,55vh)] w-full animate-pulse rounded-2xl bg-slate-100/90"
              aria-hidden
            />
          }
        >
          <IntelligenceSaturationMap cells={saturationCells} />
        </Suspense>
      </motion.section>
        </>
      ) : null}
          </motion.div>
        </AnimatePresence>
      ) : null}

      {source === 'mock' ? (
        <p className="text-xs font-semibold text-slate-500">
          Backend local indisponível no momento. A tela segue funcional com mock mantendo o mesmo shape dos endpoints.
        </p>
      ) : null}
    </div>
  )
}
