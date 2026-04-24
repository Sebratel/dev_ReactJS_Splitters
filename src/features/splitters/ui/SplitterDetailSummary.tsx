import { useEffect, useRef, useState } from 'react'
import type { Splitter } from '@/features/splitters/model/splitter'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'
import { formatOperationalRelativeDate } from '@/features/splitters/lib/formatOperationalDate'
import { SplitterStatusBadge } from '@/features/splitters/ui/SplitterStatusBadge'
import { cn } from '@/shared/lib/utils'
import {
  AlertTriangle,
  BellOff,
  Cable,
  Cpu,
  Hash,
  Layers,
} from 'lucide-react'

type SplitterDetailSummaryProps = {
  splitter: Splitter
  massivaStats: SplitterMassivaStats
  operationalScore: SplitterOperationalScore
}

function parseSlotAndPortFromTitle(raw: string | null | undefined): {
  slot: string | null
  port: string | null
} {
  const title = (raw ?? '').trim()
  if (title.length === 0) return { slot: null, port: null }

  const beforeSlash = title.split('/')[0] ?? ''
  const numbers = beforeSlash.match(/\d+/g) ?? []
  if (numbers.length < 3) return { slot: null, port: null }

  return {
    slot: numbers[numbers.length - 3] ?? null,
    port: numbers[numbers.length - 2] ?? null,
  }
}

function scoreToneTextClassName(tone: SplitterOperationalScore['tone']): string {
  switch (tone) {
    case 'critical':
      return 'text-rose-600'
    case 'attention':
      return 'text-amber-600'
    default:
      return 'text-emerald-600'
  }
}

function scoreToneIconClassName(tone: SplitterOperationalScore['tone']): string {
  switch (tone) {
    case 'critical':
      return 'text-rose-600'
    case 'attention':
      return 'text-amber-500'
    default:
      return 'text-emerald-500'
  }
}

function buildPortDistribution(
  totalPorts: number,
  busyCount: number,
): Array<{ port: number; active: boolean }> {
  const normalizedTotal = Math.max(0, Math.round(totalPorts))
  const shownTotal = Math.min(normalizedTotal, 16)
  return Array.from({ length: shownTotal }, (_, index) => ({
    port: index + 1,
    active: index < Math.max(0, busyCount),
  }))
}

function OccupancyPercentToneClass(usagePercent: number): string {
  if (usagePercent >= 95) return 'text-rose-600'
  if (usagePercent >= 70) return 'text-amber-600'
  return 'text-emerald-600'
}

