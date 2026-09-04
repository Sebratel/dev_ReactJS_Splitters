import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  Maximize,
  Minimize,
  Radio,
  Timer,
  Users,
  WifiOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { fetchMassivaHistoryListFromLocalDb } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { fetchMassivaHistoryMttdMttrKpis } from '@/features/massiva/api/fetchMassivaHistoryMttdMttrKpis'
import { fetchOnuNetworkSummary } from '@/features/onu/api/fetchOnuNetworkSummary'
import { fetchMassivaSignalProgress } from '@/features/massiva/api/fetchMassivaSignalProgress'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import { isMassivaOpenForGlobalDashboard } from '@/features/massiva/lib/massivaDashboardEligibility'
import type { OnuOltBreakdown } from '@/features/onu/model/onuNetworkSummary'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { cn } from '@/shared/lib/utils'

const TICKETS_REFETCH_MS = 30_000
const HISTORY_REFETCH_MS = 60_000
const ONU_REFETCH_MS = 30_000
const CLOCK_TICK_MS = 1_000
const SLA_RISK_WINDOW_MIN = 60
const INCIDENT_ROWS_LIMIT = 60
/** Acima disto, a lista "no prazo" entra em auto-scroll (não cabe na tela da TV). */
const OK_SCROLL_THRESHOLD = 10
const RECURRENCE_ROWS_LIMIT = 5
const SINAL_ROWS_LIMIT = 6

function startOfTodayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Compara AP/OLT por substring nas duas direções — cruzamento propositalmente tolerante. */
function fuzzyMatchesOlt(apCode: string, apTitle: string, oltHostname: string): boolean {
  const olt = normalizeForMatch(oltHostname)
  if (olt === '') return false
  const candidates = [apCode, apTitle].map(normalizeForMatch).filter((c) => c !== '')
  return candidates.some((c) => c.includes(olt) || olt.includes(c))
}

function formatDurationSince(date: Date | null, nowMs: number): string {
  if (date === null) return '—'
  const diffMin = Math.max(0, Math.round((nowMs - date.getTime()) / 60_000))
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`
}

type SlaState = { label: string; severity: 'ok' | 'warn' | 'crit' }

function formatSla(expectedCloseAt: Date | null, nowMs: number): SlaState {
  if (expectedCloseAt === null) return { label: 'sem previsão', severity: 'ok' }
  const diffMin = Math.round((expectedCloseAt.getTime() - nowMs) / 60_000)
  if (diffMin < 0) {
    const abs = Math.abs(diffMin)
    const h = Math.floor(abs / 60)
    const m = abs % 60
    return {
      label: h > 0 ? `vencido ${h}h ${m}min` : `vencido ${m}min`,
      severity: 'crit',
    }
  }
  if (diffMin <= SLA_RISK_WINDOW_MIN) {
    return { label: `vence em ${diffMin}min`, severity: 'warn' }
  }
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return { label: h > 0 ? `vence em ${h}h ${m}min` : `vence em ${m}min`, severity: 'ok' }
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}h`
}

const chipClass: Record<SlaState['severity'], string> = {
  ok: 'bg-emerald-500/15 text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-300',
  crit: 'bg-rose-500/15 text-rose-300',
}
const stripeClass: Record<SlaState['severity'], string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  crit: 'bg-rose-400',
}

/** Emoji animado por severidade de SLA (crit tremendo, warn virando, ok respirando). */
const slaEmoji: Record<SlaState['severity'], { emoji: string; anim: string }> = {
  crit: { emoji: '🚨', anim: 'slaa-shake' },
  warn: { emoji: '⏳', anim: 'slaa-flip' },
  ok: { emoji: '🟢', anim: 'slaa-breathe' },
}

