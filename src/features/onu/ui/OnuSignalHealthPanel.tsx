import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  RefreshCw,
  Server,
  Gauge,
  HeartPulse,
  Thermometer,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useOnuNetworkSummary } from '@/features/onu/hooks/useOnuNetworkSummary'
import { useOnuSummaryBySplitter } from '@/features/onu/hooks/useOnuSummaryBySplitter'
import { RX_POWER_DEGRADED_DBM, RX_POWER_CRITICAL_DBM } from '@/features/onu/model/onuDiagnostic'
import { OnuRecentChangesFeed } from '@/features/onu/ui/OnuRecentChangesFeed'
import type {
  OnuHistogramBucket,
  OnuNetworkSummary,
  OnuOltBreakdown,
} from '@/features/onu/model/onuNetworkSummary'

const OnuSignalHeatMap = lazy(async () => {
  const m = await import('@/features/onu/ui/OnuSignalHeatMap')
  return { default: m.OnuSignalHeatMap }
})

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0
}

function fmtInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function fmtPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

function fmtDbm(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} dBm`
}

const BAND_BAR_COLOR: Record<OnuHistogramBucket['band'], string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
}

// ---------------------------------------------------------------------------
// Índice de saúde + narrativa dinâmica
// ---------------------------------------------------------------------------

type HealthLevel = 'healthy' | 'attention' | 'critical'

type NetworkInsights = {
  monitored: number
  healthIndex: number
  level: HealthLevel
  healthyPct: number
  offlinePct: number
  degradedPct: number
  /** OLT com maior taxa de offline (entre as relevantes). */
  worstOlt: OnuOltBreakdown | null
  /** % das ONUs offline da rede concentrada nas top 5 OLTs. */
  offlineConcentration: number
  topOfflineOltCount: number
}

const HEALTH_TONE: Record<HealthLevel, { label: string; chip: string; text: string; ring: string }> = {
  healthy: {
    label: 'Rede saudável',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    text: 'text-emerald-600',
    ring: 'text-emerald-500',
  },
  attention: {
    label: 'Rede sob atenção',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
    text: 'text-amber-600',
    ring: 'text-amber-500',
  },
  critical: {
    label: 'Rede crítica',
    chip: 'border-rose-200 bg-rose-50 text-rose-700',
    text: 'text-rose-600',
    ring: 'text-rose-500',
  },
}

function computeInsights(s: OnuNetworkSummary): NetworkInsights {
  const { online, degraded, offline } = s.totals
  const monitored = online + degraded + offline
  // Índice ponderado: online = 1, atenuado = 0,5, offline = 0.
  const healthIndex = monitored > 0
    ? Math.round(((online + degraded * 0.5) / monitored) * 100)
    : 0
  const level: HealthLevel =
    healthIndex >= 93 ? 'healthy' : healthIndex >= 80 ? 'attention' : 'critical'

  const oltBreakdown = s.oltBreakdown ?? []

  // OLT com maior taxa de offline, ignorando OLTs pequenas (ruído estatístico).
  const relevant = oltBreakdown.filter((o) => o.monitored >= 30)
  const worstOlt =
    relevant.length > 0
      ? relevant.reduce((a, b) => (b.offlineRate > a.offlineRate ? b : a))
      : null

  // Concentração de Pareto: quanto das ONUs offline está nas 5 OLTs com mais offline.
  const byOffline = [...oltBreakdown].sort((a, b) => b.offline - a.offline)
  const topOfflineOltCount = Math.min(5, byOffline.length)
  const topOfflineSum = byOffline
    .slice(0, topOfflineOltCount)
    .reduce((acc, o) => acc + o.offline, 0)
  const offlineConcentration = pct(topOfflineSum, offline)

  return {
    monitored,
    healthIndex,
    level,
    healthyPct: pct(online, monitored),
    offlinePct: pct(offline, monitored),
    degradedPct: pct(degraded, monitored),
    worstOlt,
    offlineConcentration,
    topOfflineOltCount,
  }
}

function StatCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  sub: string
  tone: 'emerald' | 'amber' | 'rose' | 'slate'
  icon: typeof Wifi
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
    rose: 'border-rose-200 bg-rose-50/70 text-rose-700',
    slate: 'border-slate-200 bg-slate-50/70 text-slate-600',
  }
  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm', toneClasses[tone])}>
      <div className="flex items-center gap-2">
        <Icon size={16} strokeWidth={2} />
        <p className="text-[11px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums text-on-surface">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium opacity-80">{sub}</p>
    </div>
  )
}

/** Anel SVG com o índice de saúde (0–100). */
function HealthRing({ value, level }: { value: number; level: HealthLevel }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circ
  const tone = HEALTH_TONE[level]
  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className={tone.ring}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums text-on-surface">{value}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60">índice</span>
      </div>
    </div>
  )
}

/**
 * Barra de VOLUME de problema da OLT (offline + atenuado), com comprimento
 * relativo à OLT mais afetada da lista — reforça o ranking visualmente. A
 * fração offline aparece em vermelho; a atenuada, em âmbar. (A barra de
 * "saúde" cheia de verde não diferenciava nada, já que o problema é ~0-1%.)
 */
function OltProblemBar({ o, max }: { o: OnuOltBreakdown; max: number }) {
  const problems = o.offline + o.degraded
  const widthPct = max > 0 ? (problems / max) * 100 : 0
  const offlinePart = problems > 0 ? (o.offline / problems) * widthPct : 0
  const degradedPart = widthPct - offlinePart
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
      <div className="flex h-full">
        <div className="bg-rose-500" style={{ width: `${offlinePart}%` }} />
        <div className="bg-amber-400" style={{ width: `${degradedPart}%` }} />
      </div>
    </div>
  )
}

// Intervalo de referência para a barra de sinal visual (dBm).
const SIGNAL_BAR_WORST = -32
const SIGNAL_BAR_BEST  = -14

function signalBarWidth(rxPower: number): number {
  const clamped = Math.max(SIGNAL_BAR_WORST, Math.min(SIGNAL_BAR_BEST, rxPower))
  return ((clamped - SIGNAL_BAR_WORST) / (SIGNAL_BAR_BEST - SIGNAL_BAR_WORST)) * 100
}

function OnuSplitterSignalRanking() {
  const query = useOnuSummaryBySplitter()
  const [search, setSearch] = useState('')

  if (query.isPending) {
    return (
      <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={15} className="text-primary" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-4 animate-pulse rounded bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (query.isError || !query.data) return null

  const rows = [...query.data.entries()]
    .map(([code, s]) => ({ code, ...s }))
    .sort((a, b) => {
      if (a.avgRxPower === null && b.avgRxPower === null) return 0
      if (a.avgRxPower === null) return 1
      if (b.avgRxPower === null) return -1
      return a.avgRxPower - b.avgRxPower
    })

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter((r) =>
        (r.title ?? '').toLowerCase().includes(q) ||
        String(r.code).toLowerCase().includes(q),
      )
    : rows
  const shown = filtered.slice(0, 50)

  return (
    <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wifi size={15} className="text-primary" />
          <h3 className="text-sm font-semibold tracking-tight text-on-surface">
            Ranking de sinal por splitter
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {query.isFetching ? (
            <RefreshCw size={12} className="animate-spin text-on-surface-variant/40" aria-label="Atualizando" />
          ) : null}
          <span className="text-[10px] font-semibold tabular-nums text-on-surface-variant/50">
            {rows.length} splitters
          </span>
        </div>
      </div>
      <p className="mt-0.5 text-[11px] text-on-surface-variant/55">
        Média dos clientes monitorados · pior sinal primeiro
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou código..."
        className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/40 sm:w-64"
      />

      <ul className="mt-3 space-y-0.5">
        {shown.map((row, i) => {
          const isNull = row.avgRxPower === null
          const isCritical = !isNull && row.avgRxPower! <= RX_POWER_CRITICAL_DBM
          const isDegraded = !isNull && !isCritical && row.avgRxPower! <= RX_POWER_DEGRADED_DBM

          const chipBg = isNull
            ? 'bg-slate-100 text-slate-500 border-slate-200'
            : isCritical
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : isDegraded
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200'

          const barColor = isCritical
            ? 'bg-rose-400'
            : isDegraded
              ? 'bg-amber-400'
              : 'bg-emerald-400'

          const barWidth = !isNull ? signalBarWidth(row.avgRxPower!) : 0

          const label = row.title ?? String(row.code)

          const delta = row.projectedRxPower != null && row.avgRxPower !== null
            ? Math.round((row.projectedRxPower - row.avgRxPower) * 10) / 10
            : null

          return (
            <li
              key={row.code}
              className="group flex items-start gap-2.5 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50"
            >
              {/* Rank */}
              <span className="mt-0.5 w-5 shrink-0 text-right text-[10px] font-black tabular-nums text-on-surface-variant/30">
                {i + 1}
              </span>

              {/* Info + barra */}
              <div className="min-w-0 flex-1">
                <Link
                  to={`/splitters/${encodeURIComponent(row.code)}`}
                  className="block truncate text-[12px] font-semibold text-on-surface hover:text-primary"
                >
                  {label}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[10px] text-on-surface-variant/45">{row.code}</span>
                  <span className="text-[10px] tabular-nums text-on-surface-variant/50">
                    <span className="text-emerald-600">{row.online}↑</span>
                    {row.degraded > 0 ? <span className="text-amber-600"> {row.degraded}⚠</span> : null}
                    {row.offline > 0 ? <span className="text-rose-600"> {row.offline}↓</span> : null}
                    <span className="text-on-surface-variant/35"> · {row.total} monit.</span>
                  </span>
                </div>
                {/* Barra de sinal */}
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-full rounded-full transition-all', isNull ? 'w-0' : barColor)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>

              {/* Chips direita */}
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums', chipBg)}>
                  {row.avgRxPower !== null ? `${row.avgRxPower.toFixed(1)} dBm` : '— dBm'}
                </span>
                {delta !== null ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                      delta > 3 ? 'text-rose-600' : delta > 1 ? 'text-amber-600' : 'text-emerald-600',
                    )}
                    title={`Projetado: ${row.projectedRxPower!.toFixed(1)} dBm · Atenuação: ${delta.toFixed(1)} dB`}
                  >
                    △{delta.toFixed(1)} dB
                  </span>
                ) : null}
              </div>
            </li>
          )
        })}
        {filtered.length > 50 ? (
          <li className="px-2 py-2 text-center text-[11px] text-on-surface-variant/50">
            +{filtered.length - 50} splitters — refine a busca para ver mais
          </li>
        ) : null}
        {filtered.length === 0 ? (
          <li className="py-6 text-center text-[11px] text-on-surface-variant/50">
            Nenhum splitter encontrado
          </li>
        ) : null}
      </ul>
    </div>
  )
}

/**
 * Painel de saúde de sinal da rede para o "Painel da Rede": índice de saúde,
 * narrativa dinâmica, KPIs, quebra por OLT (onde estão os problemas),
 * distribuição de potência e mapa de calor. Polling de 60s (cacheado no servidor).
 */
export function OnuSignalHealthPanel() {
  const query = useOnuNetworkSummary()
  const summary = query.data ?? null

  const insights = useMemo(() => (summary ? computeInsights(summary) : null), [summary])
  const maxHist = useMemo(
    () => (summary ? Math.max(1, ...summary.histogram.map((h) => h.count)) : 1),
    [summary],
  )

  if (query.isPending) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
        Carregando saúde de sinal da rede…
      </p>
    )
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-8 text-center text-sm text-rose-700">
        <p>Não foi possível carregar o resumo de sinal das ONUs.</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          <RefreshCw size={13} /> Tentar novamente
        </button>
      </div>
    )
  }

  if (!summary || !insights) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
        Monitoramento de ONU indisponível (banco não configurado no BFF).
      </p>
    )
  }

  const { total, online, degraded, offline, noData, criticalSignal } = summary.totals
  // Defaults defensivos: payload antigo (BFF ainda não reiniciado) pode não
  // trazer os campos novos. Evita crash até o cache do servidor renovar.
  const signalStats = summary.signalStats ?? {
    sampled: 0, avg: null, p10: null, p50: null, p90: null,
  }
  const temperature = summary.temperature ?? {
    sampled: 0, warm: 0, hot: 0, avg: null, max: null,
    warmThreshold: 60, hotThreshold: 70, hottest: [],
  }
  const oltBreakdown = summary.oltBreakdown ?? []
  const oltCount = summary.oltCount ?? oltBreakdown.length
  const topOlts = oltBreakdown.slice(0, 10)
  const maxOltProblems = Math.max(1, ...topOlts.map((o) => o.offline + o.degraded))
  const { monitored, healthIndex, level } = insights
  const tone = HEALTH_TONE[level]

  return (
    <div className="space-y-5">
      {/* Hero: índice de saúde + narrativa dinâmica */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HeartPulse size={16} className="text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
              Saúde de sinal da rede
            </h3>
          </div>
          {query.isFetching ? (
            <RefreshCw size={14} className="animate-spin text-primary/50" aria-label="Atualizando" />
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex items-center gap-4">
            <HealthRing value={healthIndex} level={level} />
            <div>
              <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider', tone.chip)}>
                {tone.label}
              </span>
              <p className="mt-2 text-[11px] leading-snug text-on-surface-variant/70">
                {fmtInt(monitored)} ONUs ativas<br />em {fmtInt(oltCount)} OLTs
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2.5 text-sm leading-relaxed text-on-surface-variant">
            <p>
              <span className="font-semibold text-on-surface">{fmtPct(insights.healthyPct)}</span> das ONUs operam
              com sinal saudável.{' '}
              <span className="font-semibold text-rose-600">{fmtInt(offline)}</span> estão{' '}
              <span className="font-semibold">offline</span> ({fmtPct(insights.offlinePct)}) e{' '}
              <span className="font-semibold text-amber-600">{fmtInt(degraded)}</span> com{' '}
              <span className="font-semibold">sinal atenuado</span> ({fmtPct(insights.degradedPct)}).
            </p>

            {offline > 0 && insights.offlineConcentration > 0 ? (
              <p>
                Os problemas estão{' '}
                <span className="font-semibold text-on-surface">concentrados</span>: as{' '}
                {insights.topOfflineOltCount} OLTs mais afetadas respondem por{' '}
                <span className="font-semibold">{fmtPct(insights.offlineConcentration, 0)}</span> de todas as
                ONUs offline.
                {insights.worstOlt ? (
                  <>
                    {' '}A mais crítica é a{' '}
                    <span className="font-mono font-semibold text-on-surface">{insights.worstOlt.olt}</span>, com{' '}
                    <span className="font-semibold text-rose-600">
                      {fmtPct(insights.worstOlt.offlineRate * 100)}
                    </span>{' '}
                    de offline (média da rede: {fmtPct(insights.offlinePct)}).
                  </>
                ) : null}
              </p>
            ) : null}

            {signalStats.p50 !== null ? (
              <p>
                A recepção <span className="font-semibold text-on-surface">mediana</span> das ONUs online é{' '}
                <span className="font-semibold tabular-nums">{fmtDbm(signalStats.p50)}</span>.
                {signalStats.p10 !== null ? (
                  <>
                    {' '}Os 10% piores já operam abaixo de{' '}
                    <span className="font-semibold tabular-nums">{fmtDbm(signalStats.p10)}</span> — margem estreita
                    até o limite crítico de -28 dBm.
                  </>
                ) : null}
              </p>
            ) : null}

            {criticalSignal > 0 ? (
              <p className="flex items-start gap-1.5 rounded-lg bg-rose-50/80 px-2.5 py-2 text-rose-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" strokeWidth={2} />
                <span>
                  <span className="font-bold">{fmtInt(criticalSignal)} clientes</span> em nível crítico (≤ -28 dBm)
                  são prioridade imediata de inspeção de fibra/porta.
                </span>
              </p>
            ) : null}

            {temperature.hot > 0 ? (
              <p className="flex items-start gap-1.5 rounded-lg bg-orange-50/80 px-2.5 py-2 text-orange-800">
                <Thermometer size={15} className="mt-0.5 shrink-0" strokeWidth={2} />
                <span>
                  <span className="font-bold">{fmtInt(temperature.hot)} ONUs</span> operam acima de{' '}
                  {temperature.hotThreshold} °C — risco térmico de falha de hardware.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Online"
          value={fmtInt(online)}
          sub={`${fmtPct(pct(online, monitored))} das monitoradas`}
          tone="emerald"
          icon={Wifi}
        />
        <StatCard
          label="Atenuado"
          value={fmtInt(degraded)}
          sub={`${fmtPct(pct(degraded, monitored))} — sinal fraco/alerta`}
          tone="amber"
          icon={Activity}
        />
        <StatCard
          label="Offline"
          value={fmtInt(offline)}
          sub={`${fmtPct(pct(offline, monitored))} sem conexão`}
          tone="rose"
          icon={WifiOff}
        />
        <StatCard
          label="Sinal crítico"
          value={fmtInt(criticalSignal)}
          sub="≤ -28 dBm — inspecionar"
          tone="rose"
          icon={AlertTriangle}
        />
      </div>

      {/* Feed near-real-time de quedas/recuperações */}
      <OnuRecentChangesFeed />

      {/* Estatísticas de distribuição do sinal */}
      <div className="grid gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm sm:grid-cols-4">
        <div className="sm:col-span-4 -mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
          <Gauge size={13} /> Distribuição de recepção (ONUs online)
        </div>
        {[
          { k: 'P10 (10% piores)', v: signalStats.p10, tone: 'text-amber-600' },
          { k: 'Mediana (P50)', v: signalStats.p50, tone: 'text-on-surface' },
          { k: 'P90 (10% melhores)', v: signalStats.p90, tone: 'text-emerald-600' },
          { k: 'Média', v: signalStats.avg, tone: 'text-on-surface' },
        ].map((m) => (
          <div key={m.k}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/55">{m.k}</p>
            <p className={cn('mt-0.5 text-lg font-black tabular-nums', m.tone)}>{fmtDbm(m.v)}</p>
          </div>
        ))}
      </div>

      {/* Barra de proporção da rede */}
      <div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${pct(online, total)}%` }} title={`Online: ${fmtInt(online)}`} />
          <div className="bg-amber-500" style={{ width: `${pct(degraded, total)}%` }} title={`Atenuado: ${fmtInt(degraded)}`} />
          <div className="bg-rose-500" style={{ width: `${pct(offline, total)}%` }} title={`Offline: ${fmtInt(offline)}`} />
          <div className="bg-slate-300" style={{ width: `${pct(noData, total)}%` }} title={`Sem dados: ${fmtInt(noData)}`} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-on-surface-variant/75">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Online</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Atenuado</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Offline</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Sem dados ({fmtInt(noData)})</span>
        </div>
      </div>

      {/* Onde está o problema: OLTs mais afetadas */}
      <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Server size={15} className="text-primary" />
          <h3 className="text-sm font-semibold tracking-tight text-on-surface">
            Onde está o problema — OLTs mais afetadas
          </h3>
        </div>
        <p className="mt-1 text-[11px] text-on-surface-variant/65">
          Ordenadas por volume de ONUs offline + atenuadas. Mostrando {topOlts.length} de {fmtInt(oltCount)} OLTs.
        </p>
        <ul className="mt-3 grid gap-x-6 gap-y-2.5 lg:grid-cols-2">
          {topOlts.map((o, i) => (
            <li key={o.olt} className="border-b border-outline-variant/30 pb-2.5 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="w-4 shrink-0 text-right text-[10px] font-black tabular-nums text-on-surface-variant/35">
                    {i + 1}
                  </span>
                  <span className="truncate font-mono text-[11px] font-bold text-on-surface">{o.olt}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[10px] font-bold tabular-nums">
                  <span className="text-rose-600">{fmtInt(o.offline)} off</span>
                  {o.degraded > 0 ? <span className="text-amber-600">{fmtInt(o.degraded)} aten.</span> : null}
                  {o.critical > 0 ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">{fmtInt(o.critical)} crít</span>
                  ) : null}
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <OltProblemBar o={o} max={maxOltProblems} />
                <span className="w-[4.5rem] shrink-0 text-right text-[9px] font-medium tabular-nums text-on-surface-variant/45">
                  {fmtInt(o.monitored)} ONUs
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Ranking de sinal por splitter */}
      <OnuSplitterSignalRanking />

      {/* Temperatura das ONUs */}
      {temperature.sampled > 0 ? (
        <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Thermometer size={15} className="text-orange-500" />
            <h3 className="text-sm font-semibold tracking-tight text-on-surface">
              Temperatura das ONUs
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-on-surface-variant/65">
            Leitura térmica de {fmtInt(temperature.sampled)} ONUs online. Atenção a partir de{' '}
            {temperature.warmThreshold} °C, risco crítico ≥ {temperature.hotThreshold} °C.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Quentes ≥ {temperature.warmThreshold}°C
              </p>
              <p className="mt-1 text-xl font-black tabular-nums text-on-surface">
                {fmtInt(temperature.warm)}
              </p>
            </div>
            <div className="rounded-xl border border-orange-300 bg-orange-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                Críticas ≥ {temperature.hotThreshold}°C
              </p>
              <p className="mt-1 text-xl font-black tabular-nums text-on-surface">
                {fmtInt(temperature.hot)}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low/30 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/55">Média</p>
              <p className="mt-1 text-xl font-black tabular-nums text-on-surface">
                {temperature.avg !== null ? `${temperature.avg.toFixed(1)} °C` : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/60 bg-surface-container-low/30 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/55">Máxima</p>
              <p className="mt-1 text-xl font-black tabular-nums text-on-surface">
                {temperature.max !== null ? `${temperature.max.toFixed(1)} °C` : '—'}
              </p>
            </div>
          </div>

          {temperature.hottest.length > 0 ? (
            <>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                ONUs mais quentes agora
              </p>
              <ul className="mt-2 divide-y divide-outline-variant/40">
                {temperature.hottest.slice(0, 10).map((h, i) => (
                  <li key={`${h.username}-${i}`} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-on-surface">
                        {h.username ?? '—'}
                      </p>
                      <p className="truncate text-[10px] text-on-surface-variant/60">
                        {h.oltHostname ?? 'OLT —'}
                        {h.rxPower !== null ? ` · RX ${h.rxPower.toFixed(1)} dBm` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                        (h.temperature ?? 0) >= temperature.hotThreshold
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {h.temperature !== null ? `${h.temperature.toFixed(1)} °C` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-emerald-50/70 px-3 py-2 text-[11px] font-medium text-emerald-700">
              Nenhuma ONU acima de {temperature.warmThreshold} °C no momento.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Histograma de potência RX */}
        <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight text-on-surface">
            Distribuição de potência RX (ONUs online)
          </h3>
          <p className="mt-1 text-[11px] text-on-surface-variant/65">
            Quanto mais à esquerda (mais negativo), mais fraco o sinal.
          </p>
          <div className="mt-4 space-y-2">
            {summary.histogram.map((h) => (
              <div key={h.label} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-right text-[10px] font-medium tabular-nums text-on-surface-variant/70">
                  {h.label}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div
                    className={cn('h-full rounded transition-all', BAND_BAR_COLOR[h.band])}
                    style={{ width: `${pct(h.count, maxHist)}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-[10px] font-semibold tabular-nums text-on-surface">
                  {fmtInt(h.count)}
                </span>
              </div>
            ))}
          </div>
          {signalStats.p50 !== null ? (
            <p className="mt-3 border-t border-outline-variant/40 pt-2 text-[10px] text-on-surface-variant/55">
              Mediana {fmtDbm(signalStats.p50)} · P10 {fmtDbm(signalStats.p10)} · P90 {fmtDbm(signalStats.p90)}
            </p>
          ) : null}
        </div>

        {/* Piores clientes */}
        <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight text-on-surface">
            Piores sinais agora ({summary.worst.length})
          </h3>
          <p className="mt-1 text-[11px] text-on-surface-variant/65">
            Clientes online com a recepção mais atenuada — candidatos a inspeção.
          </p>
          <ul className="mt-3 divide-y divide-outline-variant/40">
            {summary.worst.length === 0 ? (
              <li className="py-3 text-center text-xs text-on-surface-variant/60">
                Nenhum cliente com sinal fraco no momento.
              </li>
            ) : (
              summary.worst.map((w, i) => (
                <li key={`${w.username}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold text-on-surface">
                      {w.username ?? '—'}
                    </p>
                    <p className="truncate text-[10px] text-on-surface-variant/60">
                      {w.oltHostname ?? 'OLT —'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                      (w.rxPower ?? 0) <= -28
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {w.rxPower !== null ? `${w.rxPower.toFixed(1)} dBm` : '—'}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Mapa de problemas geolocalizados */}
      <div className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight text-on-surface">
          Mapa de problemas — onde estão os clientes afetados
        </h3>
        <p className="mt-1 mb-3 text-[11px] text-on-surface-variant/65">
          Offline e críticos são pontos clicáveis (cliente, OLT e sinal). Os atenuados aparecem como
          densidade. Use a legenda para filtrar as camadas.
        </p>
        <Suspense
          fallback={
            <div className="h-[min(480px,58vh)] w-full animate-pulse rounded-2xl bg-slate-100" />
          }
        >
          <OnuSignalHeatMap
            heatPoints={summary.heatPoints}
            problemMarkers={summary.problemMarkers ?? []}
          />
        </Suspense>
      </div>

      <p className="text-[11px] text-on-surface-variant/50">
        Atualizado em{' '}
        {summary.generatedAt
          ? new Date(summary.generatedAt).toLocaleString('pt-BR')
          : '—'}{' '}
        · atualização automática a cada 60s.
      </p>
    </div>
  )
}
