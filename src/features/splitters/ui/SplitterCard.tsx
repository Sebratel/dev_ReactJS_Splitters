import { Link } from 'react-router-dom'
import type { Splitter } from '@/features/splitters/model/splitter'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'
import type { SplitterMaintenanceStats } from '@/features/splitters/api/fetchSplitterMaintenanceStatsFromLocalDb'
import { formatOperationalRelativeDate } from '@/features/splitters/lib/formatOperationalDate'
import { Activity, ArrowRight, Building2, Cpu, Siren, Wifi, WifiOff } from 'lucide-react'
import type { OnuSplitterSignalSummary } from '@/features/onu/model/onuSplitterSummary'
import { RX_POWER_DEGRADED_DBM, RX_POWER_CRITICAL_DBM } from '@/features/onu/model/onuDiagnostic'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'
import { OperationalScoreHealthDots } from '@/features/splitters/ui/OperationalScoreHealthDots'
import { OccupancyBar } from '@/features/splitters/ui/OccupancyBar'
import { scoreToneClassName } from '@/features/splitters/ui/operationalScoreVisual'
import { SplitterStatusBadge } from '@/features/splitters/ui/SplitterStatusBadge'
import { getOccupancyVisualTone } from '@/features/splitters/ui/occupancyVisual'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'

type SplitterCardProps = {
  splitter: Splitter
  massivaStats: SplitterMassivaStats
  maintenanceStats: SplitterMaintenanceStats
  operationalScore: SplitterOperationalScore
  trendLabel: string
  onuSignal?: OnuSplitterSignalSummary | null
}