const SLA_ANIM_CSS = `
@keyframes slaa-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(12deg)}60%{transform:rotate(-10deg)}80%{transform:rotate(8deg)}}
@keyframes slaa-flip{0%,58%{transform:rotate(0)}78%,100%{transform:rotate(180deg)}}
@keyframes slaa-breathe{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.14);opacity:1}}
@keyframes slaa-pill{0%,100%{box-shadow:0 0 0 0 rgba(244,63,94,.45)}70%{box-shadow:0 0 0 6px rgba(244,63,94,0)}}
.slaa{display:inline-block;margin-right:5px;font-size:16px;line-height:1}
.slaa-shake{animation:slaa-shake .7s ease-in-out infinite}
.slaa-flip{animation:slaa-flip 2.2s ease-in-out infinite}
.slaa-breathe{animation:slaa-breathe 2.4s ease-in-out infinite}
.slaa-pill{animation:slaa-pill 1.4s ease-in-out infinite}
@keyframes slaa-marquee{from{transform:translateY(0)}to{transform:translateY(-50%)}}
.slaa-marquee{animation-name:slaa-marquee;animation-timing-function:linear;animation-iteration-count:infinite}
@media (prefers-reduced-motion:reduce){.slaa-shake,.slaa-flip,.slaa-breathe,.slaa-pill,.slaa-marquee{animation:none}}
`

/** Larguras fixas das colunas — iguais nas duas tabelas (fixas no topo + rolando). */
function MonColgroup() {
  return (
    <colgroup>
      <col style={{ width: '8%' }} />
      <col style={{ width: '11%' }} />
      <col style={{ width: '22%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '8%' }} />
      <col style={{ width: '12%' }} />
      <col style={{ width: '8%' }} />
      <col style={{ width: '12%' }} />
      <col style={{ width: '12%' }} />
    </colgroup>
  )
}

type SignalProgress = { recovered: number; total: number }
const EMPTY_PROGRESS: Map<number, SignalProgress> = new Map()

function IncidentRow({
  t,
  sla,
  nowMs,
  tipo,
  recurrence,
  progress,
}: {
  t: MassivaTicket
  sla: SlaState
  nowMs: number
  tipo?: string | null
  recurrence?: number
  progress?: SignalProgress | null
}) {
  const operator = (t.createdBy ?? '').trim()
  const operatorDisplay = operator.includes('@') ? operator.split('@')[0] : operator || '—'
  const res = t.affectedClientsResidential
  const corp = t.affectedClientsCorporate
  const showRecurrence = typeof recurrence === 'number' && recurrence >= 2
  const pct =
    progress && progress.total > 0 ? Math.round((progress.recovered / progress.total) * 100) : null
  return (
    <tr className="border-t border-[#253150]/50 align-top">
      <td className="py-2 font-mono font-semibold">{t.protocol > 0 ? t.protocol : '—'}</td>
      <td className="py-2">
        {t.infraProtocol != null && t.infraProtocol > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[12px] font-bold text-violet-300">
            🔗 {t.infraProtocol}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-[#3f4c6b]">—</span>
        )}
      </td>
      <td className="overflow-hidden py-2">
        <div>
          <span className={cn('mr-2 inline-block h-4 w-1 rounded-sm align-middle', stripeClass[sla.severity])} />
          <span className="align-middle">{t.title.trim() !== '' ? t.title : t.apCode || '—'}</span>
          {t.apCode ? <span className="ml-1.5 font-mono text-[11px] text-[#5a6685]">{t.apCode}</span> : null}
        </div>
        {tipo || showRecurrence ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {tipo ? (
              <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-orange-300">
                {tipo}
              </span>
            ) : null}
            {showRecurrence ? (
              <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-300">
                🔁 {recurrence}× hoje
              </span>
            ) : null}
          </div>
        ) : null}
      </td>
      <td className="py-2">
        <div>{t.affectedClients.toLocaleString('pt-BR')}</div>
        {res != null && corp != null ? (
          <div className="font-mono text-[9px] text-[#5a6685]">
            {res}R · {corp}C
          </div>
        ) : null}
      </td>
      <td className="py-2">{formatDurationSince(t.openedAt, nowMs)}</td>
      <td className="overflow-hidden py-2 font-mono text-[12px] text-[#8593b8]">{operatorDisplay}</td>
      <td className="py-2 text-[12px]">{MASSIVA_IDENTIFIED_BY_LABEL[t.identifiedBy ?? ''] ?? '—'}</td>
      <td className="py-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11.5px] font-bold',
            chipClass[sla.severity],
            sla.severity === 'crit' && 'slaa-pill',
          )}
        >
          <span className={cn('slaa', slaEmoji[sla.severity].anim)} aria-hidden>
            {slaEmoji[sla.severity].emoji}
          </span>
          {sla.label}
        </span>
      </td>
      <td className="py-2">
        {pct != null ? (
          <div className="flex items-center gap-1.5">
            <span className="h-[5px] w-14 overflow-hidden rounded-full bg-[#253150]">
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="font-mono text-[10px] font-bold text-emerald-300">
              {progress!.recovered}/{progress!.total} ↑
            </span>
          </div>
        ) : (
          <span className="font-mono text-[10px] text-[#3f4c6b]">—</span>
        )}
      </td>
    </tr>
  )
}

