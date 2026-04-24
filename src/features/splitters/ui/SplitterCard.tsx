import { Link } from 'react-router-dom'
import type { Splitter } from '@/features/splitters/model/splitter'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'
import { formatOperationalRelativeDate } from '@/features/splitters/lib/formatOperationalDate'
import {
  Activity,
  ArrowRight,
  Building2,
  Cpu,
  MapPin,
  Siren,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { OccupancyBar } from '@/features/splitters/ui/OccupancyBar'
import { SplitterStatusBadge } from '@/features/splitters/ui/SplitterStatusBadge'
import { getOccupancyVisualTone } from '@/features/splitters/ui/occupancyVisual'

type SplitterCardProps = {
  splitter: Splitter
  massivaStats: SplitterMassivaStats
  operationalScore: SplitterOperationalScore
  trendLabel: string
}

function formatTrendLabel(label: string): string {
  if (label === 'Estavel') return 'Est\u00E1vel'
  return label
}

function scoreToneClassName(tone: SplitterOperationalScore['tone']): string {
  switch (tone) {
    case 'critical':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'attention':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }
}

function scoreDotToneClassName(tone: SplitterOperationalScore['tone']): string {
  switch (tone) {
    case 'critical':
      return 'bg-rose-500'
    case 'attention':
      return 'bg-amber-500'
    default:
      return 'bg-emerald-500'
  }
}

function criticalityDotsFromScore(score: number): number {
  const clampedScore = Math.min(100, Math.max(0, score))
  return Math.max(1, Math.ceil(clampedScore / 20))
}

export function SplitterCard({
  splitter,
  massivaStats,
  operationalScore,
  trendLabel,
}: SplitterCardProps) {
  const to = `/splitters/${encodeURIComponent(splitter.code)}`
  const isCondominio = splitter.tipoLocal === 'CONDOM\u00CDNIO'
  const usageRatio = splitter.outPorts > 0 ? splitter.busyCount / splitter.outPorts : 0
  const usagePercent = Math.round(Math.min(100, usageRatio * 100))
  const occupancyTone = getOccupancyVisualTone(usagePercent)
  const filledCriticalityDots = criticalityDotsFromScore(operationalScore.score)

  const titleLine = splitter.nomeCondominio || splitter.title || splitter.code

  return (
    <div className="group h-auto animate-in fade-in zoom-in-95 duration-500">
      <Link
        to={to}
        className={cn(
          'flex h-auto flex-col rounded-2xl border border-outline-variant bg-white p-4 shadow-sm',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-on-surface/[0.06]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300',
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

          <div className="shrink-0 text-right">
            <p
              className={cn(
                'text-3xl font-bold tabular-nums leading-none tracking-tight',
                occupancyTone.text,
              )}
            >
              {usagePercent}
              <span className="text-lg font-semibold align-top">%</span>
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
              {'Ocupa\u00E7\u00E3o'}
            </p>
          </div>
        </div>

        <div className="mt-1 min-h-0">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-on-surface">
            {titleLine}
          </h3>

          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                  scoreToneClassName(operationalScore.tone),
                )}
                title={`Criticidade ${operationalScore.score}`}
              >
                <Activity size={12} strokeWidth={2} />
                {operationalScore.label}
                <span className="ml-1 inline-flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => {
                    const active = index < filledCriticalityDots
                    return (
                      <span
                        key={index}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          active
                            ? scoreDotToneClassName(operationalScore.tone)
                            : 'bg-slate-300',
                        )}
                      />
                    )
                  })}
                </span>
                <span className="sr-only">{`Score ${operationalScore.score}`}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                <Siren size={12} strokeWidth={2} />
                {massivaStats.totalTickets} massivas
              </span>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                <span>{'Uso de portas'}</span>
              </div>
              <OccupancyBar usagePercent={usagePercent} />
            </div>

            <div className="space-y-2.5 border-t border-outline-variant/40 pt-4">
              <div className="flex items-start gap-2 text-xs text-on-surface-variant/70">
                <MapPin
                  size={15}
                  className="mt-0.5 shrink-0 text-primary/90"
                  strokeWidth={1.75}
                />
                <span className="min-w-0 line-clamp-2 leading-snug">
                  {splitter.street || 'Endere\u00E7o n\u00E3o informado'}
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low/35 p-3 text-xs sm:grid-cols-2">
              <div>
                <p className="font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  Afetados
                </p>
                <p className="mt-1 font-semibold text-on-surface">
                  {massivaStats.affectedClientsTotal.toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  {'\u00DAltima massiva'}
                </p>
                <p className="mt-1 font-semibold text-on-surface">
                  {formatOperationalRelativeDate(massivaStats.latestOpenedAt)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-semibold uppercase tracking-wider text-on-surface-variant/50">
                  {'Tend\u00EAncia'}
                </p>
                <p className="mt-1 font-semibold text-on-surface">
                  {formatTrendLabel(trendLabel)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-outline-variant/40 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/50">
              {'Portas em uso'}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-on-surface">
              <span className="text-on-surface">{splitter.busyCount}</span>
              <span className="mx-1 font-semibold text-on-surface-variant/35">/</span>
              <span className="text-on-surface-variant/80">{splitter.outPorts}</span>
            </p>
          </div>

          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low/80 px-3 py-2',
              'text-xs font-semibold text-on-surface transition-colors duration-300',
              'group-hover:border-primary/30 group-hover:bg-primary group-hover:text-on-surface',
            )}
          >
            {'Ver detalhes'}
            <ArrowRight
              size={16}
              strokeWidth={2}
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Link>
    </div>
  )
}
