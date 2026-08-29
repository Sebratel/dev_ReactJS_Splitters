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
import {
  AlertTriangle,
  ChevronLeft,
  Radio,
  RefreshCw,
  TrendingUp,
  Wrench,
  X,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { fetchMassivaHistoryListFromLocalDb } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { fetchMassivaHistoryMttdMttrKpis } from '@/features/massiva/api/fetchMassivaHistoryMttdMttrKpis'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import {
  formatMonthLabel,
  listRecentMonths,
  massivaHistoryLimitForRange,
  resolveMassivaPeriod,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toMonthValue,
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
// Tipos
// ---------------------------------------------------------------------------

type MassivaStatusFilter = 'all' | 'aberta' | 'encerrada' | 'cancelada'
type DashboardTab = 'visao_geral' | 'analise' | 'qualidade'

type DeltaResult = { pct: number; dir: 'up' | 'down' | 'same' } | null

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

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

function formatMonthShort(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return month
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const idx = parseInt(m[2] ?? '1', 10) - 1
  const yearShort = String(parseInt(m[1] ?? '0', 10)).slice(-2)
  return `${MONTHS[idx] ?? month}/${yearShort}`
}

function displayOperador(email: string): string {
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
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

function calcDelta(current: number, previous: number): DeltaResult {
  if (previous === 0) return null
  const rawPct = ((current - previous) / previous) * 100
  const pct = Math.abs(Math.round(rawPct))
  const dir: 'up' | 'down' | 'same' = rawPct > 0.5 ? 'up' : rawPct < -0.5 ? 'down' : 'same'
  return { pct, dir }
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return `${diffMin}min`
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}min`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

// --- KpiCard com delta opcional -------------------------------------------

type KpiCardProps = {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  color: 'neutral' | 'amber' | 'rose' | 'emerald' | 'sky' | 'violet'
  delta?: DeltaResult
  /** true = subida é boa (verde); false = subida é ruim (vermelho). Padrão: true */
  deltaPositiveGood?: boolean
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

function KpiCard({ label, value, sub, color, delta, deltaPositiveGood = true }: KpiCardProps) {
  const c = COLOR_MAP[color]

  let deltaNode: React.ReactNode = null
  if (delta && delta.dir !== 'same') {
    const isGood = deltaPositiveGood ? delta.dir === 'up' : delta.dir === 'down'
    const arrow = delta.dir === 'up' ? '▲' : '▼'
    deltaNode = (
      <span
        className={cn(
          'ml-1 text-[10px] font-semibold',
          isGood ? 'text-emerald-600' : 'text-rose-500',
        )}
      >
        {arrow} {delta.pct}%
      </span>
    )
  }

  return (
    <div className={cn('rounded-xl border px-3 py-2.5', c.border, c.bg)}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', c.label)}>{label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', c.value)}>
        {value}
        {deltaNode}
      </p>
      {sub != null && <p className={cn('mt-0.5 text-[10px]', c.sub)}>{sub}</p>}
    </div>
  )
}

// --- HBar -----------------------------------------------------------------

type HBarProps = { label: string; count: number; max: number; total: number; color?: string }

function HBar({ label, count, max, total, color = '#fbbf24' }: HBarProps) {
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
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
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
  { value: 'month', label: 'Mês' },
]

const STATUS_OPTIONS: Array<{ value: MassivaStatusFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'aberta', label: 'Abertas' },
  { value: 'encerrada', label: 'Encerradas' },
  { value: 'cancelada', label: 'Canceladas' },
]

const MTTD_MTTR_MONTHS = 6
type ChartMetric = 'afetados' | 'protocolos'

const DASHBOARD_TABS: Array<{ value: DashboardTab; label: string }> = [
  { value: 'visao_geral', label: 'Visão Geral' },
  { value: 'analise', label: 'Análise' },
  { value: 'qualidade', label: 'Qualidade' },
]

const IDENTIFIED_BY_LABEL: Record<string, string> = {
  tecnico: 'Técnico',
  zabbix: 'Zabbix',
  int6: 'INT6',
}
const IDENTIFIED_BY_COLOR: Record<string, string> = {
  tecnico: '#f59e0b',
  zabbix: '#8b5cf6',
  int6: '#3b82f6',
}

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CARD_SECTION_CLS =
  'rounded-xl bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/70'
const SECTION_HEADER_CLS = 'border-b border-neutral-200/80 px-4 py-3 sm:px-5'

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function MassivaDashboardScreen() {
  const [periodPreset, setPeriodPreset] = useState<MassivaPeriodPreset>('30d')
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date()))
  const monthOptions = useMemo(() => listRecentMonths(new Date(), 12), [])
  const [chartMetric, setChartMetric] = useState<ChartMetric>('afetados')
  const [statusFilter, setStatusFilter] = useState<MassivaStatusFilter>('all')
  const [operadorFilter, setOperadorFilter] = useState<string>('')
  const [apFilter, setApFilter] = useState<string>('')
  const [openListExpanded, setOpenListExpanded] = useState(false)
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('visao_geral')

  const queryClient = useQueryClient()

  const range = useMemo(
    () => resolveMassivaPeriod(periodPreset, periodPreset === 'month' ? selectedMonth : null),
    [periodPreset, selectedMonth],
  )
  const historyListStart = range.fetchStart
  const historyListLimit = massivaHistoryLimitForRange(range)

  const historyQuery = useQuery({
    queryKey: massivaKeys.historyList('all', historyListStart.toISOString(), 'merge', historyListLimit),
    queryFn: () =>
      fetchMassivaHistoryListFromLocalDb({ status: null, startDate: historyListStart, limit: historyListLimit }),
    staleTime: 60_000,
    refetchOnMount: 'always',
  })

  const mttdMttrKpisQuery = useQuery({
    queryKey: massivaKeys.mttdMttrKpis(MTTD_MTTR_MONTHS),
    queryFn: () => fetchMassivaHistoryMttdMttrKpis(MTTD_MTTR_MONTHS),
    staleTime: 5 * 60_000,
    refetchOnMount: 'always',
  })

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

  const apCodeToTitle = useMemo(() => {
    const map = new Map<string, string>()
    for (const ap of accessPointsQuery.data ?? []) {
      if (ap.code && ap.title) map.set(ap.code, ap.title)
    }
    return map
  }, [accessPointsQuery.data])

  // ── Massivas abertas agora (independe do período) ──────────────────────
  const openMassivas = useMemo(() => {
    return (historyQuery.data ?? [])
      .filter((r) => r.status === 'aberta')
      .sort((a, b) => (b.affectedClients ?? 0) - (a.affectedClients ?? 0))
  }, [historyQuery.data])

  const slaRisk = useMemo(() => {
    const now = Date.now()
    const twoHoursMs = 2 * 60 * 60 * 1000
    const overdue = openMassivas.filter(
      (r) => r.expectedCloseAt && r.expectedCloseAt.getTime() < now,
    )
    const atRisk = openMassivas.filter((r) => {
      if (!r.expectedCloseAt) return false
      const t = r.expectedCloseAt.getTime()
      return t >= now && t < now + twoHoursMs
    })
    return { overdue, atRisk }
  }, [openMassivas])

  // ── Dados filtrados por período ────────────────────────────────────────
  const rowsInPeriod = useMemo(() => {
    const s = range.start.getTime()
    const e = range.end.getTime()
    return (historyQuery.data ?? []).filter((row) => {
      const t = row.openedAt?.getTime()
      return t != null && t >= s && t <= e
    })
  }, [historyQuery.data, range.start, range.end])

  // Período anterior (mesma duração, deslocado para trás) — para deltas
  const rowsPreviousPeriod = useMemo(() => {
    const duration = range.end.getTime() - range.start.getTime()
    const prevEnd = range.start.getTime()
    const prevStart = prevEnd - duration
    return (historyQuery.data ?? []).filter((row) => {
      const t = row.openedAt?.getTime()
      return t != null && t >= prevStart && t <= prevEnd
    })
  }, [historyQuery.data, range.start, range.end])

  // Opções de filtro (derivadas do período)
  const operadorOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const r of rowsInPeriod) {
      if (r.operatorEmail) seen.add(r.operatorEmail)
    }
    return [...seen].sort()
  }, [rowsInPeriod])

  const apOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const r of rowsInPeriod) {
      if (r.accessPointCode) seen.add(r.accessPointCode)
    }
    return [...seen].sort()
  }, [rowsInPeriod])

  // Dados com todos os filtros aplicados
  const filteredRows = useMemo(() => {
    let rows = rowsInPeriod
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter)
    if (operadorFilter !== '') rows = rows.filter((r) => r.operatorEmail === operadorFilter)
    if (apFilter !== '') rows = rows.filter((r) => r.accessPointCode === apFilter)
    return rows
  }, [rowsInPeriod, statusFilter, operadorFilter, apFilter])

  const activeFilterCount = [statusFilter !== 'all', operadorFilter !== '', apFilter !== ''].filter(Boolean).length
  const clearFilters = () => { setStatusFilter('all'); setOperadorFilter(''); setApFilter('') }

  // ── KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filteredRows.length
    const encerradas = filteredRows.filter((r) => r.status === 'encerrada').length
    const abertas = filteredRows.filter((r) => r.status === 'aberta').length
    const totalAfetados = filteredRows.reduce((s, r) => s + Math.max(0, r.affectedClients), 0)
    const sla = summarizeMassivaSla(filteredRows.map((r) => ({
      status: r.status, closedAt: r.closedAt, expectedCloseAt: r.expectedCloseAt,
      protocol: r.protocol ?? 0, assignmentId: null, apCode: r.accessPointCode, splitterCode: '',
      affectedClients: r.affectedClients, openedAt: r.openedAt, title: r.title, description: '',
      createdBy: r.operatorEmail, responsible: '', mttdMinutes: r.mttdMinutes, mttrMinutes: r.mttrMinutes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any)
    return { total, encerradas, abertas, totalAfetados, sla }
  }, [filteredRows])

  const prevKpis = useMemo(() => {
    const total = rowsPreviousPeriod.length
    const encerradas = rowsPreviousPeriod.filter((r) => r.status === 'encerrada').length
    const abertas = rowsPreviousPeriod.filter((r) => r.status === 'aberta').length
    const totalAfetados = rowsPreviousPeriod.reduce((s, r) => s + Math.max(0, r.affectedClients), 0)
    return { total, encerradas, abertas, totalAfetados }
  }, [rowsPreviousPeriod])

  // ── MTTD / MTTR médios ─────────────────────────────────────────────────
  const periodMttdMttr = useMemo(() => {
    const mttdRows = filteredRows.filter((r) => r.mttdMinutes != null && r.mttdMinutes >= 0 && r.status !== 'cancelada')
    const mttrRows = filteredRows.filter((r) => r.mttrMinutes != null && r.mttrMinutes >= 0 && r.status === 'encerrada')
    const avgMttd = mttdRows.length > 0 ? mttdRows.reduce((s, r) => s + (r.mttdMinutes ?? 0), 0) / mttdRows.length : null
    const avgMttr = mttrRows.length > 0 ? mttrRows.reduce((s, r) => s + (r.mttrMinutes ?? 0), 0) / mttrRows.length : null
    return { avgMttd, avgMttr, mttdCount: mttdRows.length, mttrCount: mttrRows.length }
  }, [filteredRows])

  const prevMttdMttr = useMemo(() => {
    const mttdRows = rowsPreviousPeriod.filter((r) => r.mttdMinutes != null && r.mttdMinutes >= 0 && r.status !== 'cancelada')
    const mttrRows = rowsPreviousPeriod.filter((r) => r.mttrMinutes != null && r.mttrMinutes >= 0 && r.status === 'encerrada')
    const avgMttd = mttdRows.length > 0 ? mttdRows.reduce((s, r) => s + (r.mttdMinutes ?? 0), 0) / mttdRows.length : null
    const avgMttr = mttrRows.length > 0 ? mttrRows.reduce((s, r) => s + (r.mttrMinutes ?? 0), 0) / mttrRows.length : null
    return { avgMttd, avgMttr }
  }, [rowsPreviousPeriod])

  // ── Série temporal ─────────────────────────────────────────────────────
  const chartSeries = useMemo(() => {
    const byBucket = new Map<string, { at: Date; label: string; afetados: number; protocolos: number }>()
    for (const row of filteredRows) {
      if (!row.openedAt) continue
      const at = bucketStart(row.openedAt, range.bucket)
      const key = at.toISOString()
      const cur = byBucket.get(key) ?? { at, label: bucketLabel(at, range.bucket), afetados: 0, protocolos: 0 }
      cur.afetados += Math.max(0, row.affectedClients)
      cur.protocolos += 1
      byBucket.set(key, cur)
    }
    return [...byBucket.values()].sort((a, b) => a.at.getTime() - b.at.getTime())
  }, [filteredRows, range.bucket])

  const chartBucketLabel = range.bucket === 'month' ? 'mês' : range.bucket === 'week' ? 'semana' : 'dia'

  // ── Ranking OLTs ────────────────────────────────────────────────────────
  const apRanking = useMemo(
    () =>
      rankMassivaAccessPoints(
        filteredRows.map((r) => ({
          protocol: r.protocol ?? 0, assignmentId: null, apCode: r.accessPointCode, splitterCode: '',
          affectedClients: r.affectedClients, openedAt: r.openedAt, status: r.status,
          closedAt: r.closedAt, expectedCloseAt: r.expectedCloseAt, title: r.title, description: '',
          createdBy: r.operatorEmail, responsible: '', mttdMinutes: r.mttdMinutes, mttrMinutes: r.mttrMinutes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any,
        8,
      ),
    [filteredRows],
  )

  // ── Heatmap dia × hora ─────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    // grid[day][hour] = count; day: 0=Dom…6=Sáb
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const row of filteredRows) {
      if (!row.openedAt) continue
      const day = row.openedAt.getDay()
      const hour = row.openedAt.getHours()
      grid[day]![hour]!++
    }
    const max = Math.max(1, ...grid.flat())
    return { grid, max }
  }, [filteredRows])

  // ── Ranking de operadores (agora com MTTD) ──────────────────────────────
  const operadorRanking = useMemo(() => {
    const byOp = new Map<
      string,
      { email: string; count: number; mttrSum: number; mttrCount: number; mttdSum: number; mttdCount: number; slaWithin: number; slaEvaluated: number }
    >()
    for (const r of filteredRows) {
      if (!r.operatorEmail) continue
      const cur = byOp.get(r.operatorEmail) ?? {
        email: r.operatorEmail, count: 0, mttrSum: 0, mttrCount: 0, mttdSum: 0, mttdCount: 0, slaWithin: 0, slaEvaluated: 0,
      }
      cur.count++
      if (r.mttdMinutes != null && r.mttdMinutes >= 0 && r.status !== 'cancelada') {
        cur.mttdSum += r.mttdMinutes
        cur.mttdCount++
      }
      if (r.mttrMinutes != null && r.mttrMinutes >= 0 && r.status === 'encerrada') {
        cur.mttrSum += r.mttrMinutes
        cur.mttrCount++
      }
      if (r.status === 'encerrada' && r.closedAt && r.expectedCloseAt) {
        cur.slaEvaluated++
        if (r.closedAt.getTime() <= r.expectedCloseAt.getTime()) cur.slaWithin++
      }
      byOp.set(r.operatorEmail, cur)
    }
    return [...byOp.values()]
      .map((op) => ({
        ...op,
        avgMttd: op.mttdCount > 0 ? op.mttdSum / op.mttdCount : null,
        avgMttr: op.mttrCount > 0 ? op.mttrSum / op.mttrCount : null,
        slaPct: op.slaEvaluated > 0 ? Math.round((op.slaWithin / op.slaEvaluated) * 100) : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [filteredRows])

  // ── Distribuição de classificação (tipo + impacto + área + tecnologia) ──
  const classifDistribution = useMemo(() => {
    if (filteredRows.length === 0) return null
    const byTipo = new Map<string, number>()
    const byImpacto = new Map<string, number>()
    const byArea = new Map<string, number>()
    const byTecnologia = new Map<string, number>()
    let filledTipo = 0, filledImpacto = 0, filledArea = 0, filledTecnologia = 0
    for (const r of filteredRows) {
      if (r.tipoIncidente) { byTipo.set(r.tipoIncidente, (byTipo.get(r.tipoIncidente) ?? 0) + 1); filledTipo++ }
      if (r.impacto) { byImpacto.set(r.impacto, (byImpacto.get(r.impacto) ?? 0) + 1); filledImpacto++ }
      if (r.area) { byArea.set(r.area, (byArea.get(r.area) ?? 0) + 1); filledArea++ }
      if (r.tecnologia) { byTecnologia.set(r.tecnologia, (byTecnologia.get(r.tecnologia) ?? 0) + 1); filledTecnologia++ }
    }
    if (filledTipo === 0 && filledImpacto === 0 && filledArea === 0 && filledTecnologia === 0) return null
    const sortDesc = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    return {
      total: filteredRows.length,
      tipo: sortDesc(byTipo), impacto: sortDesc(byImpacto),
      area: sortDesc(byArea), tecnologia: sortDesc(byTecnologia),
      filledTipo, filledImpacto, filledArea, filledTecnologia,
    }
  }, [filteredRows])

  // ── Verificação pós-encerramento ───────────────────────────────────────
  const affectedVerif = useMemo(() => {
    const verified = filteredRows.filter(
      (r) => r.affectedVerificationCheckedAt != null && r.status === 'encerrada',
    )
    if (verified.length === 0) return null
    const totalChecked = verified.reduce((s, r) => s + (r.affectedVerificationTotal ?? 0), 0)
    const stillOffline = verified.reduce((s, r) => s + (r.affectedVerificationStillOffline ?? 0), 0)
    const stillDegraded = verified.reduce((s, r) => s + (r.affectedVerificationStillDegraded ?? 0), 0)
    const recovered = totalChecked - stillOffline - stillDegraded
    return { count: verified.length, totalChecked, stillOffline, stillDegraded, recovered }
  }, [filteredRows])

  // ── Alerta de MTTR crescente ───────────────────────────────────────────
  const mttrTrendAlert = useMemo(() => {
    const data = (mttdMttrKpisQuery.data ?? []).filter((m) => m.avgMttrMinutes != null && m.mttrCount >= 3)
    if (data.length < 3) return null
    const last3 = data.slice(-3)
    const [a, b, c] = last3
    if ((a?.avgMttrMinutes ?? 0) >= (b?.avgMttrMinutes ?? 0)) return null
    if ((b?.avgMttrMinutes ?? 0) >= (c?.avgMttrMinutes ?? 0)) return null
    return { months: last3.map((m) => ({ month: m.month, mttrMinutes: m.avgMttrMinutes! })) }
  }, [mttdMttrKpisQuery.data])

  // ── Série de tendência mensal ──────────────────────────────────────────
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
  const hasPrevData = rowsPreviousPeriod.length > 0

  // ── Distribuição de origem do evento (identified_by) ────────────────────
  const identifiedByDistribution = useMemo(() => {
    const counts: Record<string, number> = { tecnico: 0, zabbix: 0, int6: 0 }
    let filled = 0
    for (const r of filteredRows) {
      if (r.identifiedBy && counts[r.identifiedBy] != null) {
        counts[r.identifiedBy]!++
        filled++
      }
    }
    if (filled === 0) return null
    const total = filled
    const entries = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
    return { entries, total, filled }
  }, [filteredRows])

  // ── Estatísticas de protocolo de infraestrutura ────────────────────────
  const infraProtocolStats = useMemo(() => {
    let withInfra = 0
    let withoutInfra = 0
    for (const r of filteredRows) {
      if (r.infraProtocol != null && r.infraProtocol > 0) withInfra++
      else withoutInfra++
    }
    if (filteredRows.length === 0) return null
    const pct = Math.round((withInfra / filteredRows.length) * 100)
    return { withInfra, withoutInfra, total: filteredRows.length, pct }
  }, [filteredRows])

  // ── Média de afetados por massiva ──────────────────────────────────────
  const avgAffected = useMemo(() => {
    const nonCancelled = filteredRows.filter((r) => r.status !== 'cancelada' && r.affectedClients > 0)
    if (nonCancelled.length === 0) return null
    const avg = nonCancelled.reduce((s, r) => s + r.affectedClients, 0) / nonCancelled.length
    return { avg: Math.round(avg), count: nonCancelled.length }
  }, [filteredRows])

  const prevAvgAffected = useMemo(() => {
    const nonCancelled = rowsPreviousPeriod.filter((r) => r.status !== 'cancelada' && r.affectedClients > 0)
    if (nonCancelled.length === 0) return null
    return Math.round(nonCancelled.reduce((s, r) => s + r.affectedClients, 0) / nonCancelled.length)
  }, [rowsPreviousPeriod])

  // ── Destaque de pico do heatmap ────────────────────────────────────────
  const heatmapPeak = useMemo(() => {
    let maxCount = 0
    let peakDay = 0
    let peakHour = 0
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const c = heatmapData.grid[d]?.[h] ?? 0
        if (c > maxCount) { maxCount = c; peakDay = d; peakHour = h }
      }
    }
    if (maxCount === 0) return null
    return { day: DAYS_SHORT[peakDay]!, hour: peakHour, count: maxCount }
  }, [heatmapData])

  // ── Resumo textual automático ──────────────────────────────────────────
  const autoSummary = useMemo(() => {
    if (isLoading || filteredRows.length === 0) return null
    const parts: string[] = []
    parts.push(`${kpis.total} massiva${kpis.total !== 1 ? 's' : ''} no período`)
    const totalDelta = hasPrevData ? calcDelta(kpis.total, prevKpis.total) : null
    if (totalDelta && totalDelta.dir !== 'same') {
      parts.push(`${totalDelta.pct}% ${totalDelta.dir === 'up' ? 'a mais' : 'a menos'} que o período anterior`)
    }
    if (periodMttdMttr.avgMttr != null) {
      parts.push(`MTTR médio de ${formatMinutes(periodMttdMttr.avgMttr)}`)
    }
    if (apRanking.length > 0 && apRanking[0]) {
      const topAp = apCodeToTitle.get(apRanking[0].apCode) ?? apRanking[0].apCode
      parts.push(`${topAp} lidera com ${apRanking[0].protocols} ocorrência${apRanking[0].protocols !== 1 ? 's' : ''}`)
    }
    if (identifiedByDistribution) {
      const top = identifiedByDistribution.entries[0]
      if (top) {
        const topPct = Math.round((top[1] / identifiedByDistribution.total) * 100)
        parts.push(`${topPct}% identificadas por ${IDENTIFIED_BY_LABEL[top[0]] ?? top[0]}`)
      }
    }
    return parts.join('. ') + '.'
  }, [isLoading, filteredRows, kpis, prevKpis, hasPrevData, periodMttdMttr, apRanking, apCodeToTitle, identifiedByDistribution])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-sm sm:p-4">
        {/* Linha 1: período + meta */}
        <div className="flex flex-wrap items-center gap-2">
          {periodPreset === 'month' ? (
            <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5">
              <button
                type="button"
                onClick={() => setPeriodPreset('30d')}
                className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-neutral-500 transition hover:bg-white hover:text-neutral-800"
                aria-label="Voltar aos períodos rápidos"
                title="Voltar aos períodos"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="min-w-0 flex-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-neutral-800 shadow-sm ring-1 ring-neutral-200 focus:ring-amber-400 focus:outline-none"
                aria-label="Selecionar mês"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex gap-0.5 rounded-lg bg-neutral-100 p-0.5">
              {PERIOD_PRESETS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriodPreset(value)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    periodPreset === value
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] text-neutral-400 sm:inline">{range.label}</span>
            {!isLoading && (
              <span className="text-[11px] tabular-nums text-neutral-400">
                {filteredRows.length !== rowsInPeriod.length
                  ? `${filteredRows.length.toLocaleString('pt-BR')}/${rowsInPeriod.length.toLocaleString('pt-BR')}`
                  : `${rowsInPeriod.length.toLocaleString('pt-BR')} registros`}
              </span>
            )}
            <button
              type="button"
              onClick={refreshDashboard}
              disabled={historyQuery.isFetching || mttdMttrKpisQuery.isFetching}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', (historyQuery.isFetching || mttdMttrKpisQuery.isFetching) && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Divisor + Filtros */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-2.5">
          <div className="flex gap-0.5 rounded-lg bg-neutral-100 p-0.5">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  statusFilter === value
                    ? value === 'aberta'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : value === 'encerrada'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : value === 'cancelada'
                          ? 'bg-neutral-500 text-white shadow-sm'
                          : 'bg-white text-neutral-800 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {operadorOptions.length > 0 && (
            <select
              value={operadorFilter}
              onChange={(e) => setOperadorFilter(e.target.value)}
              className={cn(
                'h-7 rounded-lg border px-2 py-0 text-[11px] font-medium outline-none transition-colors',
                operadorFilter !== ''
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300',
              )}
            >
              <option value="">Operador: todos</option>
              {operadorOptions.map((email) => (
                <option key={email} value={email}>{displayOperador(email)}</option>
              ))}
            </select>
          )}
          {apOptions.length > 0 && (
            <select
              value={apFilter}
              onChange={(e) => setApFilter(e.target.value)}
              className={cn(
                'h-7 max-w-[200px] rounded-lg border px-2 py-0 text-[11px] font-medium outline-none transition-colors',
                apFilter !== ''
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300',
              )}
            >
              <option value="">OLT / AP: todos</option>
              {apOptions.map((code) => (
                <option key={code} value={code}>{apCodeToTitle.get(code) ?? code}</option>
              ))}
            </select>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-100"
            >
              <X className="h-3 w-3" />
              Limpar ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Massivas abertas agora ──────────────────────────────────────── */}
      {!isLoading && (openMassivas.length > 0 || slaRisk.overdue.length > 0) && (
        <div className={CARD_SECTION_CLS}>
          <div className={cn(SECTION_HEADER_CLS, 'flex flex-wrap items-center justify-between gap-2')}>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Em aberto agora</p>
                <h2 className="mt-0.5 text-sm font-semibold text-neutral-900">
                  {openMassivas.length} massiva{openMassivas.length !== 1 ? 's' : ''} ativa{openMassivas.length !== 1 ? 's' : ''}
                </h2>
              </div>
              {slaRisk.overdue.length > 0 && (
                <span className="ml-2 flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                  <ShieldAlert className="h-3 w-3" />
                  {slaRisk.overdue.length} vencida{slaRisk.overdue.length !== 1 ? 's' : ''}
                </span>
              )}
              {slaRisk.atRisk.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                  <Clock className="h-3 w-3" />
                  {slaRisk.atRisk.length} em risco
                </span>
              )}
            </div>
            {openMassivas.length > 5 && (
              <button
                type="button"
                onClick={() => setOpenListExpanded((v) => !v)}
                className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
              >
                {openListExpanded ? 'Ver menos' : `Ver todas (${openMassivas.length})`}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-left">
                  <th className="px-4 py-2 font-semibold text-neutral-500 sm:px-5">Protocolo</th>
                  <th className="px-2 py-2 font-semibold text-neutral-500">OLT / AP</th>
                  <th className="px-2 py-2 font-semibold text-neutral-500">Operador</th>
                  <th className="px-2 py-2 font-semibold text-neutral-500">Aberta há</th>
                  <th className="px-2 py-2 text-right font-semibold text-neutral-500">Afetados</th>
                  <th className="px-4 py-2 text-right font-semibold text-neutral-500 sm:px-5">SLA</th>
                </tr>
              </thead>
              <tbody>
                {(openListExpanded ? openMassivas : openMassivas.slice(0, 5)).map((row) => {
                  const now = Date.now()
                  const isOverdue = row.expectedCloseAt && row.expectedCloseAt.getTime() < now
                  const isAtRisk =
                    !isOverdue &&
                    row.expectedCloseAt &&
                    row.expectedCloseAt.getTime() < now + 2 * 60 * 60 * 1000
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-neutral-50 transition-colors hover:bg-neutral-50/60',
                        isOverdue && 'bg-rose-50/40',
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono font-semibold text-neutral-800 sm:px-5">
                        {row.protocol ?? '—'}
                      </td>
                      <td className="max-w-[160px] truncate px-2 py-2.5 text-neutral-700">
                        {apCodeToTitle.get(row.accessPointCode) ?? row.accessPointCode}
                      </td>
                      <td className="px-2 py-2.5 text-neutral-600">
                        {displayOperador(row.operatorEmail)}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-neutral-600">
                        {row.openedAt ? formatTimeAgo(row.openedAt) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-neutral-800">
                        {row.affectedClients.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2.5 text-right sm:px-5">
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            <ShieldAlert className="h-2.5 w-2.5" /> Vencida
                          </span>
                        ) : isAtRisk ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Clock className="h-2.5 w-2.5" /> Em risco
                          </span>
                        ) : row.expectedCloseAt ? (
                          <span className="text-[11px] text-neutral-400">
                            até {row.expectedCloseAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Alertas ─────────────────────────────────────────────────────── */}
      {mttrTrendAlert != null && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-800">MTTR crescente nos últimos 3 meses</p>
            <p className="mt-0.5 text-xs text-amber-700">
              {mttrTrendAlert.months.map((m) => `${formatMonthShort(m.month)}: ${formatMinutes(m.mttrMinutes)}`).join(' → ')}
              {' '}— considere investigar as causas raiz.
            </p>
          </div>
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao carregar histórico de massivas. Tente atualizar.
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          color="neutral"
          label="Total de protocolos"
          value={isLoading ? '…' : kpis.total.toLocaleString('pt-BR')}
          sub={activeFilterCount > 0 ? 'filtrado' : 'no período'}
          delta={hasPrevData ? calcDelta(kpis.total, prevKpis.total) : null}
          deltaPositiveGood={false}
        />
        <KpiCard
          color="amber"
          label="Abertas"
          value={isLoading ? '…' : kpis.abertas.toLocaleString('pt-BR')}
          sub="em aberto"
          delta={hasPrevData ? calcDelta(kpis.abertas, prevKpis.abertas) : null}
          deltaPositiveGood={false}
        />
        <KpiCard
          color="emerald"
          label="Encerradas"
          value={isLoading ? '…' : kpis.encerradas.toLocaleString('pt-BR')}
          sub="no período"
          delta={hasPrevData ? calcDelta(kpis.encerradas, prevKpis.encerradas) : null}
          deltaPositiveGood={true}
        />
        <KpiCard
          color="rose"
          label="Afetados totais"
          value={isLoading ? '…' : kpis.totalAfetados.toLocaleString('pt-BR')}
          sub="clientes no período"
          delta={hasPrevData ? calcDelta(kpis.totalAfetados, prevKpis.totalAfetados) : null}
          deltaPositiveGood={false}
        />
        <KpiCard
          color="sky"
          label="SLA"
          value={isLoading ? '…' : kpis.sla.pct === null ? '—' : `${Math.round(kpis.sla.pct)}%`}
          sub={kpis.sla.evaluated > 0 ? `${kpis.sla.within}/${kpis.sla.evaluated} dentro` : 'sem base avaliável'}
        />
        <KpiCard
          color="violet"
          label="MTTD médio"
          value={isLoading ? '…' : formatMinutes(periodMttdMttr.avgMttd)}
          sub={periodMttdMttr.mttdCount > 0 ? `${periodMttdMttr.mttdCount} registros` : 'sem dados'}
          delta={
            hasPrevData && periodMttdMttr.avgMttd != null && prevMttdMttr.avgMttd != null
              ? calcDelta(periodMttdMttr.avgMttd, prevMttdMttr.avgMttd)
              : null
          }
          deltaPositiveGood={false}
        />
        <KpiCard
          color="rose"
          label="MTTR médio"
          value={isLoading ? '…' : formatMinutes(periodMttdMttr.avgMttr)}
          sub={periodMttdMttr.mttrCount > 0 ? `${periodMttdMttr.mttrCount} encerradas` : 'sem dados'}
          delta={
            hasPrevData && periodMttdMttr.avgMttr != null && prevMttdMttr.avgMttr != null
              ? calcDelta(periodMttdMttr.avgMttr, prevMttdMttr.avgMttr)
              : null
          }
          deltaPositiveGood={false}
        />
      </div>

      {/* ── Seletor de abas ───────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        {DASHBOARD_TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setDashboardTab(value)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
              dashboardTab === value
                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200'
                : 'text-neutral-500 hover:text-neutral-800',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── ABA: VISÃO GERAL ────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {dashboardTab === 'visao_geral' && (
        <>
          {/* Resumo textual */}
          {autoSummary != null && (
            <div className={cn(CARD_SECTION_CLS, 'px-4 py-3 sm:px-5')}>
              <p className="text-sm leading-relaxed text-neutral-700">{autoSummary}</p>
            </div>
          )}

          {/* Gráfico de série temporal */}
          <div className={CARD_SECTION_CLS}>
            <div className={cn(SECTION_HEADER_CLS, 'flex flex-wrap items-center justify-between gap-2')}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Série temporal</p>
                <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                  Total por {chartBucketLabel} — {range.label}
                  {activeFilterCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(filtrado)</span>}
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
                      chartMetric === metric ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100',
                    )}
                  >
                    {metric}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Carregando…</div>
              ) : chartSeries.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Sem dados no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [
                        (value as number).toLocaleString('pt-BR'),
                        name === 'afetados' ? 'Afetados' : 'Protocolos',
                      ]}
                      labelStyle={{ fontSize: 12, fontWeight: 600 }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey={chartMetric} name={chartMetric} fill={chartMetric === 'afetados' ? '#fb7185' : '#6366f1'} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tendência mensal + Ranking de OLTs */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
            <div className={CARD_SECTION_CLS}>
              <div className={SECTION_HEADER_CLS}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Tendência mensal</p>
                <h2 className="mt-1 text-sm font-semibold text-neutral-900">MTTD e MTTR — últimos {MTTD_MTTR_MONTHS} meses</h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">MTTD: início do evento → identificação · MTTR: identificação → encerramento</p>
              </div>
              <div className="px-4 py-4 sm:px-5">
                {mttdMttrKpisQuery.isPending ? (
                  <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Carregando…</div>
                ) : trendChartData.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Sem dados disponíveis.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendChartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => formatMinutes(v)}
                        width={56}
                      />
                      <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, name: any) => [
                          formatMinutes(value as number),
                          name === 'mttd' ? 'MTTD médio' : 'MTTR médio',
                        ]}
                        labelStyle={{ fontSize: 12, fontWeight: 600 }}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Legend formatter={(value) => (value === 'mttd' ? 'MTTD' : 'MTTR')} wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="mttd" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="mttr" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={CARD_SECTION_CLS}>
              <div className={SECTION_HEADER_CLS}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Top OLTs / APs</p>
                <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                  Maior recorrência
                  {activeFilterCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(filtrado)</span>}
                </h2>
              </div>
              <div className="space-y-3 px-4 py-4 sm:px-5">
                {isLoading ? (
                  <p className="text-sm text-neutral-400">Carregando…</p>
                ) : apRanking.length === 0 ? (
                  <p className="text-sm text-neutral-400">Sem dados no período.</p>
                ) : (
                  apRanking.map((ap) => (
                    <HBar key={ap.apCode} label={apCodeToTitle.get(ap.apCode) ?? ap.apCode} count={ap.protocols} max={apRanking[0]?.protocols ?? 1} total={kpis.total} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* KPI extra: Média de afetados por massiva */}
          {avgAffected != null && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <KpiCard
                color="rose"
                label="Média de afetados"
                value={avgAffected.avg.toLocaleString('pt-BR')}
                sub={`por massiva (${avgAffected.count} com afetados)`}
                delta={prevAvgAffected != null ? calcDelta(avgAffected.avg, prevAvgAffected) : null}
                deltaPositiveGood={false}
              />
              {kpis.total > 0 && (
                <KpiCard
                  color="emerald"
                  label="Tx. resolução"
                  value={`${Math.round((kpis.encerradas / kpis.total) * 100)}%`}
                  sub={`${kpis.encerradas} encerradas de ${kpis.total}`}
                />
              )}
              {infraProtocolStats != null && (
                <KpiCard
                  color="sky"
                  label="Com infra vinculado"
                  value={`${infraProtocolStats.pct}%`}
                  sub={`${infraProtocolStats.withInfra} de ${infraProtocolStats.total}`}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── ABA: ANÁLISE ────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {dashboardTab === 'analise' && (
        <>
          {/* Heatmap dia × hora */}
          {!isLoading && filteredRows.length > 0 && (
            <div className={CARD_SECTION_CLS}>
              <div className={SECTION_HEADER_CLS}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Padrão de ocorrências</p>
                <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                  Concentração por dia da semana e hora
                  {activeFilterCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(filtrado)</span>}
                </h2>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  Cor mais escura = mais ocorrências abertas naquele horário
                  {heatmapPeak != null && (
                    <span className="ml-2 font-semibold text-amber-700">
                      · Pico: {heatmapPeak.day} {String(heatmapPeak.hour).padStart(2, '0')}h ({heatmapPeak.count} abertura{heatmapPeak.count !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </div>
              <div className="overflow-x-auto px-4 py-4 sm:px-5">
                <div className="min-w-[560px]">
                  {/* Cabeçalho horas */}
                  <div className="mb-1 flex">
                    <div className="w-10 shrink-0" />
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="flex-1 text-center text-[9px] text-neutral-400">
                        {h % 3 === 0 ? `${String(h).padStart(2, '0')}h` : ''}
                      </div>
                    ))}
                  </div>
                  {/* Linhas por dia */}
                  {DAYS_SHORT.map((day, dayIdx) => (
                    <div key={day} className="mb-0.5 flex items-center">
                      <div className="w-10 shrink-0 text-[10px] font-medium text-neutral-500">{day}</div>
                      {Array.from({ length: 24 }, (_, h) => {
                        const count = heatmapData.grid[dayIdx]?.[h] ?? 0
                        const ratio = count / heatmapData.max
                        const opacity = ratio === 0 ? 0 : Math.max(0.08, ratio)
                        return (
                          <div
                            key={h}
                            className="relative flex-1 cursor-default"
                            title={count > 0 ? `${day} ${String(h).padStart(2, '0')}h: ${count} abertura${count !== 1 ? 's' : ''}` : undefined}
                          >
                            <div
                              className="mx-px h-5 rounded-sm"
                              style={{ backgroundColor: `rgba(245, 158, 11, ${opacity})` }}
                            />
                            {count > 0 && ratio > 0.5 && (
                              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-amber-900">
                                {count}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  {/* Legenda */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] text-neutral-400">Menos</span>
                    {[0.08, 0.25, 0.45, 0.65, 0.85].map((op) => (
                      <div key={op} className="h-3 w-5 rounded-sm" style={{ backgroundColor: `rgba(245,158,11,${op})` }} />
                    ))}
                    <span className="text-[10px] text-neutral-400">Mais</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ranking de operadores (com MTTD) */}
          {!isLoading && operadorRanking.length > 0 && (
            <div className={CARD_SECTION_CLS}>
              <div className={SECTION_HEADER_CLS}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Desempenho por operador</p>
                <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                  Volume e tempo de resolução
                  {activeFilterCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(filtrado)</span>}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100 text-left">
                      <th className="px-4 py-2 font-semibold text-neutral-500 sm:px-5">Operador</th>
                      <th className="px-2 py-2 text-right font-semibold text-neutral-500">Protocolos</th>
                      <th className="px-2 py-2 text-right font-semibold text-neutral-500">MTTD médio</th>
                      <th className="px-2 py-2 text-right font-semibold text-neutral-500">MTTR médio</th>
                      <th className="px-4 py-2 text-right font-semibold text-neutral-500 sm:px-5">SLA %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operadorRanking.map((op, idx) => {
                      const maxCount = operadorRanking[0]?.count ?? 1
                      const barPct = Math.round((op.count / maxCount) * 100)
                      return (
                        <tr key={op.email} className="border-b border-neutral-50 hover:bg-neutral-50/60">
                          <td className="px-4 py-2.5 sm:px-5">
                            <div className="flex items-center gap-2">
                              <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-neutral-400">{idx + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-neutral-800">{displayOperador(op.email)}</p>
                                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                                  <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${barPct}%` }} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-neutral-800">
                            {op.count}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-violet-600">
                            {formatMinutes(op.avgMttd)}
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-neutral-600">
                            {formatMinutes(op.avgMttr)}
                          </td>
                          <td className="px-4 py-2.5 text-right sm:px-5">
                            {op.slaPct === null ? (
                              <span className="text-neutral-300">—</span>
                            ) : (
                              <span className={cn('font-semibold tabular-nums', op.slaPct >= 80 ? 'text-emerald-600' : op.slaPct >= 60 ? 'text-amber-600' : 'text-rose-600')}>
                                {op.slaPct}%
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Distribuição de classificação */}
          {(classifDistribution != null || isLoading) && (
            <div className={CARD_SECTION_CLS}>
              <div className={SECTION_HEADER_CLS}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Classificação</p>
                <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                  Distribuição por tipo, impacto, área e tecnologia
                  {activeFilterCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(filtrado)</span>}
                </h2>
              </div>
              {isLoading ? (
                <div className="px-4 py-4 text-sm text-neutral-400">Carregando…</div>
              ) : classifDistribution == null ? (
                <div className="px-4 py-4 text-sm text-neutral-400">Nenhum dado de classificação preenchido no período.</div>
              ) : (
                <div className="grid gap-6 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  {classifDistribution.filledTipo > 0 && (
                    <div>
                      <p className="mb-3 text-xs font-semibold text-neutral-600">
                        Tipo de incidente
                        <span className="ml-1.5 font-normal text-neutral-400">({classifDistribution.filledTipo}/{classifDistribution.total})</span>
                      </p>
                      <div className="space-y-2.5">
                        {classifDistribution.tipo.map(([name, count]) => (
                          <HBar key={name} label={name} count={count} max={classifDistribution.tipo[0]?.[1] ?? 1} total={classifDistribution.filledTipo} />
                        ))}
                      </div>
                    </div>
                  )}
                  {classifDistribution.filledImpacto > 0 && (
                    <div>
                      <p className="mb-3 text-xs font-semibold text-neutral-600">
                        Impacto
                        <span className="ml-1.5 font-normal text-neutral-400">({classifDistribution.filledImpacto}/{classifDistribution.total})</span>
                      </p>
                      <div className="space-y-2.5">
                        {classifDistribution.impacto.map(([name, count]) => (
                          <HBar key={name} label={name} count={count} max={classifDistribution.impacto[0]?.[1] ?? 1} total={classifDistribution.filledImpacto} color="#60a5fa" />
                        ))}
                      </div>
                    </div>
                  )}
                  {classifDistribution.filledArea > 0 && (
                    <div>
                      <p className="mb-3 text-xs font-semibold text-neutral-600">
                        Área
                        <span className="ml-1.5 font-normal text-neutral-400">({classifDistribution.filledArea}/{classifDistribution.total})</span>
                      </p>
                      <div className="space-y-2.5">
                        {classifDistribution.area.map(([name, count]) => (
                          <HBar key={name} label={name} count={count} max={classifDistribution.area[0]?.[1] ?? 1} total={classifDistribution.filledArea} color="#34d399" />
                        ))}
                      </div>
                    </div>
                  )}
                  {classifDistribution.filledTecnologia > 0 && (
                    <div>
                      <p className="mb-3 text-xs font-semibold text-neutral-600">
                        Tecnologia
                        <span className="ml-1.5 font-normal text-neutral-400">({classifDistribution.filledTecnologia}/{classifDistribution.total})</span>
                      </p>
                      <div className="space-y-2.5">
                        {classifDistribution.tecnologia.map(([name, count]) => (
                          <HBar key={name} label={name} count={count} max={classifDistribution.tecnologia[0]?.[1] ?? 1} total={classifDistribution.filledTecnologia} color="#a78bfa" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* ── ABA: QUALIDADE ──────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {dashboardTab === 'qualidade' && (
        <>
          {/* Origem do evento (identified_by) */}
          <div className={CARD_SECTION_CLS}>
            <div className={SECTION_HEADER_CLS}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Origem da identificação</p>
              <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                Quem identificou o evento
                {activeFilterCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(filtrado)</span>}
              </h2>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Proporção de detecção automática (Zabbix/INT6) vs manual (Técnico)
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center text-sm text-neutral-400">Carregando…</div>
              ) : identifiedByDistribution == null ? (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-3 text-sm text-neutral-500">
                  <Radio className="h-4 w-4 shrink-0 text-neutral-400" />
                  Nenhuma massiva com origem registrada no período. O campo "Quem identificou" é preenchido na abertura.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Barra empilhada */}
                  <div className="flex h-6 w-full overflow-hidden rounded-full">
                    {identifiedByDistribution.entries.map(([key, count]) => {
                      const pct = (count / identifiedByDistribution.total) * 100
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-center text-[9px] font-bold text-white transition-all"
                          style={{ width: `${pct}%`, backgroundColor: IDENTIFIED_BY_COLOR[key] ?? '#94a3b8' }}
                          title={`${IDENTIFIED_BY_LABEL[key] ?? key}: ${count} (${Math.round(pct)}%)`}
                        >
                          {pct > 12 ? `${Math.round(pct)}%` : ''}
                        </div>
                      )
                    })}
                  </div>
                  {/* Legenda + contagens */}
                  <div className="flex flex-wrap gap-4">
                    {identifiedByDistribution.entries.map(([key, count]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: IDENTIFIED_BY_COLOR[key] ?? '#94a3b8' }} />
                        <span className="text-xs font-semibold text-neutral-800">{IDENTIFIED_BY_LABEL[key] ?? key}</span>
                        <span className="text-xs tabular-nums text-neutral-500">
                          {count} ({Math.round((count / identifiedByDistribution.total) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    {identifiedByDistribution.filled} de {filteredRows.length} massivas com origem registrada
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Protocolo de infraestrutura */}
          <div className={CARD_SECTION_CLS}>
            <div className={SECTION_HEADER_CLS}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Protocolo de infraestrutura</p>
              <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                Vinculação de protocolo de infra à massiva
                {activeFilterCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(filtrado)</span>}
              </h2>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center text-sm text-neutral-400">Carregando…</div>
              ) : infraProtocolStats == null ? (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-3 text-sm text-neutral-500">
                  <Wrench className="h-4 w-4 shrink-0 text-neutral-400" />
                  Sem dados no período.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Barra dupla */}
                  <div className="flex h-6 w-full overflow-hidden rounded-full">
                    <div
                      className="flex items-center justify-center bg-sky-400 text-[9px] font-bold text-white transition-all"
                      style={{ width: `${infraProtocolStats.pct}%` }}
                      title={`Com infra: ${infraProtocolStats.withInfra}`}
                    >
                      {infraProtocolStats.pct > 10 ? `${infraProtocolStats.pct}%` : ''}
                    </div>
                    <div
                      className="flex items-center justify-center bg-neutral-200 text-[9px] font-bold text-neutral-600 transition-all"
                      style={{ width: `${100 - infraProtocolStats.pct}%` }}
                      title={`Sem infra: ${infraProtocolStats.withoutInfra}`}
                    >
                      {100 - infraProtocolStats.pct > 10 ? `${100 - infraProtocolStats.pct}%` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm bg-sky-400" />
                      <span className="text-xs font-semibold text-neutral-800">Com infra vinculado</span>
                      <span className="text-xs tabular-nums text-neutral-500">{infraProtocolStats.withInfra}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm bg-neutral-200" />
                      <span className="text-xs font-semibold text-neutral-800">Sem infra</span>
                      <span className="text-xs tabular-nums text-neutral-500">{infraProtocolStats.withoutInfra}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Verificação pós-encerramento */}
          <div className={CARD_SECTION_CLS}>
            <div className={SECTION_HEADER_CLS}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Verificação pós-encerramento</p>
              <h2 className="mt-1 text-sm font-semibold text-neutral-900">
                {affectedVerif != null
                  ? `Qualidade de restauração — ${affectedVerif.count} encerramento${affectedVerif.count !== 1 ? 's' : ''} verificado${affectedVerif.count !== 1 ? 's' : ''}`
                  : 'Qualidade de restauração'}
              </h2>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Clientes verificados após encerramento da massiva
              </p>
            </div>
            <div className="px-4 py-4 sm:px-5">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center text-sm text-neutral-400">Carregando…</div>
              ) : affectedVerif == null ? (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-3 text-sm text-neutral-500">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-neutral-400" />
                  Nenhuma verificação pós-encerramento realizada no período.
                </div>
              ) : (
                <>
                  {/* Barra de distribuição */}
                  <div className="mb-4">
                    {affectedVerif.totalChecked > 0 ? (
                      <>
                        <div className="flex h-5 w-full overflow-hidden rounded-full">
                          <div
                            className="flex items-center justify-center bg-emerald-400 text-[9px] font-bold text-white transition-all"
                            style={{ width: `${(affectedVerif.recovered / affectedVerif.totalChecked) * 100}%` }}
                            title={`Recuperados: ${affectedVerif.recovered}`}
                          >
                            {affectedVerif.recovered > 0 && affectedVerif.recovered / affectedVerif.totalChecked > 0.1
                              ? affectedVerif.recovered.toLocaleString('pt-BR')
                              : ''}
                          </div>
                          <div
                            className="flex items-center justify-center bg-amber-400 text-[9px] font-bold text-white transition-all"
                            style={{ width: `${(affectedVerif.stillDegraded / affectedVerif.totalChecked) * 100}%` }}
                            title={`Degradados: ${affectedVerif.stillDegraded}`}
                          >
                            {affectedVerif.stillDegraded > 0 && affectedVerif.stillDegraded / affectedVerif.totalChecked > 0.08
                              ? affectedVerif.stillDegraded.toLocaleString('pt-BR')
                              : ''}
                          </div>
                          <div
                            className="flex items-center justify-center bg-rose-400 text-[9px] font-bold text-white transition-all"
                            style={{ width: `${(affectedVerif.stillOffline / affectedVerif.totalChecked) * 100}%` }}
                            title={`Sem sinal: ${affectedVerif.stillOffline}`}
                          >
                            {affectedVerif.stillOffline > 0 && affectedVerif.stillOffline / affectedVerif.totalChecked > 0.08
                              ? affectedVerif.stillOffline.toLocaleString('pt-BR')
                              : ''}
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-neutral-400 text-right">
                          {affectedVerif.totalChecked.toLocaleString('pt-BR')} clientes verificados
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-neutral-400">Sem clientes verificados no período.</p>
                    )}
                  </div>

                  {/* Cards de resultado */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide">Recuperados</span>
                      </div>
                      <p className="mt-1 text-xl font-bold tabular-nums text-emerald-800">
                        {affectedVerif.recovered.toLocaleString('pt-BR')}
                      </p>
                      {affectedVerif.totalChecked > 0 && (
                        <p className="mt-0.5 text-[10px] text-emerald-600/70">
                          {Math.round((affectedVerif.recovered / affectedVerif.totalChecked) * 100)}% do total
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-600">
                        <Wifi className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide">Degradados</span>
                      </div>
                      <p className="mt-1 text-xl font-bold tabular-nums text-amber-800">
                        {affectedVerif.stillDegraded.toLocaleString('pt-BR')}
                      </p>
                      {affectedVerif.totalChecked > 0 && (
                        <p className="mt-0.5 text-[10px] text-amber-600/70">
                          {Math.round((affectedVerif.stillDegraded / affectedVerif.totalChecked) * 100)}% do total
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-rose-200/80 bg-rose-50/60 px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 text-rose-600">
                        <WifiOff className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide">Sem sinal</span>
                      </div>
                      <p className="mt-1 text-xl font-bold tabular-nums text-rose-800">
                        {affectedVerif.stillOffline.toLocaleString('pt-BR')}
                      </p>
                      {affectedVerif.totalChecked > 0 && (
                        <p className="mt-0.5 text-[10px] text-rose-600/70">
                          {Math.round((affectedVerif.stillOffline / affectedVerif.totalChecked) * 100)}% do total
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
