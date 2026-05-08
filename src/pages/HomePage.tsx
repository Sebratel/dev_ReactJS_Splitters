import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { StatCard } from '@/shared/ui/cards/StatCard'
import {
  Network,
  Users,
  ArrowUpRight,
  Zap,
  Server,
  RadioTower,
  Sparkles,
} from 'lucide-react'
import { useNetworkStats } from '@/features/dashboard/hooks/useNetworkStats'
import { DashboardConnectionMonitor } from '@/features/dashboard/ui/DashboardConnectionMonitor'
import { DashboardQuickLinks } from '@/features/dashboard/ui/DashboardQuickLinks'
import {
  buildDashboardStatusLine,
  formatRefreshChipShort,
  interpretTrendDelta,
} from '@/features/dashboard/lib/dashboardNarrative'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import { DashboardAccessRequestSection } from '@/features/access/ui/DashboardAccessRequestSection'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import type { MassivaStatus } from '@/features/massiva/model/massivaTicket'
import { cn } from '@/shared/lib/utils'
import { resolveIsaHeroImageSrc } from '@/shared/lib/accessRequestFabImage'
import { useFabPhotoDecodedGate } from '@/shared/hooks/useFabPhotoDecodedGate'

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
  const reduceMotion = useReducedMotion()
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const accessUid = useAccessAuthStore((s) => s.user?.uid)
  const showAccessFold = !isAdmin && Boolean(accessUid)

  const { data: networkStats, isLoading: isLoadingStats, dataUpdatedAt } = useNetworkStats()
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

  const networkCapacityPercent = useMemo(() => {
    const cap = networkStats?.totalPortCapacity ?? 0
    const occ = networkStats?.onlineClients ?? 0
    if (cap <= 0 || isLoadingStats) return null
    return Number(((occ / cap) * 100).toFixed(2))
  }, [networkStats?.onlineClients, networkStats?.totalPortCapacity, isLoadingStats])

  const statusSummaryLine = useMemo(
    () =>
      buildDashboardStatusLine({
        isLoadingStats,
        massivaKpisPending,
        openMassivas: openMassivasCount,
        affectedClients: totalAffectedInOpenMassivas,
        networkCapacityPercent,
      }),
    [
      isLoadingStats,
      massivaKpisPending,
      openMassivasCount,
      totalAffectedInOpenMassivas,
      networkCapacityPercent,
    ],
  )

  const refreshShort = formatRefreshChipShort(dataUpdatedAt)

  const isaFabImageSrc = useMemo(() => resolveIsaHeroImageSrc(), [])
  const [isaHeroImgBroken, setIsaHeroImgBroken] = useState(false)
  const showIsaHeroPhoto = Boolean(isaFabImageSrc && !isaHeroImgBroken)
  const {
    fabImageDecoded: isaHeroPhotoReady,
    onFabPhotoLoad: onIsaHeroPhotoLoad,
    onFabPhotoError: onIsaHeroPhotoError,
  } = useFabPhotoDecodedGate(showIsaHeroPhoto, isaFabImageSrc)

  const { incidentStats, networkStatsCards } = useMemo(() => {
    const incident = [
      {
        label: 'Massivas abertas',
        value: massivaKpisPending ? '---' : openMassivasCount.toLocaleString('pt-BR'),
        icon: Zap,
        className: 'border-l-[3px] border-l-amber-800/45',
        trend: trendVsLastCapture(massivaTrendsReady?.massivaOpenPct),
        description: interpretTrendDelta('massivaOpen', massivaTrendsReady?.massivaOpenPct),
      },
      {
        label: 'Clientes afetados (abertas)',
        value: massivaKpisPending
          ? '---'
          : totalAffectedInOpenMassivas.toLocaleString('pt-BR'),
        icon: Server,
        className: 'border-l-[3px] border-l-orange-950/40',
        trend: trendVsLastCapture(massivaTrendsReady?.massivaAffectedOpenPct),
        description: interpretTrendDelta(
          'massivaAffected',
          massivaTrendsReady?.massivaAffectedOpenPct,
        ),
      },
    ] as const

    const network = [
      {
        label: 'Portas ocupadas',
        value: isLoadingStats ? '---' : (networkStats?.onlineClients || 0).toLocaleString('pt-BR'),
        icon: Users,
        className: 'border-l-[3px] border-l-stone-600/50',
        trend: trendVsLastCapture(pgTrends?.occupiedPortsPct),
        description: interpretTrendDelta('occupiedPorts', pgTrends?.occupiedPortsPct),
      },
      {
        label: 'Splitters no catálogo',
        value: isLoadingStats ? '---' : networkStats?.activeSplitters.toLocaleString('pt-BR') || '0',
        icon: Network,
        className: 'border-l-[3px] border-l-rose-900/35',
        trend: trendVsLastCapture(pgTrends?.activeSplittersPct),
        description: interpretTrendDelta('activeSplitters', pgTrends?.activeSplittersPct),
      },
      {
        label: 'OLTs',
        value: isLoadingStats ? '---' : (networkStats?.oltCount ?? 0).toLocaleString('pt-BR'),
        icon: RadioTower,
        className: 'border-l-[3px] border-l-slate-700/50',
        trend: trendVsLastCapture(pgTrends?.oltCountPct),
        description: interpretTrendDelta('oltCount', pgTrends?.oltCountPct),
      },
    ] as const

    return { incidentStats: incident, networkStatsCards: network }
  }, [
    isLoadingStats,
    networkStats,
    massivaKpisPending,
    openMassivasCount,
    totalAffectedInOpenMassivas,
    pgTrends,
    massivaTrendsReady,
  ])

  const fadeUp = reduceMotion
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } }

  return (
    <>
    <div className="mx-auto max-w-[1600px] min-w-0 space-y-4 md:space-y-5 rounded-[28px] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,176,0,0.06),transparent_52%)] px-1 pb-1 pt-0.5 sm:px-2">
      <motion.section
        className="relative overflow-hidden rounded-3xl border border-stone-200/70 bg-gradient-to-br from-white via-surface-container-lowest to-primary/[0.04] shadow-[0_8px_40px_-16px_rgba(15,23,42,0.12)] ring-1 ring-white/60"
        aria-labelledby="dashboard-hero-heading"
        aria-label={statusSummaryLine}
        {...fadeUp}
        transition={{ duration: 0.35 }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.8' fill='%23a8a29e' fill-opacity='0.22'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(255,176,0,0.07),transparent_52%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

        <div className="relative grid gap-4 p-4 sm:gap-5 sm:p-5 md:p-6 lg:grid-cols-2 lg:items-stretch lg:gap-6 xl:gap-8">
          <div className="flex min-w-0 flex-col justify-center gap-1 lg:pr-1">
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mb-3 inline-flex w-fit items-center rounded-full border border-primary/25 bg-primary/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary shadow-sm ring-1 ring-primary/10 backdrop-blur-md sm:mb-4 sm:px-3.5"
            >
              Centro operacional
            </motion.span>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.06 }}
              className="relative grid w-fit max-w-3xl grid-cols-[auto_auto] items-center gap-x-2 gap-y-1 sm:gap-x-2.5 sm:gap-y-2 lg:gap-x-2"
            >
              <h1
                id="dashboard-hero-heading"
                className="relative z-[1] min-w-0 text-[clamp(1rem,4.2vw,1.85rem)] font-semibold leading-[1.12] tracking-tight text-on-surface max-[380px]:overflow-x-auto max-[380px]:[scrollbar-width:none] max-[380px]:[&::-webkit-scrollbar]:hidden sm:text-[clamp(1.2rem,4.2vw,3rem)]"
              >
                <motion.span
                  className="inline-block whitespace-nowrap"
                  initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.42, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  Rede e massivas
                </motion.span>
                <br aria-hidden />
                <motion.span
                  className="relative inline-block whitespace-nowrap font-semibold text-primary"
                  initial={reduceMotion ? false : { opacity: 0, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.2 }}
                >
                  em tempo real
                  {!reduceMotion ? (
                    <motion.span
                      aria-hidden
                      className="absolute -bottom-1 left-0 h-[3px] w-full origin-left rounded-full bg-gradient-to-r from-primary via-primary-container to-primary/30"
                      initial={{ scaleX: 0, opacity: 0.6 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.55, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-primary via-primary-container to-primary/30"
                    />
                  )}
                </motion.span>
              </h1>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 320,
                  damping: 22,
                  delay: reduceMotion ? 0 : 0.04,
                }}
                className="shrink-0 self-center -translate-x-1"
                aria-label="ISA — assistente do centro operacional"
              >
                <span className="relative flex h-[7.25rem] w-[6rem] shrink-0 items-end justify-center overflow-hidden min-[400px]:h-[7.75rem] min-[400px]:w-[6.35rem] sm:h-[10rem] sm:w-[8rem] lg:h-[9.25rem] lg:w-[7.75rem] xl:h-[11rem] xl:w-[9rem]">
                  {showIsaHeroPhoto ? (
                    <>
                      {!isaHeroPhotoReady ? (
                        <Sparkles
                          className="relative z-[1] h-7 w-7 shrink-0 text-primary/60 sm:h-9 sm:w-9 md:h-10 md:w-10"
                          strokeWidth={2}
                          aria-hidden
                        />
                      ) : null}
                      <img
                        src={isaFabImageSrc}
                        alt=""
                        aria-hidden
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        className={cn(
                          'absolute inset-0 size-full object-contain object-bottom transition-opacity duration-200',
                          isaHeroPhotoReady ? 'opacity-100' : 'opacity-0',
                        )}
                        onLoad={onIsaHeroPhotoLoad}
                        onError={() => {
                          setIsaHeroImgBroken(true)
                          onIsaHeroPhotoError()
                        }}
                      />
                    </>
                  ) : (
                    <Sparkles
                      className="relative z-[1] h-7 w-7 shrink-0 text-primary sm:h-9 sm:w-9 md:h-10 md:w-10"
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                </span>
              </motion.div>
            </motion.div>

            {refreshShort ? (
              <p className="mt-3 text-[11px] font-medium tabular-nums text-on-surface-variant sm:mt-5 sm:text-[12px]">{refreshShort}</p>
            ) : null}
          </div>

          <aside className="flex min-h-0 min-w-0 w-full flex-col justify-between gap-3 rounded-2xl border border-white/60 bg-white/55 p-3.5 shadow-inner shadow-stone-900/[0.03] ring-1 ring-stone-200/50 backdrop-blur-md sm:gap-4 sm:p-5 lg:max-w-[35rem] lg:justify-self-end">
            {networkCapacityPercent != null ? (
              <div>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500 sm:text-[11px]">
                    Capacidade da rede
                  </p>
                  <span className="text-3xl font-bold tabular-nums tracking-tight text-stone-900 sm:text-[2rem]">
                    {networkCapacityPercent.toLocaleString('pt-BR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    <span className="text-lg font-semibold text-stone-500">%</span>
                  </span>
                </div>
                <div className="mt-2.5 h-3.5 overflow-hidden rounded-full bg-stone-200/90 p-px ring-1 ring-stone-300/40 sm:h-4">
                  <motion.div
                    className={cn(
                      'h-full rounded-full bg-gradient-to-r shadow-sm',
                      networkCapacityPercent >= 85
                        ? 'from-rose-500 via-orange-400 to-amber-400'
                        : networkCapacityPercent >= 70
                          ? 'from-amber-400 to-amber-500'
                          : 'from-sky-500 to-cyan-400',
                    )}
                    initial={false}
                    animate={{ width: `${Math.min(100, Math.max(0, networkCapacityPercent))}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[12px] leading-relaxed text-stone-500">
                Percentagem de ocupação global aparece quando o servidor envia capacidade total de portas.
              </p>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500 sm:text-[11px]">
                  Equip. por faixa
                </p>
                <span className="text-[11px] text-stone-400">mesmas cores da lista</span>
              </div>
              {(() => {
                const g = equipmentOccupancy.green
                const y = equipmentOccupancy.yellow
                const r = equipmentOccupancy.red
                const sum = g + y + r
                const pct = (n: number) => (sum > 0 ? (n / sum) * 100 : 0)
                return (
                  <div className="space-y-2">
                    <div className="flex h-3.5 overflow-hidden rounded-full ring-1 ring-stone-200/80 sm:h-4">
                      <motion.div
                        className="bg-emerald-500"
                        initial={false}
                        animate={{ width: `${pct(g)}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                        title={`Verde ${g.toLocaleString('pt-BR')}`}
                      />
                      <motion.div
                        className="bg-amber-400"
                        initial={false}
                        animate={{ width: `${pct(y)}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                        title={`Amarelo ${y.toLocaleString('pt-BR')}`}
                      />
                      <motion.div
                        className="bg-rose-500"
                        initial={false}
                        animate={{ width: `${pct(r)}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                        title={`Vermelho ${r.toLocaleString('pt-BR')}`}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <motion.div
                        className="rounded-xl bg-emerald-500/[0.08] px-2 py-2 ring-1 ring-emerald-300/30 sm:py-2.5"
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-800">≤70%</p>
                        <p className="mt-1 text-base font-bold tabular-nums leading-none text-emerald-950">
                          {isLoadingStats ? '—' : g.toLocaleString('pt-BR')}
                        </p>
                      </motion.div>
                      <motion.div
                        className="rounded-xl bg-amber-500/[0.1] px-2 py-2 ring-1 ring-amber-300/35 sm:py-2.5"
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wide text-amber-900">71–99%</p>
                        <p className="mt-1 text-base font-bold tabular-nums leading-none text-amber-950">
                          {isLoadingStats ? '—' : y.toLocaleString('pt-BR')}
                        </p>
                      </motion.div>
                      <motion.div
                        className="rounded-xl bg-rose-500/[0.1] px-2 py-2 ring-1 ring-rose-300/35 sm:py-2.5"
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                      >
                        <p className="text-[9px] font-bold uppercase tracking-wide text-rose-900">100%+</p>
                        <p className="mt-1 text-base font-bold tabular-nums leading-none text-rose-950">
                          {isLoadingStats ? '—' : r.toLocaleString('pt-BR')}
                        </p>
                      </motion.div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </aside>
        </div>
      </motion.section>

      <section className="space-y-3" aria-labelledby="dashboard-kpis-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 sm:text-[11px]">
              Indicadores
            </p>
            <h2
              id="dashboard-kpis-heading"
              className="mt-1 text-lg font-semibold tracking-tight text-stone-900"
            >
              Incidentes · rede · inventário
            </h2>
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-stone-500 sm:text-[12px]">
              Setas = snapshot diário. Hover nos cartões para tendência.
            </p>
          </div>
          <DashboardQuickLinks />
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
          <div className="grid grid-cols-2 gap-3 xl:min-w-0 xl:flex-[2]">
            {incidentStats.map((stat, idx) => (
              <motion.div
                key={`incident-${stat.label}-${idx}`}
                {...fadeUp}
                transition={{ duration: 0.28, delay: reduceMotion ? 0 : idx * 0.04 }}
                className="min-w-0"
              >
                <StatCard compact surface="elevated" {...stat} />
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:min-w-0 xl:flex-[3] xl:border-l xl:border-stone-200/90 xl:pl-4">
            {networkStatsCards.map((stat, idx) => (
              <motion.div
                key={`network-${stat.label}-${idx}`}
                {...fadeUp}
                transition={{ duration: 0.28, delay: reduceMotion ? 0 : 0.08 + idx * 0.04 }}
                className="min-w-0"
              >
                <StatCard compact surface="elevated" {...stat} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5"
        {...fadeUp}
        transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.06 }}
      >
        <div className="min-w-0 lg:col-span-8">
          <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white/90 shadow-[0_12px_48px_-24px_rgba(15,23,42,0.18)] ring-1 ring-white/70 backdrop-blur-sm">
              <header className="flex flex-col gap-2 border-b border-stone-100/90 bg-gradient-to-r from-stone-50/80 to-white p-4 md:flex-row md:items-center md:justify-between md:py-3.5 md:pl-5 md:pr-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 sm:text-[11px]">
                    Fila operacional
                  </p>
                  <h2 className="text-lg font-semibold tracking-tight text-stone-900 md:text-xl">
                    Massivas abertas
                  </h2>
                  <p className="max-w-xl text-[12px] leading-snug text-stone-500 sm:text-[13px]">
                    Estado das APIs no painel à direita.
                  </p>
                </div>
                <Link
                  to="/massiva"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200/90 bg-white text-stone-700 shadow-sm transition-[transform,colors,box-shadow] hover:scale-105 hover:border-amber-300/60 hover:bg-amber-50/50 hover:text-stone-950 hover:shadow-md"
                  aria-label="Abrir módulo de massivas"
                >
                  <ArrowUpRight size={18} strokeWidth={1.75} />
                </Link>
              </header>

              <div className="divide-y divide-stone-100/90 p-1.5 md:p-2">
                {recentMassivas.length > 0 ? (
                  recentMassivas.map((ticket, ti) => (
                    <motion.article
                      key={`${ticket.protocol}-${ticket.assignmentId ?? 'x'}`}
                      initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                      transition={{ duration: 0.22, delay: reduceMotion ? 0 : ti * 0.05 }}
                      className="group rounded-2xl px-3 py-3 transition-[background] hover:bg-amber-50/40 md:px-4"
                    >
                      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex min-w-0 gap-3 sm:gap-3.5">
                          <div
                            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_0_4px_rgba(251,191,36,0.2)]"
                            aria-hidden
                          />
                          <div className="min-w-0 space-y-2">
                            <p className="text-[15px] font-semibold leading-snug text-stone-900 sm:text-base">
                              {ticket.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-stone-600">
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
                              'inline-flex rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                              statusBadgeClasses(ticket.status),
                            )}
                          >
                            {ticket.status.toUpperCase()}
                          </span>
                          <time
                            className="text-[11px] font-medium tabular-nums text-stone-500"
                            dateTime={
                              ticket.openedAt != null ? ticket.openedAt.toISOString() : undefined
                            }
                          >
                            {formatTicketTimestamp(ticket.openedAt)}
                          </time>
                        </div>
                      </div>
                    </motion.article>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center px-4 py-9 text-center">
                    <motion.div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 ring-1 ring-neutral-200/80"
                      animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
                      transition={{ duration: 2.2, repeat: reduceMotion ? 0 : Infinity, repeatDelay: 4 }}
                    >
                      <Zap className="h-5 w-5 text-neutral-400" strokeWidth={1.5} aria-hidden />
                    </motion.div>
                    <p className="mt-3 text-[15px] font-semibold text-stone-800">Nenhuma falha crítica</p>
                    <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-stone-500">
                      Lista atualiza automaticamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
        </div>

        <div className="min-w-0 lg:col-span-4">
          <motion.div
            className="lg:sticky lg:top-4"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.08 }}
          >
            <DashboardConnectionMonitor />
          </motion.div>
        </div>
      </motion.div>

    </div>

    {showAccessFold ? <DashboardAccessRequestSection /> : null}
    </>
  )
}
