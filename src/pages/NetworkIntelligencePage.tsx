import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
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

export function NetworkIntelligencePage() {
  const [preset, setPreset] = useState<IntelligenceDateRangePreset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

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
      if (!topDelta || t.delta30d > topDelta.delta30d) topDelta = t
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
  }, [trends, massivaStats, barPoints])

  const mapGeoSnapshot = useMemo(() => {
    const sliceTotal = saturationCells.length
    const sliceWithCoords = saturationCells.filter((c) =>
      hasValidSplitterCoords(c.latitude, c.longitude),
    ).length
    return { sliceTotal, sliceWithCoords }
  }, [saturationCells])

  const maxRecurrence = Math.max(1, ...recurrenceCells.map((cell) => cell.count))

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

      {!showFullSkeleton && kpis ? (
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
            <p className="mt-0.5 text-xs text-slate-500">Maior uso, maior Δ30d e mais massivas no intervalo.</p>
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
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Maior Δ30d</p>
                {intelligenceSnapshot.topDelta ? (
                  <>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                      {intelligenceSnapshot.topDelta.splitterTitle.trim() ||
                        intelligenceSnapshot.topDelta.splitterCode}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">{intelligenceSnapshot.topDelta.splitterCode}</p>
                    <p className="mt-1 text-xs font-black tabular-nums text-amber-700">
                      {intelligenceSnapshot.topDelta.delta30d >= 0 ? '+' : ''}
                      {intelligenceSnapshot.topDelta.delta30d.toFixed(2)}% em 30 dias
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
        </motion.section>
      ) : null}

      {showFullSkeleton ? <IntelligenceLowerDashboardSkeleton /> : null}

      {!showFullSkeleton ? (
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

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.22 }}
        className="overflow-visible rounded-3xl border border-white/50 bg-white/70 p-4 shadow-xl shadow-amber-500/10 backdrop-blur-xl"
      >
        <h2 className="mb-1 text-sm font-bold text-slate-800">Mapa de saturação por splitter</h2>
        <p className="mb-3 text-xs text-slate-500">
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

      {source === 'mock' ? (
        <p className="text-xs font-semibold text-slate-500">
          Backend local indisponível no momento. A tela segue funcional com mock mantendo o mesmo shape dos endpoints.
        </p>
      ) : null}
    </div>
  )
}
