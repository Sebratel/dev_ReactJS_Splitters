import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react'
import { fetchMassivaHistoryListFromLocalDb } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { fetchMassivaHistoryMttdMttrKpis } from '@/features/massiva/api/fetchMassivaHistoryMttdMttrKpis'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import {
  formatMonthLabel,
  massivaHistoryLimitForRange,
  resolveMassivaPeriod,
  startOfDay,
  startOfMonth,
  startOfWeek,
  type MassivaBucketGranularity,
  type MassivaPeriodPreset,
} from '@/features/massiva/lib/massivaPeriod'
import {
  rankMassivaAccessPoints,
  summarizeMassivaSla,
} from '@/features/massiva/lib/massivaInsights'
import { fetchAccessPointsForFiltersFromLocalDb } from '@/features/splitters/api/fetchAccessPointsForFiltersFromLocalDb'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'
import { formatBrazilDayMonthDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

// ---------------------------------------------------------------------------
// Utilitários locais
// ---------------------------------------------------------------------------

/** Formata minutos em texto legível: "45min", "1h 23min", "2d 3h". */
function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return '—'
  const m = Math.round(minutes)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h < 24) return rem === 0 ? `${h}h` : `${h}h ${rem}min`
  const d = Math.floor(h / 24)
  const hRem = h % 24
  return hRem === 0 ? `${d}d` : `${d}d ${hRem}h`
}

/** Formata mês "YYYY-MM" em rótulo curto "jun/26". */
function formatMonthShort(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return month
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const idx = parseInt(m[2] ?? '1', 10) - 1
  const yearShort = String(parseInt(m[1] ?? '0', 10)).slice(-2)
  return `${MONTHS[idx] ?? month}/${yearShort}`
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

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

type KpiCardProps = {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  color: 'neutral' | 'amber' | 'rose' | 'emerald' | 'sky' | 'violet'
}

const COLOR_MAP: Record<
  KpiCardProps['color'],
  { border: string; bg: string; label: string; value: string; sub: string }
> = {
  neutral: {
    border: 'border-neutral-200/80',
    bg: 'bg-neutral-50/60',
    label: 'text-neutral-600',
    value: 'text-neutral-900',
    sub: 'text-neutral-500/70',
  },
  amber: {
    border: 'border-amber-200/80',
    bg: 'bg-amber-50/60',
    label: 'text-amber-800/90',
    value: 'text-amber-900',
    sub: 'text-amber-700/70',
  },
  rose: {
    border: 'border-rose-200/80',
    bg: 'bg-rose-50/60',
    label: 'text-rose-700',
    value: 'text-rose-800',
    sub: 'text-rose-700/70',
  },
  emerald: {
    border: 'border-emerald-200/80',
    bg: 'bg-emerald-50/60',
    label: 'text-emerald-700',
    value: 'text-emerald-800',
    sub: 'text-emerald-700/70',
  },
  sky: {
    border: 'border-sky-200/80',
    bg: 'bg-sky-50/60',
    label: 'text-sky-700',
    value: 'text-sky-800',
    sub: 'text-sky-700/70',
  },
  violet: {
    border: 'border-violet-200/80',
    bg: 'bg-violet-50/60',
    label: 'text-violet-700',
    value: 'text-violet-800',
    sub: 'text-violet-700/70',
  },
}

function KpiCard({ label, value, sub, color }: KpiCardProps) {
  const c = COLOR_MAP[color]
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', c.border, c.bg)}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', c.label)}>{label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', c.value)}>{value}</p>
      {sub != null && <p className={cn('mt-0.5 text-[10px]', c.sub)}>{sub}</p>}
    </div>
  )
}

type HBarProps = { label: string; count: number; max: number; total: number }