export function SplitterCard({
  splitter,
  massivaStats,
  maintenanceStats,
  operationalScore,
  onuSignal,
}: SplitterCardProps) {
  const reduceMotion = useReducedMotion()
  const to = `/splitters/${encodeURIComponent(splitter.code)}`
  const canOpenMassiva = useAccessAuthStore((state) => state.hasPermission('canOpenMassiva'))
  const isCondominio = splitter.tipoLocal === 'CONDOMÍNIO'
  const usageRatio = splitter.outPorts > 0 ? splitter.busyCount / splitter.outPorts : 0
  const usagePercent = Math.round(Math.min(100, usageRatio * 100))
  const occupancyTone = getOccupancyVisualTone(usagePercent)

  const titleLine = splitter.nomeCondominio || splitter.title || splitter.code

  return (
    <div className="group h-auto animate-in fade-in zoom-in-95 duration-500">
      <article
        className={cn(
          'flex h-auto flex-col rounded-2xl border border-outline-variant bg-white p-4 shadow-sm',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-on-surface/[0.06]',
        )}
      >
        <div className="flex items-start justify-between gap-x-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300 sm:h-11 sm:w-11',
                isCondominio
                  ? 'border-tertiary/20 bg-tertiary/[0.08] text-tertiary'
                  : 'border-primary/20 bg-primary/[0.08] text-primary',
                'group-hover:border-primary/35',
              )}
            >
              {isCondominio ? (
                <Building2 size={22} strokeWidth={1.75} />
              ) : (
                <Cpu size={22} strokeWidth={1.75} />
              )}
            </div>
            <SplitterStatusBadge active={splitter.active} className="shrink-0" />
          </div>

          <div className="ml-auto shrink-0 text-right sm:ml-0">
            <motion.p
              key={`occ-${splitter.code}-${usagePercent}`}
              className={cn(
                'text-2xl font-bold tabular-nums leading-none tracking-tight sm:text-3xl',
                occupancyTone.text,
              )}
              initial={reduceMotion ? false : { opacity: 0.55, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 380, damping: 26, mass: 0.65 }
              }
            >
              {usagePercent}
              <span className="text-lg font-semibold align-top">%</span>
            </motion.p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
              {'Ocupação'}
            </p>
          </div>
        </div>

        {onuSignal && onuSignal.total > 0 ? (
          <div className="mt-2">
            <span
              className={cn(
                'inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                onuSignal.avgRxPower === null
                  ? 'border-slate-200 bg-slate-50 text-slate-500'
                  : onuSignal.avgRxPower <= RX_POWER_CRITICAL_DBM
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : onuSignal.avgRxPower <= RX_POWER_DEGRADED_DBM
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
              title={`${onuSignal.online} online · ${onuSignal.degraded} atenuados · ${onuSignal.offline} offline`}
            >
              <Wifi size={11} strokeWidth={2} />
              {onuSignal.avgRxPower !== null ? `${onuSignal.avgRxPower.toFixed(1)} dBm` : '— dBm'}
              {onuSignal.projectedRxPower != null && onuSignal.avgRxPower !== null ? (() => {
                const delta = Math.round((onuSignal.projectedRxPower - onuSignal.avgRxPower) * 10) / 10
                const deltaClass = delta > 3 ? 'text-rose-600' : delta > 1 ? 'text-amber-600' : 'text-emerald-600'
                return (
                  <span className={cn('font-semibold', deltaClass)} title={`Projetado: ${onuSignal.projectedRxPower.toFixed(1)} dBm · Atenuação extra: ${delta.toFixed(1)} dB`}>
                    △{delta.toFixed(1)}
                  </span>
                )
              })() : null}
              <span className="ml-0.5 flex items-center gap-0.5 font-semibold">
                <span className="text-emerald-600">{onuSignal.online}↑</span>
                {onuSignal.degraded > 0 ? <span className="text-amber-500">{onuSignal.degraded}⚠</span> : null}
                {onuSignal.offline > 0 ? <span className="text-rose-500">{onuSignal.offline}↓</span> : null}
              </span>
            </span>
          </div>
        ) : (
          <div className="mt-2">
            <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <WifiOff size={11} strokeWidth={2} />
              Sem sinal
            </span>
          </div>
        )}

        <div className="mt-1 min-h-0">
          <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-on-surface sm:text-lg">
            {titleLine}
          </h3>
          {(splitter.oltDescription ?? splitter.oltCode) ? (
            <p className="mt-0.5 truncate text-[11px] font-medium text-on-surface-variant/60">
              {splitter.oltDescription ?? splitter.oltCode}
            </p>
          ) : null}

          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-x-2 gap-y-2 sm:gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                  scoreToneClassName(operationalScore.tone),
                )}
                title={`Criticidade ${operationalScore.score}`}
              >
                <Activity size={12} strokeWidth={2} />
                {operationalScore.label}
                <OperationalScoreHealthDots
                  score={operationalScore.score}
                  tone={operationalScore.tone}
                  className="ml-1"
                />
                <span className="sr-only">{`Score ${operationalScore.score}`}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                <Siren size={12} strokeWidth={2} />
                {massivaStats.totalTickets} massivas
              </span>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                <span>{'Uso de portas'}</span>
              </div>
              <OccupancyBar usagePercent={usagePercent} />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-outline-variant/40 bg-surface-container-low/35 p-2 text-xs">
              <div className="min-w-0">
                <p className="font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  Afetados
                </p>
                <p className="mt-0.5 break-words font-semibold text-on-surface">
                  {massivaStats.affectedClientsTotal.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="min-w-0">
                <p className="font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  {'Última massiva'}
                </p>
                <p className="mt-0.5 break-words font-semibold leading-snug text-on-surface">
                  {formatOperationalRelativeDate(massivaStats.latestOpenedAt)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  {'Manutenção'}
                </p>
                <p className="mt-0.5 break-words font-semibold leading-snug text-on-surface">
                  {maintenanceStats.totalMaintenances.toLocaleString('pt-BR')} ocorrências
                </p>
              </div>
              <div className="min-w-0">
                <p className="font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  Abertas
                </p>
                <p
                  className={cn(
                    'mt-0.5 font-semibold',
                    maintenanceStats.openMaintenances > 0 ? 'text-rose-700' : 'text-on-surface',
                  )}
                >
                  {maintenanceStats.openMaintenances.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-outline-variant/40 pt-4 min-[400px]:flex-row min-[400px]:items-end min-[400px]:justify-between min-[400px]:gap-3">
          <div className="min-w-0 shrink">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
              {'Portas em uso'}
            </p>
            <motion.p
              key={`ports-${splitter.code}-${splitter.busyCount}-${splitter.outPorts}`}
              className="mt-1 text-lg font-bold tabular-nums tracking-tight text-on-surface min-[400px]:text-xl"
              initial={reduceMotion ? false : { opacity: 0.6, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.12 }
              }
            >
              <span className="text-on-surface">{splitter.busyCount}</span>
              <span className="mx-1 font-semibold text-on-surface-variant/35">/</span>
              <span className="text-on-surface-variant/80">{splitter.outPorts}</span>
            </motion.p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 min-[400px]:w-auto min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-end">
            {canOpenMassiva ? (
              <Link
                to="/massiva"
                state={{
                  massivaPrefill: {
                    splitterCode: splitter.code,
                    splitterLabel: splitter.title || splitter.code,
                  },
                }}
                className="inline-flex w-full min-w-0 items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 min-[400px]:w-auto min-[400px]:py-2"
                title="Abrir massiva com este splitter pré-selecionado"
              >
                Abrir massiva
              </Link>
            ) : null}
            <Link
              to={to}
              state={{ splittersListHref: '/splitters' }}
              className={cn(
                'inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low/80 px-3 py-2.5',
                'text-xs font-semibold text-on-surface transition-colors duration-300 min-[400px]:w-auto min-[400px]:py-2',
                'group-hover:border-primary/30 group-hover:bg-primary group-hover:text-on-surface',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              )}
            >
              {'Ver detalhes'}
              <ArrowRight
                size={16}
                strokeWidth={2}
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </article>
    </div>
  )
}