function useAnimatedNumber(target: number, durationMs: number = 700): number {
  const [value, setValue] = useState(0)
  const previousRef = useRef(0)

  useEffect(() => {
    const start = previousRef.current
    const end = Number.isFinite(target) ? target : 0
    const delta = end - start

    if (Math.abs(delta) < 0.01) {
      setValue(end)
      previousRef.current = end
      return
    }

    let frameId = 0
    const startedAt = performance.now()

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = start + delta * eased
      setValue(next)

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        previousRef.current = end
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [target, durationMs])

  return value
}

export function SplitterDetailSummary({
  splitter,
  massivaStats,
  operationalScore,
}: SplitterDetailSummaryProps) {
  const usageRatio = splitter.outPorts > 0 ? splitter.busyCount / splitter.outPorts : 0
  const usagePercent = Math.round(Math.min(100, usageRatio * 100))
  const animatedUsagePercent = Math.round(
    Math.max(0, Math.min(100, useAnimatedNumber(usagePercent, 750))),
  )
  const animatedCriticality = Math.round(
    Math.max(0, Math.min(100, useAnimatedNumber(operationalScore.score, 700))),
  )
  const animatedMassivas = Math.max(0, Math.round(useAnimatedNumber(massivaStats.totalTickets, 650)))
  const [criticalityPulse, setCriticalityPulse] = useState(false)
  const toneRef = useRef<SplitterOperationalScore['tone']>(operationalScore.tone)

  useEffect(() => {
    if (toneRef.current !== operationalScore.tone) {
      toneRef.current = operationalScore.tone
      setCriticalityPulse(true)
      const timeout = window.setTimeout(() => setCriticalityPulse(false), 420)
      return () => window.clearTimeout(timeout)
    }
    return
  }, [operationalScore.tone])

  const { slot, port } = parseSlotAndPortFromTitle(splitter.title || splitter.code)
  const ports = buildPortDistribution(splitter.outPorts, splitter.busyCount)
  const hiddenPorts = Math.max(0, splitter.outPorts - 16)
  const integrationRef = splitter.integrationCode || splitter.code || '-'

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-outline-variant bg-white p-4 pt-5 shadow-sm animate-in fade-in zoom-in-[0.99] duration-500 md:p-5 md:pt-6"
      aria-labelledby="splitter-detail-heading"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-primary motion-safe:animate-pulse [animation-duration:2.4s]" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between animate-in fade-in slide-in-from-bottom-1 duration-500">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
              <Cpu size={15} strokeWidth={1.8} />
            </div>
            <SplitterStatusBadge
              active={splitter.active}
              labels={{ active: 'Sinal ativo', inactive: 'Equipamento inativo' }}
            />
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              ID: {integrationRef}
            </span>
          </div>

          <h1
            id="splitter-detail-heading"
            className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-on-surface md:text-[2.1rem]"
          >
            {splitter.title || splitter.code}
          </h1>

          {slot && port ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/[0.07] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Layers size={12} strokeWidth={1.75} />
                Slot {slot}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-tertiary/20 bg-tertiary/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-tertiary">
                <Cable size={12} strokeWidth={1.75} />
                Porta {port}
              </span>
            </div>
          ) : null}
        </div>

          <div className="grid grid-cols-2 gap-2 md:min-w-[240px]">
          <div
            className={cn(
              'rounded-xl border border-outline-variant bg-white px-3 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow',
              criticalityPulse && 'scale-[1.02] ring-1 ring-amber-200',
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
              Criticality
            </p>
            <p
              className={cn(
                'mt-1 inline-flex items-center gap-1.5 text-3xl font-bold leading-tight',
                scoreToneTextClassName(operationalScore.tone),
              )}
            >
              {operationalScore.label} {animatedCriticality}
              <AlertTriangle
                size={14}
                className={scoreToneIconClassName(operationalScore.tone)}
                strokeWidth={2}
              />
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant bg-white px-3 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
              Massivas
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-3xl font-bold leading-tight text-on-surface">
              {animatedMassivas}
              <BellOff size={14} className="text-on-surface-variant/50" strokeWidth={2} />
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] animate-in fade-in slide-in-from-bottom-1 duration-700">
        <div className="transition-all duration-300">
          <div className="mb-1.5 flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                Port occupancy
              </p>
              <p className="text-sm font-semibold text-on-surface-variant/80">
                {splitter.busyCount} de {splitter.outPorts} portas utilizadas
              </p>
            </div>
            <p className={cn('text-3xl font-bold leading-none', OccupancyPercentToneClass(usagePercent))}>
              {animatedUsagePercent}%
            </p>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-700',
                usagePercent >= 95 ? 'bg-rose-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
              )}
              style={{ width: `${animatedUsagePercent}%` }}
            />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
            Port distribution map
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ports.map((cell) => (
              <span
                key={cell.port}
                className={cn(
                  'inline-flex h-7 min-w-8 items-center justify-center rounded-md border px-1.5 text-[9px] font-semibold transition-all duration-300 hover:-translate-y-0.5',
                  cell.active && 'animate-in fade-in zoom-in-95 duration-300',
                  cell.active
                    ? 'border-emerald-300 bg-emerald-500 text-white'
                    : 'border-outline-variant/70 bg-surface-container-low/20 text-on-surface-variant/45',
                )}
                style={cell.active ? { animationDelay: `${cell.port * 28}ms` } : undefined}
              >
                {cell.port}
              </span>
            ))}
            {hiddenPorts > 0 ? (
              <span className="inline-flex h-7 items-center justify-center rounded-md border border-outline-variant/70 bg-surface-container-low/20 px-2 text-[9px] font-semibold text-on-surface-variant/55">
                +{hiddenPorts}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-low/20 animate-in fade-in slide-in-from-bottom-1 duration-700">
        <div className="grid gap-0 md:grid-cols-5">
          <div className="border-b border-outline-variant/40 p-3 md:border-b-0 md:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Tipo / status
            </p>
            <p className="mt-1 text-sm font-semibold text-on-surface">{splitter.typeText || 'Não definido'}</p>
          </div>
          <div className="border-b border-outline-variant/40 p-3 md:border-b-0 md:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Concentrador (OLT)
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-on-surface">
              {splitter.oltDescription ?? splitter.oltCode ?? '-'}
            </p>
          </div>
          <div className="border-b border-outline-variant/40 p-3 md:border-b-0 md:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Referência GeoGrid
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
              <Hash size={12} className="shrink-0 opacity-70" strokeWidth={1.75} />
              <span className="truncate">{splitter.integrationCode || '-'}</span>
            </p>
          </div>
          <div className="border-b border-outline-variant/40 p-3 md:border-b-0 md:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Clientes afetados
            </p>
            <p className="mt-1 text-sm font-semibold text-on-surface">
              {massivaStats.affectedClientsTotal.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Última massiva
            </p>
            <p className="mt-1 text-sm font-semibold text-on-surface">
              {formatOperationalRelativeDate(massivaStats.latestOpenedAt)}
            </p>
          </div>
        </div>
      </div>

      {splitter.description ? (
        <div className="mt-3 rounded-xl border border-outline-variant/60 bg-surface-container-low/20 px-3 py-2.5 animate-in fade-in duration-700">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Descrição técnica
          </p>
          <p className="mt-1.5 text-sm font-medium leading-snug text-on-surface-variant">
            {splitter.description}
          </p>
        </div>
      ) : null}
    </section>
  )
}