/** Rótulo curto de "quem identificou o evento" para a coluna Origem. */
const MASSIVA_IDENTIFIED_BY_LABEL: Record<string, string> = {
  tecnico: 'Técnico',
  zabbix: 'Zabbix',
  int6: 'INT6',
}

type KpiTrend = { deltaLabel: string; better: boolean }

/** Tendência de uma métrica de tempo (min): menor = melhor → seta pra baixo verde. */
function computeTimeTrend(current: number | null, previous: number | null): KpiTrend | null {
  if (current == null || previous == null || current === previous) return null
  const abs = Math.abs(current - previous)
  const deltaLabel = abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}` : `${abs}min`
  return { deltaLabel, better: current < previous }
}

/** Sparkline minimalista (SVG) — tendência dos últimos meses. */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${22 - ((v - min) / range) * 20}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-1.5 h-4 w-full" aria-hidden>
      <polyline points={points} fill="none" stroke="#5dcaa5" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function KpiTile({
  label,
  value,
  note,
  tone = 'default',
  Icon,
  trend,
  spark,
}: {
  label: string
  value: string
  note?: string
  tone?: 'default' | 'warn' | 'crit'
  Icon?: LucideIcon
  trend?: KpiTrend | null
  spark?: number[] | null
}) {
  const crit = tone === 'crit'
  const warn = tone === 'warn'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[10px] border px-4 py-3.5',
        crit
          ? 'border-rose-800/60 bg-rose-950/30 slaa-pill'
          : warn
            ? 'border-amber-800/50 bg-amber-950/25'
            : 'border-[#253150] bg-[#121a2b]',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          crit ? 'bg-rose-500' : warn ? 'bg-amber-400' : 'bg-transparent',
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8593b8]">
          {Icon ? (
            <Icon
              size={13}
              className={crit ? 'text-rose-300' : warn ? 'text-amber-300' : 'text-[#5a6685]'}
            />
          ) : null}
          {label}
        </p>
        {trend ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold',
              trend.better ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300',
            )}
            title={trend.better ? 'melhorou vs mês passado' : 'piorou vs mês passado'}
          >
            {trend.better ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
            {trend.deltaLabel}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'mt-1.5 font-mono text-[28px] font-bold leading-none tabular-nums',
          crit ? 'text-rose-400' : warn ? 'text-amber-400' : 'text-[#eaf0fa]',
        )}
      >
        {value}
      </p>
      {spark && spark.length > 1 ? <Sparkline data={spark} /> : null}
      {note ? <p className="mt-1 text-[11px] text-[#5a6685]">{note}</p> : null}
    </div>
  )
}

function SlaGaugeTile({
  compliance,
  meta = 90,
}: {
  compliance: { pct: number; within: number; total: number } | null
  meta?: number
}) {
  const pct = compliance?.pct ?? null
  const ok = pct != null && pct >= meta
  const near = pct != null && pct >= meta - 10
  const color = pct == null ? '#34415f' : ok ? '#1d9e75' : near ? '#eab308' : '#e24b4a'
  const turn = pct == null ? 0 : Math.max(0, Math.min(1, pct / 100))
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[#253150] bg-[#121a2b] px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8593b8]">
        <Gauge size={13} className="text-[#5a6685]" /> SLA cumprido
        <span className="font-mono text-[9.5px] font-normal text-[#5a6685]">(mês)</span>
      </p>
      <div className="mt-1.5 flex items-center gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${color} 0turn ${turn}turn, #253150 ${turn}turn 1turn)` }}
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-[#121a2b] font-mono text-[12px] font-bold" style={{ color }}>
            {pct != null ? `${pct}%` : '—'}
          </span>
        </div>
        <div className="text-[11px] text-[#5a6685]">
          <div>meta {meta}%</div>
          {compliance ? <div className="font-mono">{compliance.within}/{compliance.total} no prazo</div> : null}
        </div>
      </div>
    </div>
  )
}

