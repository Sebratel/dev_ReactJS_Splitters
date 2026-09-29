import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MousePointerClick,
  Radar,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { useUsageAnalytics } from '@/features/analytics/hooks/useUsageAnalytics'
import {
  USAGE_MODULE_LABEL,
  type UsageModuleKey,
} from '@/features/analytics/lib/resolveModuleFromPath'
import { downloadUsageCsv } from '@/features/analytics/lib/exportUsageCsv'
import type { UsageSummary, UsageUserStat } from '@/features/analytics/model/usageSummary'
import { cn } from '@/shared/lib/utils'

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const

const BAR = '#6366f1'
const LINE = '#0ea5e9'

const CARD =
  'rounded-xl bg-surface-container-lowest ring-1 ring-neutral-200/70 dark:ring-white/10'

function moduleLabel(key: string): string {
  return USAGE_MODULE_LABEL[key as UsageModuleKey] ?? key
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return sec > 0 ? `${min}min ${sec}s` : `${min}min`
}

function formatDurationLong(ms: number): string {
  if (!ms || ms <= 0) return '—'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 1) return `${Math.round(ms / 1000)}s`
  if (totalMin < 60) return `${totalMin}min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

/** Rótulos amigáveis das ações instrumentadas; desconhecidas caem no humanizador. */
const ACTION_LABEL: Record<string, string> = {
  massiva_abrir: 'Abrir massiva',
  massiva_encerrar: 'Encerrar massiva',
  massiva_cancelar: 'Cancelar massiva',
  massiva_hsm_enviar: 'Disparar HSM',
  redistribuicao_exportar: 'Exportar redistribuição',
  splitters_buscar: 'Buscar splitter',
  cliente_abrir: 'Abrir cliente',
}

function actionLabel(action: string): string {
  const known = ACTION_LABEL[action]
  if (known) return known
  const humanized = action.replace(/[_-]+/g, ' ').trim()
  return humanized.charAt(0).toUpperCase() + humanized.slice(1)
}

function firstName(name: string, email: string): string {
  const n = (name || '').trim()
  if (n !== '') return n
  return email.includes('@') ? email.split('@')[0] : email
}

function KpiCard({
  label,
  value,
  Icon,
}: {
  label: string
  value: string
  Icon: typeof Users
}) {
  return (
    <div className={cn(CARD, 'p-4')}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        <Icon size={14} className="text-primary" /> {label}
      </p>
      <p className="mt-1.5 font-mono text-3xl font-bold tabular-nums text-on-surface">{value}</p>
    </div>
  )
}

function ActiveUsersCard({ summary }: { summary: UsageSummary }) {
  const dau = summary.activeUsers?.dau ?? 0
  const wau = summary.activeUsers?.wau ?? 0
  const mau = summary.activeUsers?.mau ?? 0
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0
  const cells: { label: string; value: number; hint: string }[] = [
    { label: 'DAU', value: dau, hint: 'ativos nas últimas 24h' },
    { label: 'WAU', value: wau, hint: 'ativos nos últimos 7 dias' },
    { label: 'MAU', value: mau, hint: 'ativos nos últimos 30 dias' },
  ]
  return (
    <div className={cn(CARD, 'p-4')}>
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-on-surface">
        <Users size={15} className="text-primary" /> Usuários ativos da plataforma
      </p>
      <div className="grid grid-cols-3 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg bg-surface-container-low/60 p-3 text-center" title={c.hint}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{c.label}</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-on-surface">
              {c.value.toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        Aderência (DAU/MAU):{' '}
        <span className="font-mono font-bold text-on-surface">{stickiness}%</span> — quanto maior, mais
        recorrente é o uso.
      </p>
    </div>
  )
}

function ModuleRanking({ summary }: { summary: UsageSummary }) {
  const data = useMemo(
    () =>
      summary.byModule
        // Dashboard é a tela inicial (rota '/'): todo login cai nela, então o acesso
        // sempre lidera e não diz nada sobre preferência de uso. Omitido do ranking para
        // não distorcer a comparação. A coleta continua (conta em usuários ativos/sessões).
        .filter((m) => m.module !== 'dashboard')
        .map((m) => ({
          ...m,
          label: moduleLabel(m.module),
        })),
    [summary.byModule],
  )
  const maxEvents = data.length > 0 ? Math.max(...data.map((d) => d.events)) : 0
  return (
    <div className={cn(CARD, 'p-4')}>
      <p className="text-sm font-bold text-on-surface">Módulos mais acessados</p>
      <p className="mb-3 text-xs text-on-surface-variant">
        Dashboard omitido — é a tela inicial, todos passam por ela.
      </p>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">Sem acessos no período.</p>
      ) : (
        <div style={{ height: Math.max(160, data.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-white/10" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" className="text-on-surface-variant" />
              <YAxis
                type="category"
                dataKey="label"
                width={130}
                tick={{ fontSize: 12 }}
                stroke="currentColor"
                className="text-on-surface-variant"
              />
              <Tooltip
                cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                formatter={(value, _n, item) => {
                  const v = Number(value)
                  const p = (item as { payload?: { users?: number; avgDurationMs?: number } })?.payload
                  return [
                    `${v.toLocaleString('pt-BR')} acessos · ${p?.users ?? 0} usuários · ${formatDuration(p?.avgDurationMs ?? 0)} médio`,
                    'Uso',
                  ]
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="events" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((d) => (
                  <Cell
                    key={d.module}
                    fill={BAR}
                    fillOpacity={maxEvents > 0 ? 0.45 + 0.55 * (d.events / maxEvents) : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function TimeByModule({ summary }: { summary: UsageSummary }) {
  const data = useMemo(
    () =>
      [...summary.byModule]
        // Dashboard omitido (tela inicial) — mesma razão do ranking de acessos.
        .filter((m) => m.module !== 'dashboard' && m.totalDurationMs > 0)
        .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
        .slice(0, 8),
    [summary.byModule],
  )
  const max = data.length > 0 ? data[0].totalDurationMs : 0
  return (
    <div className={cn(CARD, 'p-4')}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-on-surface">
        <Clock size={15} className="text-primary" /> Onde passam mais tempo
      </p>
      <p className="mb-3 text-xs text-on-surface-variant">
        Tempo total acumulado por módulo no período. Dashboard omitido (tela inicial).
      </p>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-on-surface-variant">Sem tempo medido no período.</p>
      ) : (
        <div className="space-y-2.5">
          {data.map((m) => (
            <div key={m.module}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-on-surface">{moduleLabel(m.module)}</span>
                <span className="shrink-0 font-mono tabular-nums text-on-surface-variant">
                  {formatDurationLong(m.totalDurationMs)}
                  <span className="ml-1.5 text-on-surface-variant/50">({formatDuration(m.avgDurationMs)}/acesso)</span>
                </span>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-surface-container-low">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${max > 0 ? Math.max(3, (m.totalDurationMs / max) * 100) : 0}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 'yyyy-mm-dd' → 'dd/mm' (pt-BR). Vazio/curto retorna como veio. */
function formatDayDDMM(day: string): string {
  if (!day || day.length < 10) return day || ''
  const [, m, d] = day.split('-')
  return d && m ? `${d}/${m}` : day
}

function DailyTrend({ summary }: { summary: UsageSummary }) {
  const data = useMemo(
    () =>
      summary.byDay.map((d) => ({
        ...d,
        label: formatDayDDMM(d.day),
      })),
    [summary.byDay],
  )
  return (
    <div className={cn(CARD, 'p-4')}>
      <p className="mb-3 text-sm font-bold text-on-surface">Acessos por dia</p>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">Sem acessos no período.</p>
      ) : (
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-neutral-200 dark:text-white/10" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-on-surface-variant" />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-on-surface-variant" allowDecimals={false} />
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} acessos`, 'Dia']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="events" stroke={LINE} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function HourlyHeat({ summary }: { summary: UsageSummary }) {
  const byHour = useMemo(() => {
    const map = new Map(summary.byHour.map((h) => [h.hour, h.events]))
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, events: map.get(h) ?? 0 }))
    const max = Math.max(1, ...arr.map((a) => a.events))
    return { arr, max }
  }, [summary.byHour])
  return (
    <div className={cn(CARD, 'p-4')}>
      <p className="mb-3 text-sm font-bold text-on-surface">Horários de pico</p>
      <div className="flex items-end gap-[3px]" style={{ height: 90 }}>
        {byHour.arr.map((h) => (
          <div key={h.hour} className="flex h-full flex-1 flex-col items-center justify-end" title={`${h.hour}h — ${h.events} acessos`}>
            <span
              className="w-full rounded-t bg-primary"
              style={{ height: `${Math.max(3, (h.events / byHour.max) * 100)}%`, opacity: 0.35 + 0.65 * (h.events / byHour.max) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-on-surface-variant/60">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </div>
  )
}

const USERS_PAGE_SIZE = 10

type UserSortKey = 'name' | 'events' | 'modulesUsed' | 'topModule' | 'lastSeen'

function SortTh({
  label,
  columnKey,
  activeKey,
  dir,
  align = 'left',
  onSort,
}: {
  label: string
  columnKey: UserSortKey
  activeKey: UserSortKey
  dir: 'asc' | 'desc'
  align?: 'left' | 'right'
  onSort: (key: UserSortKey) => void
}) {
  const active = activeKey === columnKey
  return (
    <th className={cn('px-4 py-2', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          'inline-flex items-center gap-1 uppercase transition hover:text-on-surface',
          align === 'right' ? 'flex-row-reverse' : '',
          active ? 'text-on-surface' : 'text-on-surface-variant/70',
        )}
        title="Ordenar por esta coluna"
      >
        {label}
        {active ? (
          dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-30" />
        )}
      </button>
    </th>
  )
}

function TopUsers({ summary }: { summary: UsageSummary }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<UserSortKey>('events')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const topModuleByUser = useMemo(() => {
    const best = new Map<string, { module: string; events: number }>()
    for (const r of summary.byUserModule) {
      // Dashboard é a tela inicial (todos passam) — não conta como "mais usa", senão
      // esconde a preferência real de quem navega pouco. Mesma razão dos rankings.
      if (r.module === 'dashboard') continue
      const cur = best.get(r.email)
      if (!cur || r.events > cur.events) best.set(r.email, { module: r.module, events: r.events })
    }
    return best
  }, [summary.byUserModule])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q === '') return summary.byUser
    return summary.byUser.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q),
    )
  }, [summary.byUser, search])

  const sorted = useMemo(() => {
    const topLabel = (email: string) => {
      const t = topModuleByUser.get(email)
      return t ? moduleLabel(t.module) : ''
    }
    const val = (u: UsageUserStat): string | number => {
      switch (sortKey) {
        case 'name':
          return (u.name || u.email).toLowerCase()
        case 'events':
          return u.events
        case 'modulesUsed':
          return u.modulesUsed
        case 'topModule':
          return topLabel(u.email).toLowerCase()
        case 'lastSeen':
          return u.lastSeen ? new Date(u.lastSeen).getTime() || 0 : 0
      }
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'pt-BR') * dir
    })
  }, [filtered, sortKey, sortDir, topModuleByUser])

  // Mantém a página válida quando o filtro/dado encolhe.
  const pageCount = Math.max(1, Math.ceil(sorted.length / USERS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const toggleSort = (key: UserSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Texto começa A→Z; números/data começam do maior (mais útil no topo).
      setSortDir(key === 'name' || key === 'topModule' ? 'asc' : 'desc')
    }
    setPage(0)
  }

  const pageRows = sorted.slice(safePage * USERS_PAGE_SIZE, safePage * USERS_PAGE_SIZE + USERS_PAGE_SIZE)
  const firstShown = sorted.length === 0 ? 0 : safePage * USERS_PAGE_SIZE + 1
  const lastShown = Math.min(sorted.length, safePage * USERS_PAGE_SIZE + USERS_PAGE_SIZE)

  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/70 p-4 dark:border-white/10">
        <p className="text-sm font-bold text-on-surface">
          Quem mais usa a plataforma
          <span className="ml-2 text-xs font-normal text-on-surface-variant">
            {filtered.length.toLocaleString('pt-BR')}
            {search.trim() !== '' ? ` de ${summary.byUser.length.toLocaleString('pt-BR')}` : ''} usuários
          </span>
        </p>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar por nome ou e-mail…"
            className="h-8 w-56 rounded-lg bg-surface-container-low pl-8 pr-2.5 text-xs text-on-surface ring-1 ring-neutral-200/70 focus:outline-none focus:ring-primary dark:ring-white/10"
            aria-label="Buscar usuário"
          />
        </div>
      </div>
      {summary.byUser.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">Sem acessos no período.</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-on-surface-variant">Nenhum usuário corresponde à busca.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-bold tracking-wide">
                  <SortTh label="Usuário" columnKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Acessos" columnKey="events" activeKey={sortKey} dir={sortDir} align="right" onSort={toggleSort} />
                  <SortTh label="Módulos" columnKey="modulesUsed" activeKey={sortKey} dir={sortDir} align="right" onSort={toggleSort} />
                  <SortTh label="Mais usa" columnKey="topModule" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortTh label="Último acesso" columnKey="lastSeen" activeKey={sortKey} dir={sortDir} align="right" onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u) => {
                  const top = topModuleByUser.get(u.email)
                  return (
                    <tr key={u.email} className="border-t border-neutral-200/60 dark:border-white/5">
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-on-surface">{firstName(u.name, u.email)}</span>
                        <span className="ml-1.5 font-mono text-[11px] text-on-surface-variant/60">{u.email}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-on-surface">{u.events.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-on-surface-variant">{u.modulesUsed}</td>
                      <td className="px-4 py-2.5">
                        {top ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {moduleLabel(top.module)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-on-surface-variant">{formatRelative(u.lastSeen)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-neutral-200/60 px-4 py-2.5 dark:border-white/5">
              <span className="text-xs text-on-surface-variant">
                {firstShown}–{lastShown} de {filtered.length.toLocaleString('pt-BR')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-1 text-xs font-semibold tabular-nums text-on-surface">
                  {safePage + 1}/{pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="inline-flex size-7 items-center justify-center rounded-md text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40 dark:ring-white/10"
                  aria-label="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function ActionsPanel({ summary }: { summary: UsageSummary }) {
  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <p className="flex items-center gap-1.5 border-b border-neutral-200/70 p-4 text-sm font-bold text-on-surface dark:border-white/10">
        <MousePointerClick size={15} className="text-primary" /> Ações mais usadas
      </p>
      {summary.byAction.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-on-surface-variant">
          Ainda sem ações registradas no período. Conforme os recursos instrumentados forem usados,
          eles aparecem aqui (ex.: abrir massiva, buscar splitter).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">
                <th className="px-4 py-2">Ação</th>
                <th className="px-4 py-2">Módulo</th>
                <th className="px-4 py-2 text-right">Vezes</th>
                <th className="px-4 py-2 text-right">Usuários</th>
              </tr>
            </thead>
            <tbody>
              {summary.byAction.map((a) => (
                <tr key={`${a.module}:${a.action}`} className="border-t border-neutral-200/60 dark:border-white/5">
                  <td className="px-4 py-2.5 font-semibold text-on-surface">{actionLabel(a.action)}</td>
                  <td className="px-4 py-2.5 text-on-surface-variant">{moduleLabel(a.module)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-on-surface">{a.events.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-on-surface-variant">{a.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function UsageRadarScreen() {
  const [days, setDays] = useState<number>(7)
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const isCustom = customStart !== '' && customEnd !== ''
  const query = useMemo(
    () =>
      isCustom
        ? { start: `${customStart}T00:00:00`, end: `${customEnd}T23:59:59`, userEmail: selectedUser }
        : { days, userEmail: selectedUser },
    [isCustom, customStart, customEnd, days, selectedUser],
  )
  const periodLabel = isCustom ? `${customStart}_a_${customEnd}` : `${days}d`

  const { data, isLoading, isError, error, refetch, isFetching } = useUsageAnalytics(query)

  // Anos disponíveis para o atalho "por ano" (o projeto começou em 2025).
  const years = useMemo(() => {
    const current = new Date().getFullYear()
    const out: number[] = []
    for (let y = current; y >= 2025; y -= 1) out.push(y)
    return out
  }, [])
  // Ano selecionado = intervalo custom que cobre exatamente um ano inteiro.
  const selectedYear =
    isCustom &&
    customStart.endsWith('-01-01') &&
    customEnd.endsWith('-12-31') &&
    customStart.slice(0, 4) === customEnd.slice(0, 4)
      ? customStart.slice(0, 4)
      : ''

  const applyPreset = (d: number) => {
    setDays(d)
    setCustomStart('')
    setCustomEnd('')
  }
  const applyYear = (year: string) => {
    if (year === '') {
      setCustomStart('')
      setCustomEnd('')
      return
    }
    setCustomStart(`${year}-01-01`)
    setCustomEnd(`${year}-12-31`)
  }

  // Lista de usuários para o seletor — capturada do carregamento SEM filtro,
  // para não sumir quando um usuário estiver selecionado.
  const [userOptions, setUserOptions] = useState<UsageUserStat[]>([])
  useEffect(() => {
    if (selectedUser === null && data) {
      setUserOptions(data.byUser)
    }
  }, [selectedUser, data])

  const inputCls =
    'h-9 rounded-lg bg-surface-container-lowest px-2.5 text-xs font-semibold text-on-surface ring-1 ring-neutral-200/70 focus:outline-none focus:ring-primary dark:ring-white/10'

  return (
    <div className="mx-auto min-w-0 max-w-[1480px] space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-on-surface">
            <Radar size={22} className="text-primary" /> Radar de uso
          </h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Quais módulos são mais acessados e por quem — para priorizar as próximas atualizações.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex rounded-lg bg-surface-container-low p-0.5 ring-1 ring-neutral-200/70 dark:ring-white/10">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => applyPreset(p.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                  !isCustom && days === p.days
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={selectedYear}
            onChange={(e) => applyYear(e.target.value)}
            className={inputCls}
            aria-label="Filtrar por ano"
            title="Ano inteiro"
          >
            <option value="">Ano…</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-lg bg-surface-container-low px-2 py-0.5 ring-1 ring-neutral-200/70 dark:ring-white/10">
            <span className="text-[11px] font-semibold text-on-surface-variant">De</span>
            <input
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 bg-transparent text-xs text-on-surface focus:outline-none"
              aria-label="Data inicial"
            />
            <span className="text-[11px] font-semibold text-on-surface-variant">até</span>
            <input
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 bg-transparent text-xs text-on-surface focus:outline-none"
              aria-label="Data final"
            />
            {isCustom ? (
              <button
                type="button"
                onClick={() => applyPreset(days)}
                className="ml-0.5 rounded px-1 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface"
                title="Limpar intervalo"
              >
                ✕
              </button>
            ) : null}
          </div>
          <select
            value={selectedUser ?? ''}
            onChange={(e) => setSelectedUser(e.target.value === '' ? null : e.target.value)}
            className={inputCls}
            aria-label="Filtrar por colaborador"
            title="Filtrar por colaborador"
          >
            <option value="">Todos os colaboradores</option>
            {userOptions.map((u) => (
              <option key={u.email} value={u.email}>
                {firstName(u.name, u.email)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => data && downloadUsageCsv(data, { period: periodLabel, userEmail: selectedUser })}
            disabled={!data || data.byUserModule.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 dark:ring-white/10"
            title="Exportar CSV (usuário × módulo)"
          >
            <Download size={15} /> CSV
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex size-9 items-center justify-center rounded-lg text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
            aria-label="Atualizar"
            title="Atualizar"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={cn(CARD, 'p-10 text-center text-sm text-on-surface-variant')}>Carregando o radar…</div>
      ) : isError ? (
        <div className={cn(CARD, 'p-8 text-center')}>
          <p className="text-sm font-semibold text-red-600 dark:text-red-300">
            {error instanceof Error ? error.message : 'Falha ao carregar o radar de uso.'}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Se a coleta acabou de ser ativada, ainda pode não haver dados suficientes.
          </p>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard label="Acessos" value={data.totals.events.toLocaleString('pt-BR')} Icon={Activity} />
            <KpiCard label="Usuários ativos" value={data.totals.activeUsers.toLocaleString('pt-BR')} Icon={Users} />
            <KpiCard label="Sessões" value={data.totals.sessions.toLocaleString('pt-BR')} Icon={Clock} />
          </div>

          <ActiveUsersCard summary={data} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ModuleRanking summary={data} />
            <TimeByModule summary={data} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DailyTrend summary={data} />
            <HourlyHeat summary={data} />
          </div>

          <TopUsers summary={data} />
          <ActionsPanel summary={data} />
        </>
      ) : null}
    </div>
  )
}