function HBar({ label, count, max, total }: HBarProps) {
  const pct = max > 0 ? (count / max) * 100 : 0
  const pctOfTotal = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-neutral-700" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-800">
          {count}
          <span className="ml-1 font-normal text-neutral-400">({pctOfTotal}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PERIOD_PRESETS: Array<{ value: MassivaPeriodPreset; label: string }> = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
]

const MTTD_MTTR_MONTHS = 6
type ChartMetric = 'afetados' | 'protocolos'

const CARD_SECTION_CLS =
  'rounded-xl bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/70'
const SECTION_HEADER_CLS = 'border-b border-neutral-200/80 px-4 py-3 sm:px-5'

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function MassivaDashboardScreen() {
  const [periodPreset, setPeriodPreset] = useState<MassivaPeriodPreset>('30d')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('afetados')
  const queryClient = useQueryClient()

  // Período resolvido
  const range = useMemo(() => resolveMassivaPeriod(periodPreset, null), [periodPreset])
  const historyListStart = range.fetchStart
  const historyListLimit = massivaHistoryLimitForRange(range)

  // Histórico local (massiva_history)
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

  // KPIs mensais de MTTD/MTTR (últimos N meses)
  const mttdMttrKpisQuery = useQuery({
    queryKey: massivaKeys.mttdMttrKpis(MTTD_MTTR_MONTHS),
    queryFn: () => fetchMassivaHistoryMttdMttrKpis(MTTD_MTTR_MONTHS),
    staleTime: 5 * 60_000,
    refetchOnMount: 'always',
  })

  // Títulos dos pontos de acesso (OLT/AP names) para enriquecer o ranking
  const accessPointsQuery = useQuery({
    queryKey: splittersKeys.accessPointsForFilters(),
    queryFn: fetchAccessPointsForFiltersFromLocalDb,
    staleTime: 10 * 60_000,
  })

  const refreshDashboard = () => {
    void historyQuery.refetch()
    void mttdMttrKpisQuery.refetch()
    void queryClient.invalidateQueries({ queryKey: massivaKeys.all })
  }

  // Dados filtrados para o período selecionado
  const rowsInPeriod = useMemo(() => {
    const s = range.start.getTime()
    const e = range.end.getTime()
    return (historyQuery.data ?? []).filter((row) => {
      const t = row.openedAt?.getTime()
      return t != null && t >= s && t <= e
    })
  }, [historyQuery.data, range.start, range.end])

  // KPIs de protocolo
  const kpis = useMemo(() => {
    const total = rowsInPeriod.length
    const encerradas = rowsInPeriod.filter((r) => r.status === 'encerrada').length
    const abertas = rowsInPeriod.filter((r) => r.status === 'aberta').length
    const sla = summarizeMassivaSla(
      rowsInPeriod.map((r) => ({
        status: r.status,
        closedAt: r.closedAt,
        expectedCloseAt: r.expectedCloseAt,
        protocol: r.protocol ?? 0,
        assignmentId: null,
        apCode: r.accessPointCode,
        splitterCode: '',
        affectedClients: r.affectedClients,
        openedAt: r.openedAt,
        title: r.title,
        description: '',
        createdBy: r.operatorEmail,
        responsible: '',
        mttdMinutes: r.mttdMinutes,
        mttrMinutes: r.mttrMinutes,
      })),
    )
    return { total, encerradas, abertas, sla }
  }, [rowsInPeriod])

  // MTTD / MTTR médios do período
  const periodMttdMttr = useMemo(() => {
    const mttdRows = rowsInPeriod.filter(
      (r) => r.mttdMinutes != null && r.mttdMinutes >= 0 && r.status !== 'cancelada',
    )
    const mttrRows = rowsInPeriod.filter(
      (r) => r.mttrMinutes != null && r.mttrMinutes >= 0 && r.status === 'encerrada',
    )
    const avgMttd =
      mttdRows.length > 0
        ? mttdRows.reduce((sum, r) => sum + (r.mttdMinutes ?? 0), 0) / mttdRows.length
        : null
    const avgMttr =
      mttrRows.length > 0
        ? mttrRows.reduce((sum, r) => sum + (r.mttrMinutes ?? 0), 0) / mttrRows.length
        : null
    return { avgMttd, avgMttr, mttdCount: mttdRows.length, mttrCount: mttrRows.length }
  }, [rowsInPeriod])

  // Série temporal (afetados / protocolos por bucket)
  const chartSeries = useMemo(() => {
    const byBucket = new Map<string, { at: Date; label: string; afetados: number; protocolos: number }>()
    for (const row of rowsInPeriod) {
      if (!row.openedAt) continue
      const at = bucketStart(row.openedAt, range.bucket)
      const key = at.toISOString()
      const cur = byBucket.get(key) ?? { at, label: bucketLabel(at, range.bucket), afetados: 0, protocolos: 0 }
      cur.afetados += Math.max(0, row.affectedClients)
      cur.protocolos += 1
      byBucket.set(key, cur)
    }
    return [...byBucket.values()].sort((a, b) => a.at.getTime() - b.at.getTime())
  }, [rowsInPeriod, range.bucket])

  const chartBucketLabel = range.bucket === 'month' ? 'mês' : range.bucket === 'week' ? 'semana' : 'dia'

  // Ranking de pontos de acesso
  const apRanking = useMemo(
    () =>
      rankMassivaAccessPoints(
        rowsInPeriod.map((r) => ({
          protocol: r.protocol ?? 0,
          assignmentId: null,
          apCode: r.accessPointCode,
          splitterCode: '',
          affectedClients: r.affectedClients,
          openedAt: r.openedAt,
          status: r.status,
          closedAt: r.closedAt,
          expectedCloseAt: r.expectedCloseAt,
          title: r.title,
          description: '',
          createdBy: r.operatorEmail,
          responsible: '',
          mttdMinutes: r.mttdMinutes,
          mttrMinutes: r.mttrMinutes,
        })),
        8,
      ),
    [rowsInPeriod],
  )

  /** Lookup: accessPointCode → OLT/AP title para exibição no ranking. */
  const apCodeToTitle = useMemo(() => {
    const map = new Map<string, string>()
    for (const ap of accessPointsQuery.data ?? []) {
      if (ap.code && ap.title) map.set(ap.code, ap.title)
    }
    return map
  }, [accessPointsQuery.data])

  // Distribuição de classificação (tipo + impacto)
  const classifDistribution = useMemo(() => {
    if (rowsInPeriod.length === 0) return null
    const byTipo = new Map<string, number>()
    const byImpacto = new Map<string, number>()
    let filledTipo = 0
    let filledImpacto = 0
    for (const r of rowsInPeriod) {
      if (r.tipoIncidente) {
        byTipo.set(r.tipoIncidente, (byTipo.get(r.tipoIncidente) ?? 0) + 1)
        filledTipo++
      }
      if (r.impacto) {
        byImpacto.set(r.impacto, (byImpacto.get(r.impacto) ?? 0) + 1)
        filledImpacto++
      }
    }
    if (filledTipo === 0 && filledImpacto === 0) return null
    const sortDesc = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    return {
      total: rowsInPeriod.length,
      tipo: sortDesc(byTipo),
      impacto: sortDesc(byImpacto),
      filledTipo,
      filledImpacto,
    }
  }, [rowsInPeriod])

  // Alerta de MTTR crescente por 3 meses consecutivos
  const mttrTrendAlert = useMemo(() => {
    const data = (mttdMttrKpisQuery.data ?? []).filter(
      (m) => m.avgMttrMinutes != null && m.mttrCount >= 3,
    )
    if (data.length < 3) return null
    const last3 = data.slice(-3)
    const [a, b, c] = last3
    if ((a?.avgMttrMinutes ?? 0) >= (b?.avgMttrMinutes ?? 0)) return null
    if ((b?.avgMttrMinutes ?? 0) >= (c?.avgMttrMinutes ?? 0)) return null
    return {
      months: last3.map((m) => ({ month: m.month, mttrMinutes: m.avgMttrMinutes! })),
    }
  }, [mttdMttrKpisQuery.data])

  // Série para o gráfico de tendência mensal
  const trendChartData = useMemo(
    () =>
      (mttdMttrKpisQuery.data ?? []).map((m) => ({
        month: formatMonthShort(m.month),
        mttd: m.avgMttdMinutes != null ? Math.round(m.avgMttdMinutes) : null,
        mttr: m.avgMttrMinutes != null ? Math.round(m.avgMttrMinutes) : null,
        total: m.total,
      })),
    [mttdMttrKpisQuery.data],
  )

  const isLoading = historyQuery.isPending
  const isError = historyQuery.isError

  return (
    <div className="space-y-5">
      {/* ── Toolbar: presets de período + refresh ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Período:</span>
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {PERIOD_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriodPreset(value)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                periodPreset === value
                  ? 'bg-white text-amber-700 shadow-sm ring-1 ring-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-800',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-neutral-400">{range.label}</span>

        <button
          type="button"
          onClick={refreshDashboard}
          disabled={historyQuery.isFetching || mttdMttrKpisQuery.isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-50"
        >
          <RefreshCw
            className={cn(
              'h-3.5 w-3.5',
              (historyQuery.isFetching || mttdMttrKpisQuery.isFetching) && 'animate-spin',
            )}
          />
          Atualizar
        </button>
      </div>

      {/* ── Alerta de MTTR crescente ──────────────────────────────────── */}
      {mttrTrendAlert != null && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              MTTR crescente nos últimos 3 meses
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              {mttrTrendAlert.months
                .map((m) => `${formatMonthShort(m.month)}: ${formatMinutes(m.mttrMinutes)}`)
                .join(' → ')}
              {' '}— considere investigar as causas raiz.
            </p>
          </div>
        </div>
      )}

      {/* ── Erro do historyQuery ──────────────────────────────────────── */}
      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao carregar histórico de massivas. Tente atualizar.
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          color="neutral"
          label="Total de protocolos"
          value={isLoading ? '…' : kpis.total.toLocaleString('pt-BR')}
          sub="no período"
        />
        <KpiCard
          color="amber"
          label="Abertas"
          value={isLoading ? '…' : kpis.abertas.toLocaleString('pt-BR')}
          sub="em aberto"
        />
        <KpiCard
          color="emerald"
          label="Encerradas"
          value={isLoading ? '…' : kpis.encerradas.toLocaleString('pt-BR')}
          sub="no período"
        />
        <KpiCard
          color="sky"
          label="SLA"
          value={
            isLoading
              ? '…'
              : kpis.sla.pct === null
                ? '—'
                : `${Math.round(kpis.sla.pct)}%`
          }
          sub={
            kpis.sla.evaluated > 0
              ? `${kpis.sla.within}/${kpis.sla.evaluated} dentro`
              : 'sem base avaliável'
          }
        />
        <KpiCard
          color="violet"
          label="MTTD médio"
          value={isLoading ? '…' : formatMinutes(periodMttdMttr.avgMttd)}
          sub={
            periodMttdMttr.mttdCount > 0
              ? `${periodMttdMttr.mttdCount} registros`
              : 'sem dados'
          }
        />
        <KpiCard
          color="rose"
          label="MTTR médio"
          value={isLoading ? '…' : formatMinutes(periodMttdMttr.avgMttr)}
          sub={
            periodMttdMttr.mttrCount > 0
              ? `${periodMttdMttr.mttrCount} encerradas`
              : 'sem dados'
          }
        />
      </div>

      {/* ── Gráfico de série temporal (afetados / protocolos) ─────────── */}
      <div className={CARD_SECTION_CLS}>
        <div className={cn(SECTION_HEADER_CLS, 'flex flex-wrap items-center justify-between gap-2')}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              Série temporal
            </p>
            <h2 className="mt-1 text-sm font-semibold text-neutral-900">
              Total por {chartBucketLabel} — {range.label}
            </h2>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200/90 bg-neutral-50 p-0.5">
            {(['afetados', 'protocolos'] as ChartMetric[]).map((metric) => (
              <button
                key={metric}
                type="button"
                onClick={() => setChartMetric(metric)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition',
                  chartMetric === metric
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100',
                )}
              >
                {metric}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-4 sm:px-5">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-400">
              Carregando…
            </div>
          ) : chartSeries.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-400">
              Sem dados no período selecionado.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value.toLocaleString('pt-BR'),
                    name === 'afetados' ? 'Afetados' : 'Protocolos',
                  ]}
                  labelStyle={{ fontSize: 12, fontWeight: 600 }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar
                  dataKey={chartMetric}
                  name={chartMetric}
                  fill={chartMetric === 'afetados' ? '#fb7185' : '#6366f1'}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Tendência mensal + Ranking de OLTs ───────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        {/* Gráfico de tendência MTTD / MTTR */}
        <div className={CARD_SECTION_CLS}>
          <div className={SECTION_HEADER_CLS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              Tendência mensal
            </p>
            <h2 className="mt-1 text-sm font-semibold text-neutral-900">
              MTTD e MTTR — últimos {MTTD_MTTR_MONTHS} meses
            </h2>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              MTTD: início do evento → identificação · MTTR: identificação → encerramento
            </p>
          </div>
          <div className="px-4 py-4 sm:px-5">
            {mttdMttrKpisQuery.isPending ? (
              <div className="flex h-48 items-center justify-center text-sm text-neutral-400">
                Carregando…
              </div>
            ) : trendChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-neutral-400">
                Sem dados de MTTD/MTTR disponíveis.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={trendChartData}
                  margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatMinutes(v)}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatMinutes(value),
                      name === 'mttd' ? 'MTTD médio' : 'MTTR médio',
                    ]}
                    labelStyle={{ fontSize: 12, fontWeight: 600 }}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend
                    formatter={(value) => (value === 'mttd' ? 'MTTD' : 'MTTR')}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mttd"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="mttr"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Ranking de pontos de acesso */}
        <div className={CARD_SECTION_CLS}>
          <div className={SECTION_HEADER_CLS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              Top OLTs / APs
            </p>
            <h2 className="mt-1 text-sm font-semibold text-neutral-900">
              Maior recorrência no período
            </h2>
          </div>
          <div className="space-y-3 px-4 py-4 sm:px-5">
            {isLoading ? (
              <p className="text-sm text-neutral-400">Carregando…</p>
            ) : apRanking.length === 0 ? (
              <p className="text-sm text-neutral-400">Sem dados no período.</p>
            ) : (
              apRanking.map((ap) => (
                <HBar
                  key={ap.apCode}
                  label={apCodeToTitle.get(ap.apCode) ?? ap.apCode}
                  count={ap.protocols}
                  max={apRanking[0]?.protocols ?? 1}
                  total={kpis.total}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Distribuição de classificação ────────────────────────────── */}
      {(classifDistribution != null || isLoading) && (
        <div className={CARD_SECTION_CLS}>
          <div className={SECTION_HEADER_CLS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              Classificação
            </p>
            <h2 className="mt-1 text-sm font-semibold text-neutral-900">
              Distribuição por tipo e impacto
            </h2>
          </div>

          {isLoading ? (
            <div className="px-4 py-4 text-sm text-neutral-400">Carregando…</div>
          ) : classifDistribution == null ? (
            <div className="px-4 py-4 text-sm text-neutral-400">
              Nenhum dado de classificação preenchido no período.
            </div>
          ) : (
            <div className="grid gap-6 px-4 py-4 sm:grid-cols-2 sm:px-5">
              {/* Tipo de incidente */}
              <div>
                <p className="mb-3 text-xs font-semibold text-neutral-600">
                  Tipo de incidente
                  <span className="ml-1.5 font-normal text-neutral-400">
                    ({classifDistribution.filledTipo}/{classifDistribution.total} preenchidos)
                  </span>
                </p>
                {classifDistribution.tipo.length === 0 ? (
                  <p className="text-xs text-neutral-400">Sem dados.</p>
                ) : (
                  <div className="space-y-2.5">
                    {classifDistribution.tipo.map(([name, count]) => (
                      <HBar
                        key={name}
                        label={name}
                        count={count}
                        max={classifDistribution.tipo[0]?.[1] ?? 1}
                        total={classifDistribution.filledTipo}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Impacto */}
              <div>
                <p className="mb-3 text-xs font-semibold text-neutral-600">
                  Impacto
                  <span className="ml-1.5 font-normal text-neutral-400">
                    ({classifDistribution.filledImpacto}/{classifDistribution.total} preenchidos)
                  </span>
                </p>
                {classifDistribution.impacto.length === 0 ? (
                  <p className="text-xs text-neutral-400">Sem dados.</p>
                ) : (
                  <div className="space-y-2.5">
                    {classifDistribution.impacto.map(([name, count]) => (
                      <HBar
                        key={name}
                        label={name}
                        count={count}
                        max={classifDistribution.impacto[0]?.[1] ?? 1}
                        total={classifDistribution.filledImpacto}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