function Panel({
  title,
  extra,
  children,
  className,
}: {
  title: string
  extra?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col rounded-[10px] border border-[#253150] bg-[#121a2b] p-4', className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#8593b8]">{title}</p>
        {extra}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

/**
 * Painel de parede (CGR/COR) — indicadores de massivas em tempo real, estilo NOC.
 * Tela fixa, sem interação, atualização automática. Layout aprovado: Opção A.
 * Rota isolada (`/massiva/monitor`), fora do chrome padrão do app (sem sidebar/menu).
 */
export function MassivaMonitorScreen() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  // Tela cheia (parede/kiosk): entra/sai via Fullscreen API do documento inteiro.
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement == null) {
      void document.documentElement.requestFullscreen?.().catch(() => {})
    } else {
      void document.exitFullscreen?.().catch(() => {})
    }
  }

  const { view } = useMassivaTickets({ refetchIntervalMs: TICKETS_REFETCH_MS })
  const bffTickets: MassivaTicket[] = view.status === 'success' ? view.tickets : []

  // Janela de 7 dias para buscar aberturas locais (DB MySQL/BFF).
  // O sessionStorage (recentOpenTickets) NAO e compartilhado entre abas, entao o
  // monitor nao tem acesso aos "opens" da aba principal. A solucao e buscar o
  // historico local diretamente e usa-lo como fonte de verdade para o merge com o
  // BFF — buildDashboardMassivaTickets consegue sobrepor o status Elleven ambiguo
  // com o status local quando isRecentLocalOpen retorna true.
  const openPeriodStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const openLocalQuery = useQuery({
    queryKey: massivaKeys.historyList('aberta', openPeriodStart.toISOString(), 'monitor-open', 500),
    queryFn: () =>
      fetchMassivaHistoryListFromLocalDb({ status: 'aberta', startDate: openPeriodStart, limit: 500 }),
    staleTime: TICKETS_REFETCH_MS / 2,
    refetchInterval: TICKETS_REFETCH_MS,
  })

  const openTickets = useMemo(() => {
    const localRows = openLocalQuery.data ?? []
    const merged = buildDashboardMassivaTickets({
      bffTickets,
      localRows,
      recentOpenTickets: [],  // sessionStorage nao compartilhado entre abas — localRows compensam
      periodStart: openPeriodStart,
    })
    return merged
      .filter((t) => isMassivaOpenForGlobalDashboard(t))
      .sort((a, b) => {
        const aTime = a.expectedCloseAt?.getTime() ?? Number.POSITIVE_INFINITY
        const bTime = b.expectedCloseAt?.getTime() ?? Number.POSITIVE_INFINITY
        return aTime - bTime
      })
  }, [bffTickets, openLocalQuery.data, openPeriodStart])

  const todayStart = useMemo(() => startOfTodayLocal(), [])
  const historyQuery = useQuery({
    queryKey: massivaKeys.historyList('all', todayStart.toISOString(), 'monitor', 500),
    queryFn: () => fetchMassivaHistoryListFromLocalDb({ status: null, startDate: todayStart, limit: 500 }),
    staleTime: HISTORY_REFETCH_MS / 2,
    refetchInterval: HISTORY_REFETCH_MS,
  })

  const mttdMttrQuery = useQuery({
    queryKey: massivaKeys.mttdMttrKpis(6),
    queryFn: () => fetchMassivaHistoryMttdMttrKpis(6),
    staleTime: HISTORY_REFETCH_MS / 2,
    refetchInterval: HISTORY_REFETCH_MS,
  })

  const onuQuery = useQuery({
    queryKey: ['onu-network-summary', 'monitor'],
    queryFn: fetchOnuNetworkSummary,
    staleTime: ONU_REFETCH_MS / 2,
    refetchInterval: ONU_REFETCH_MS,
  })

  // SLA cumprido no mês: encerradas com closedAt <= previsão / total encerradas (com ambos).
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now])
  const slaMonthQuery = useQuery({
    queryKey: ['massiva', 'sla-month', `${monthStart.getFullYear()}-${monthStart.getMonth()}`],
    queryFn: () =>
      fetchMassivaHistoryListFromLocalDb({ status: 'encerrada', startDate: monthStart, limit: 3000 }),
    staleTime: HISTORY_REFETCH_MS / 2,
    refetchInterval: HISTORY_REFETCH_MS,
  })
  const slaCompliance = useMemo(() => {
    let within = 0
    let total = 0
    for (const r of slaMonthQuery.data ?? []) {
      if (r.closedAt && r.expectedCloseAt) {
        total += 1
        if (r.closedAt.getTime() <= r.expectedCloseAt.getTime()) within += 1
      }
    }
    return total > 0 ? { pct: Math.round((within / total) * 100), within, total } : null
  }, [slaMonthQuery.data])

  const nowMs = now.getTime()

  const kpis = useMemo(() => {
    const abertasAgora = openTickets.length
    const afetados = openTickets.reduce((sum, t) => sum + Math.max(0, t.affectedClients), 0)
    const slaRisk = openTickets.filter((t) => {
      if (t.expectedCloseAt === null) return false
      const diffMin = Math.round((t.expectedCloseAt.getTime() - nowMs) / 60_000)
      return diffMin <= SLA_RISK_WINDOW_MIN
    }).length
    return { abertasAgora, afetados, slaRisk }
  }, [openTickets, nowMs])

  const mttdMttrSeries = mttdMttrQuery.data ?? []
  const latestMttdMttr = mttdMttrSeries[mttdMttrSeries.length - 1] ?? null
  const prevMttdMttr = mttdMttrSeries[mttdMttrSeries.length - 2] ?? null
  const mttdSpark = useMemo(
    () => mttdMttrSeries.map((m) => m.avgMttdMinutes).filter((v): v is number => v != null),
    [mttdMttrSeries],
  )
  const mttrSpark = useMemo(
    () => mttdMttrSeries.map((m) => m.avgMttrMinutes).filter((v): v is number => v != null),
    [mttdMttrSeries],
  )
  const mttdTrend = computeTimeTrend(latestMttdMttr?.avgMttdMinutes ?? null, prevMttdMttr?.avgMttdMinutes ?? null)
  const mttrTrend = computeTimeTrend(latestMttdMttr?.avgMttrMinutes ?? null, prevMttdMttr?.avgMttrMinutes ?? null)

  const recurrenceToday = useMemo(() => {
    const byAp = new Map<string, { title: string; count: number }>()
    for (const row of historyQuery.data ?? []) {
      const code = row.accessPointCode.trim()
      if (code === '') continue
      const current = byAp.get(code)
      byAp.set(code, { title: row.title, count: (current?.count ?? 0) + 1 })
    }
    return [...byAp.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .filter((r) => r.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, RECURRENCE_ROWS_LIMIT)
  }, [historyQuery.data])

  const hourBuckets = useMemo(() => {
    const counts = new Map<number, number>()
    for (const row of historyQuery.data ?? []) {
      if (row.openedAt === null) continue
      const hour = row.openedAt.getHours()
      counts.set(hour, (counts.get(hour) ?? 0) + 1)
    }
    const currentHour = now.getHours()
    const hoursShown = 7
    const startHour = Math.max(0, currentHour - hoursShown + 1)
    const hours = Array.from({ length: currentHour - startHour + 1 }, (_, i) => startHour + i)
    const max = Math.max(1, ...hours.map((h) => counts.get(h) ?? 0))
    const peakHour = hours.reduce(
      (best, h) => ((counts.get(h) ?? 0) > (counts.get(best) ?? 0) ? h : best),
      hours[0] ?? currentHour,
    )
    return {
      bars: hours.map((h) => ({
        hour: h,
        count: counts.get(h) ?? 0,
        pct: Math.round(((counts.get(h) ?? 0) / max) * 100),
        isNow: h === currentHour,
        isPeak: h === peakHour && (counts.get(h) ?? 0) > 0,
      })),
      peakHour,
      peakCount: counts.get(peakHour) ?? 0,
    }
  }, [historyQuery.data, now])

  const sinalRows = useMemo(() => {
    const breakdown: OnuOltBreakdown[] = onuQuery.data?.oltBreakdown ?? []
    return breakdown
      .filter((o) => o.degraded + o.offline > 0)
      .sort((a, b) => (b.degraded + b.offline) - (a.degraded + a.offline))
      .slice(0, SINAL_ROWS_LIMIT)
      .map((o) => {
        const hasOpenMassiva = openTickets.some((t) => fuzzyMatchesOlt(t.apCode, t.title, o.olt))
        return { ...o, hasOpenMassiva }
      })
  }, [onuQuery.data, openTickets])

  const quedaSemMassivaCount = sinalRows.filter((r) => !r.hasOpenMassiva).length

  // openTickets ja vem ordenado por SLA (expectedCloseAt asc) do useMemo acima
  const incidentRows = useMemo(
    () => openTickets.slice(0, INCIDENT_ROWS_LIMIT),
    [openTickets],
  )

  // Crítico (vencido/perto) fica fixo no topo; "no prazo" rola sozinho se estourar a tela.
  const rowsWithSla = useMemo(
    () => incidentRows.map((t) => ({ t, sla: formatSla(t.expectedCloseAt, nowMs) })),
    [incidentRows, nowMs],
  )
  const criticalRows = useMemo(() => rowsWithSla.filter((r) => r.sla.severity !== 'ok'), [rowsWithSla])
  const okRows = useMemo(() => rowsWithSla.filter((r) => r.sla.severity === 'ok'), [rowsWithSla])
  const okScroll = okRows.length > OK_SCROLL_THRESHOLD

  // Tipo/classificação por protocolo e recorrência por ponto de acesso (do histórico).
  const tipoByProtocol = useMemo(() => {
    const m = new Map<number, string>()
    for (const row of historyQuery.data ?? []) {
      if (row.protocol && row.protocol > 0 && row.tipoIncidente) {
        if (!m.has(row.protocol)) m.set(row.protocol, row.tipoIncidente)
      }
    }
    return m
  }, [historyQuery.data])
  const recurrenceByApCode = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of historyQuery.data ?? []) {
      const code = row.accessPointCode.trim()
      if (code === '') continue
      m.set(code, (m.get(code) ?? 0) + 1)
    }
    return m
  }, [historyQuery.data])

  // Progresso de recuperação de sinal ao vivo (batch, leve, ~60s) por massiva aberta.
  const signalProgressItems = useMemo(
    () =>
      incidentRows
        .filter((t) => t.protocol > 0)
        .map((t) => ({ protocol: t.protocol, assignmentId: t.assignmentId ?? null })),
    [incidentRows],
  )
  const signalProgressQuery = useQuery({
    queryKey: [
      'massiva',
      'signal-progress',
      signalProgressItems.map((i) => i.protocol).sort((a, b) => a - b).join(','),
    ],
    queryFn: () => fetchMassivaSignalProgress(signalProgressItems),
    enabled: signalProgressItems.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  })
  const signalProgress = signalProgressQuery.data ?? EMPTY_PROGRESS

  // Rodízio automático (~10s) do slot secundário: Aberturas/hora <-> Recorrência.
  const [rotIndex, setRotIndex] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setRotIndex((i) => (i + 1) % 2), 10_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="min-h-dvh bg-[#0a0f1a] px-6 py-5 font-sans text-[#eaf0fa]">
      <style>{SLA_ANIM_CSS}</style>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#8593b8]">
          Painel operacional · massivas
        </p>
        <div className="flex items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-300">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            AO VIVO
          </span>
          <span className="font-mono text-sm text-[#5a6685]">
            {now.toLocaleTimeString('pt-BR')}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#253150] bg-[#121a2b] px-2.5 py-1.5 text-[11px] font-semibold text-[#8593b8] transition hover:border-[#34415f] hover:text-[#eaf0fa]"
            title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Sair' : 'Tela cheia'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        <KpiTile
          label="Abertas agora"
          value={String(kpis.abertasAgora)}
          tone={kpis.abertasAgora > 0 ? 'warn' : 'default'}
          Icon={Radio}
          note={kpis.abertasAgora > 0 ? 'massivas em andamento' : 'nenhuma massiva aberta'}
        />
        <KpiTile
          label="Clientes afetados"
          value={kpis.afetados.toLocaleString('pt-BR')}
          Icon={Users}
          note={`em ${kpis.abertasAgora} protocolo${kpis.abertasAgora === 1 ? '' : 's'}`}
        />
        <KpiTile
          label="SLA em risco"
          value={String(kpis.slaRisk)}
          tone={kpis.slaRisk > 0 ? 'crit' : 'default'}
          Icon={AlertTriangle}
          note={kpis.slaRisk > 0 ? 'precisa de ação' : 'tudo dentro do prazo'}
        />
        <KpiTile
          label="MTTD médio"
          value={latestMttdMttr?.avgMttdMinutes != null ? `${latestMttdMttr.avgMttdMinutes}min` : '—'}
          Icon={Timer}
          trend={mttdTrend}
          spark={mttdSpark}
          note="mês atual · vs mês passado"
        />
        <KpiTile
          label="MTTR médio"
          value={
            latestMttdMttr?.avgMttrMinutes != null
              ? `${Math.floor(latestMttdMttr.avgMttrMinutes / 60)}h ${String(latestMttdMttr.avgMttrMinutes % 60).padStart(2, '0')}min`
              : '—'
          }
          Icon={Wrench}
          trend={mttrTrend}
          spark={mttrSpark}
          note="mês atual · vs mês passado"
        />
        <KpiTile
          label="Queda sem massiva"
          value={String(quedaSemMassivaCount)}
          tone={quedaSemMassivaCount > 0 ? 'crit' : 'default'}
          Icon={WifiOff}
          note="sinal ONU × abertas"
        />
        <SlaGaugeTile compliance={slaCompliance} />
      </div>

      <Panel title={`Massivas abertas — ao vivo (${incidentRows.length})`} className="mt-3.5">
        {incidentRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#5a6685]">Nenhuma massiva aberta agora.</p>
        ) : (
          <div>
            <table className="w-full table-fixed text-[13px]">
              <MonColgroup />
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#5a6685]">
                  <th className="pb-2">Protocolo</th>
                  <th className="pb-2">Infra</th>
                  <th className="pb-2">Ponto de acesso</th>
                  <th className="pb-2">Afetados</th>
                  <th className="pb-2">Aberta há</th>
                  <th className="pb-2">Operador</th>
                  <th className="pb-2">Origem</th>
                  <th className="pb-2">SLA</th>
                  <th className="pb-2">Sinal</th>
                </tr>
              </thead>
              <tbody>
                {criticalRows.length > 0 ? (
                  criticalRows.map(({ t, sla }) => (
                    <IncidentRow key={`${t.protocol}-${t.assignmentId ?? 'x'}`} t={t} sla={sla} nowMs={nowMs} tipo={tipoByProtocol.get(t.protocol) ?? null} recurrence={recurrenceByApCode.get((t.apCode ?? '').trim())} progress={signalProgress.get(t.protocol) ?? null} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-2 text-center text-[11px] text-emerald-300/70">
                      Nenhuma vencida ou perto de vencer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {okRows.length > 0 ? (
              <>
                <div className="mt-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-[#5a6685]">
                  No prazo · {okRows.length}
                  {okScroll ? ' · rolando' : ''}
                </div>
                <div className={okScroll ? 'relative max-h-[300px] overflow-hidden' : ''}>
                  <div
                    className={okScroll ? 'slaa-marquee' : ''}
                    style={okScroll ? { animationDuration: `${Math.max(14, okRows.length * 2.4)}s` } : undefined}
                  >
                    <table className="w-full table-fixed text-[13px]">
                      <MonColgroup />
                      <tbody>
                        {okRows.map(({ t, sla }) => (
                          <IncidentRow key={`${t.protocol}-${t.assignmentId ?? 'x'}`} t={t} sla={sla} nowMs={nowMs} tipo={tipoByProtocol.get(t.protocol) ?? null} recurrence={recurrenceByApCode.get((t.apCode ?? '').trim())} progress={signalProgress.get(t.protocol) ?? null} />
                        ))}
                      </tbody>
                    </table>
                    {okScroll ? (
                      <table className="w-full table-fixed text-[13px]" aria-hidden>
                        <MonColgroup />
                        <tbody>
                          {okRows.map(({ t, sla }) => (
                            <IncidentRow key={`dup-${t.protocol}-${t.assignmentId ?? 'x'}`} t={t} sla={sla} nowMs={nowMs} tipo={tipoByProtocol.get(t.protocol) ?? null} recurrence={recurrenceByApCode.get((t.apCode ?? '').trim())} progress={signalProgress.get(t.protocol) ?? null} />
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Panel>

      <div className="mt-3.5 grid grid-cols-[1.15fr_1fr] gap-3.5">
        <Panel
          title="Sinal — possível problema ainda não aberto"
          extra={
            <span className="font-mono text-[10.5px] text-[#5a6685]">fonte: ONU × massivas abertas</span>
          }
        >
          {!onuQuery.data ? (
            <p className="py-4 text-center text-xs text-[#5a6685]">
              Monitoramento de sinal não configurado ou sem dados no momento.
            </p>
          ) : sinalRows.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#5a6685]">
              Nenhuma OLT com queda relevante no momento.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[#5a6685]">
                  <th className="pb-2">OLT</th>
                  <th className="pb-2">Degradados</th>
                  <th className="pb-2">Offline</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sinalRows.map((r) => (
                  <tr key={r.olt} className="border-t border-[#253150]/50">
                    <td className="py-2.5">{r.olt}</td>
                    <td className="py-2.5">{r.degraded}</td>
                    <td className="py-2.5">{r.offline}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 font-mono text-[11.5px] font-bold',
                          r.hasOpenMassiva ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300',
                        )}
                      >
                        {r.hasOpenMassiva ? 'massiva já aberta' : 'sem massiva aberta'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {rotIndex === 0 ? (
          <Panel
            title="Aberturas por hora — hoje"
            extra={
              <span className="flex items-center gap-2 font-mono text-[10px] text-[#5a6685]">
                <span className="flex gap-1">
                  <span className="h-1 w-3 rounded-full bg-[#8593b8]" />
                  <span className="h-1 w-3 rounded-full bg-[#34415f]" />
                </span>
                auto · 10s
              </span>
            }
          >
            <div className="flex h-full flex-col justify-end gap-2 pb-1">
              <div className="flex items-end gap-2" style={{ height: 120 }}>
                {hourBuckets.bars.map((b) => (
                  <div key={b.hour} className="flex h-full flex-1 flex-col items-center justify-end">
                    {b.count > 0 ? (
                      <span
                        className={cn(
                          'mb-1 font-mono text-[11px] font-bold',
                          b.isPeak ? 'text-amber-300' : b.isNow ? 'text-teal-300' : 'text-[#8593b8]',
                        )}
                      >
                        {b.count}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'w-full rounded-t-[4px]',
                        b.isPeak ? 'bg-amber-400' : b.isNow ? 'bg-teal-400' : 'bg-[#1a2540]',
                      )}
                      style={{ height: `${Math.max(4, b.pct)}%` }}
                    />
                    <span className="mt-1.5 font-mono text-[10.5px] text-[#5a6685]">{formatHourLabel(b.hour)}</span>
                  </div>
                ))}
              </div>
              {hourBuckets.peakCount > 0 ? (
                <p className="text-center text-[12px] text-amber-400">
                  Pico às {formatHourLabel(hourBuckets.peakHour)} — {hourBuckets.peakCount} aberturas na hora
                </p>
              ) : (
                <p className="text-center text-[12px] text-[#5a6685]">Sem aberturas registradas hoje.</p>
              )}
            </div>
          </Panel>
        ) : (
          <Panel
            title="Recorrência hoje"
            extra={
              <span className="flex items-center gap-2 font-mono text-[10px] text-[#5a6685]">
                <span className="flex gap-1">
                  <span className="h-1 w-3 rounded-full bg-[#34415f]" />
                  <span className="h-1 w-3 rounded-full bg-[#8593b8]" />
                </span>
                auto · 10s
              </span>
            }
          >
            {recurrenceToday.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 py-6 text-center">
                <span className="text-2xl">✅</span>
                <p className="text-[13px] text-[#5a6685]">Nenhum ponto de acesso recorrente hoje.</p>
              </div>
            ) : (
              <div className="flex h-full flex-col justify-center divide-y divide-[#253150]/50">
                {recurrenceToday.map((r) => (
                  <div key={r.code} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="min-w-0 truncate">
                      {r.title.trim() !== '' ? r.title : r.code}
                      <span className="ml-1.5 font-mono text-[11px] text-[#5a6685]">{r.code}</span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[12px] font-bold',
                        r.count >= 3 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300',
                      )}
                    >
                      {r.count}× hoje
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  )
}
