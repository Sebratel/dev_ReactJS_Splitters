import { useMemo } from 'react'
import { StatCard } from '@/shared/ui/cards/StatCard'
import { Network, Users, ArrowUpRight, Zap, Server, RadioTower } from 'lucide-react'
import { useNetworkStats } from '@/features/dashboard/hooks/useNetworkStats'
import { DashboardConnectionMonitor } from '@/features/dashboard/ui/DashboardConnectionMonitor'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { DashboardAccessRequestSection } from '@/features/access/ui/DashboardAccessRequestSection'
import type { MassivaStatus } from '@/features/massiva/model/massivaTicket'
import { cn } from '@/shared/lib/utils'

function formatTicketTimestamp(openedAt: Date | null): string {
  if (openedAt == null) return 'detectado agora'
  try {
    return openedAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'detectado agora'
  }
}

function statusBadgeClasses(status: MassivaStatus): string {
  switch (status) {
    case 'aberta':
      return 'border-amber-200/90 bg-amber-50 text-amber-950'
    case 'encerrada':
      return 'border-neutral-200 bg-neutral-100 text-neutral-700'
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-600'
  }
}

export function HomePage() {
  const { data: networkStats, isLoading: isLoadingStats } = useNetworkStats()
  /** Dashboard é visível a todos: massivas aqui não dependem de `canViewMassiva` (a rota /massivas continua restrita). */
  const { view: massivaView } = useMassivaTickets({ enabled: true })

  const massivaKpisPending =
    massivaView.status === 'loading' ||
    massivaView.status === 'error' ||
    massivaView.status === 'not-configured'

  const tickets = massivaView.status === 'success' ? massivaView.tickets : []
  const openMassivasCount = tickets.filter((t) => t.status === 'aberta').length
  const totalAffectedInOpenMassivas = tickets
    .filter((t) => t.status === 'aberta')
    .reduce((acc, t) => acc + t.affectedClients, 0)

  const recentMassivas = tickets.filter((t) => t.status === 'aberta').slice(0, 3)

  const equipmentOccupancy = networkStats?.equipmentOccupancy ?? {
    green: 0,
    yellow: 0,
    red: 0,
  }

  /** Só aparece selo quando o BFF envia `trends` (há snapshot de um dia anterior no Postgres). */
  const trendVsLastCapture = (pct: number | null | undefined) => {
    if (pct == null || !Number.isFinite(pct)) return undefined
    return { value: pct, label: 'vs. última captura' }
  }

  const pgTrends = !isLoadingStats && networkStats?.trends != null ? networkStats.trends : null
  const massivaTrendsReady =
    !massivaKpisPending && networkStats?.trends != null ? networkStats.trends : null

  const stats = useMemo(() => {
    const base = [
      {
        label: 'Portas ocupadas',
        value: isLoadingStats ? '---' : (networkStats?.onlineClients || 0).toLocaleString('pt-BR'),
        icon: Users,
        className: 'border-l-[3px] border-l-stone-600/50',
        trend: trendVsLastCapture(pgTrends?.occupiedPortsPct),
      },
      {
        label: 'SPLITTER',
        value: isLoadingStats ? '---' : networkStats?.activeSplitters.toLocaleString('pt-BR') || '0',
        icon: Network,
        className: 'border-l-[3px] border-l-rose-900/35',
        trend: trendVsLastCapture(pgTrends?.activeSplittersPct),
      },
      {
        label: 'OLTs',
        value: isLoadingStats ? '---' : (networkStats?.oltCount ?? 0).toLocaleString('pt-BR'),
        icon: RadioTower,
        className: 'border-l-[3px] border-l-slate-700/50',
        trend: trendVsLastCapture(pgTrends?.oltCountPct),
      },
    ] as const

    return [
      base[0],
      {
        label: 'Massivas abertas',
        value: massivaKpisPending ? '---' : openMassivasCount.toLocaleString('pt-BR'),
        icon: Zap,
        className: 'border-l-[3px] border-l-amber-800/45',
        trend: trendVsLastCapture(massivaTrendsReady?.massivaOpenPct),
      },
      base[1],
      base[2],
      {
        label: 'Clientes afetados (abertas)',
        value: massivaKpisPending
          ? '---'
          : totalAffectedInOpenMassivas.toLocaleString('pt-BR'),
        icon: Server,
        className: 'border-l-[3px] border-l-orange-950/40',
        trend: trendVsLastCapture(massivaTrendsReady?.massivaAffectedOpenPct),
      },
    ]
  }, [
    isLoadingStats,
    networkStats,
    massivaKpisPending,
    openMassivasCount,
    totalAffectedInOpenMassivas,
    pgTrends,
    massivaTrendsReady,
  ])

  return (
    <>
    <div className="mx-auto max-w-[1600px] min-w-0 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero — contexto estratégico + KPI integrado */}
      <section
        className="relative overflow-hidden rounded-2xl border border-neutral-200/90 bg-gradient-to-br from-neutral-50 via-white to-amber-50/[0.35] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        aria-labelledby="dashboard-hero-heading"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(120,53,15,0.055),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-neutral-200/80 to-transparent" />

        <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[1fr_min(22rem,38%)] lg:items-stretch lg:gap-8 xl:gap-10">
          <div className="flex min-w-0 flex-col justify-center lg:py-1">
            <span className="mb-3 inline-flex w-fit items-center rounded-lg border border-amber-900/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-950/80 shadow-sm ring-1 ring-neutral-950/[0.04] backdrop-blur-sm">
              Centro operacional de splitters
            </span>
            <h1
              id="dashboard-hero-heading"
              className="max-w-3xl text-balance text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-neutral-950 md:text-3xl lg:text-[1.85rem] xl:text-4xl xl:leading-[1.12]"
            >
              Operação de rede com foco em{' '}
              <span className="font-semibold text-primary not-italic">agilidade</span>, contexto e
              respostas rápidas.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 md:text-[0.9375rem]">
              Use o menu lateral para abrir massivas, filtrar por OLTs, status e ruas. Sincronização
              em tempo real com o banco de dados operacional.
            </p>
          </div>

          <aside className="flex min-h-0 flex-col justify-between gap-4 rounded-xl border border-neutral-200/90 bg-white/85 p-5 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.08)] ring-1 ring-neutral-950/[0.03] backdrop-blur-md lg:p-6">
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Visão atual
              </p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-neutral-600">
                Splitters por ocupação — mesma regra dos status{' '}
                <span className="whitespace-nowrap">verde · amarelo · vermelho</span> da lista.
              </p>
              <dl className="mt-4 space-y-0">
                <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 first:pt-0">
                  <dt className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-neutral-800">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
                      aria-hidden
                    />
                    <span className="truncate">
                      Verde <span className="font-normal text-neutral-500">(até 70%)</span>
                    </span>
                  </dt>
                  <dd className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950">
                    {isLoadingStats ? '—' : equipmentOccupancy.green.toLocaleString('pt-BR')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5">
                  <dt className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-neutral-800">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]"
                      aria-hidden
                    />
                    <span className="truncate">
                      Amarelo <span className="font-normal text-neutral-500">(71% a 99%)</span>
                    </span>
                  </dt>
                  <dd className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950">
                    {isLoadingStats ? '—' : equipmentOccupancy.yellow.toLocaleString('pt-BR')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0">
                  <dt className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-neutral-800">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.22)]"
                      aria-hidden
                    />
                    <span className="truncate">
                      Vermelho{' '}
                      <span className="font-normal text-neutral-500">(100% ou excedente)</span>
                    </span>
                  </dt>
                  <dd className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950">
                    {isLoadingStats ? '—' : equipmentOccupancy.red.toLocaleString('pt-BR')}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-neutral-200/90 bg-neutral-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-600">
                Sem filtros
              </span>
              <span className="rounded-lg border border-neutral-200/90 bg-neutral-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-600">
                Busca livre
              </span>
            </div>
          </aside>
        </div>
      </section>

      {/* Indicadores */}
      <section className="space-y-3" aria-labelledby="dashboard-kpis-heading">
        <div className="flex flex-col gap-0.5 px-0.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Indicadores operacionais
            </p>
            <h2
              id="dashboard-kpis-heading"
              className="text-sm font-semibold tracking-tight text-neutral-900"
            >
              Panorama em tempo real
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 xl:gap-4">
          {stats.map((stat, idx) => (
            <StatCard key={`${stat.label}-${idx}`} {...stat} />
          ))}
        </div>
      </section>

      {/* Conteúdo principal: ocorrências + módulos laterais */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 space-y-0 lg:col-span-8">
          <div className="rounded-2xl border border-neutral-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <header className="flex flex-col gap-4 border-b border-neutral-100 p-5 md:flex-row md:items-start md:justify-between md:p-6">
                <div className="min-w-0 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    Monitoramento
                  </p>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-neutral-950 md:text-xl">
                        Ocorrências de rede
                      </h2>
                      <p className="mt-1 max-w-xl text-[13px] leading-snug text-neutral-600">
                        Status em tempo real das falhas massivas ativos.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/90 bg-neutral-50 text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-white hover:text-neutral-950"
                  aria-label="Expandir ou abrir ocorrências"
                >
                  <ArrowUpRight size={18} strokeWidth={1.75} />
                </button>
              </header>

              <div className="divide-y divide-neutral-100 p-2 md:p-3">
                {recentMassivas.length > 0 ? (
                  recentMassivas.map((ticket) => (
                    <article
                      key={`${ticket.protocol}-${ticket.assignmentId ?? 'x'}`}
                      className="group rounded-xl px-3 py-3 transition-colors hover:bg-neutral-50/80 md:px-4 md:py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex min-w-0 gap-3.5 sm:gap-4">
                          <div
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500/90 ring-4 ring-amber-500/15"
                            aria-hidden
                          />
                          <div className="min-w-0 space-y-2">
                            <p className="text-[15px] font-semibold leading-snug text-neutral-950">
                              {ticket.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600">
                              <span className="font-mono tabular-nums text-neutral-700">
                                <span className="font-sans font-medium text-neutral-500">Protocolo </span>
                                {ticket.protocol > 0 ? ticket.protocol : '—'}
                              </span>
                              <span className="hidden text-neutral-300 sm:inline" aria-hidden>
                                ·
                              </span>
                              <span>
                                <span className="font-medium text-neutral-500">Clientes </span>
                                <span className="font-semibold tabular-nums text-neutral-800">
                                  {ticket.affectedClients}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end sm:pl-2">
                          <span
                            className={cn(
                              'inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                              statusBadgeClasses(ticket.status),
                            )}
                          >
                            {ticket.status.toUpperCase()}
                          </span>
                          <time
                            className="text-[10px] font-medium tabular-nums text-neutral-500"
                            dateTime={
                              ticket.openedAt != null ? ticket.openedAt.toISOString() : undefined
                            }
                          >
                            {formatTicketTimestamp(ticket.openedAt)}
                          </time>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 ring-1 ring-neutral-200/80">
                      <Zap className="h-6 w-6 text-neutral-400" strokeWidth={1.5} aria-hidden />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-neutral-800">Nenhuma falha crítica</p>
                    <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-neutral-500">
                      Não há ocorrências em destaque no momento. A lista atualizará quando novos eventos
                      forem registrados.
                    </p>
                  </div>
                )}
              </div>
            </div>
        </div>

        <div className="min-w-0 lg:col-span-4">
          <DashboardConnectionMonitor />
        </div>
      </div>
    </div>
    <DashboardAccessRequestSection />
    </>
  )
}
