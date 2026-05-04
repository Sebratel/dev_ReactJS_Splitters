import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'
import { formatOperationalRelativeDate } from '@/features/splitters/lib/formatOperationalDate'
import { SplitterStatusBadge } from '@/features/splitters/ui/SplitterStatusBadge'
import { cn } from '@/shared/lib/utils'
import { BellOff, BellRing, Cable, Cpu, Hash, Layers } from 'lucide-react'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'

/** Estado da consulta `/connections`: espelho por porta; fallback usa apenas busyCount do splitter. */
type ConnectionsMirrorLoadState = 'pending' | 'success' | 'error'

type SplitterDetailSummaryProps = {
  splitter: Splitter
  massivaStats: SplitterMassivaStats
  operationalScore: SplitterOperationalScore
  connectionsLoadState: ConnectionsMirrorLoadState
  /** Clientes da consulta de conexões (portas reais); ignorado até `success`. */
  connectionClientes: SplitterCliente[]
  onRefreshNow: () => void
  isRefreshing: boolean
  lastUpdatedAtMs: number
}

function formatLastUpdatedAge(lastUpdatedAtMs: number, nowMs: number): string {
  if (!Number.isFinite(lastUpdatedAtMs) || lastUpdatedAtMs <= 0) return 'ainda sem sincronização'
  const seconds = Math.max(0, Math.floor((nowMs - lastUpdatedAtMs) / 1000))
  if (seconds < 60) return `há ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes}min`
  const hours = Math.floor(minutes / 60)
  return `há ${hours}h`
}

function parseSlotAndPortFromTitle(raw: string | null | undefined): {
  slot: string | null
  port: string | null
} {
  const title = (raw ?? '').trim()
  if (title.length === 0) return { slot: null, port: null }

  const beforeSlash = title.split('/')[0] ?? ''
  const numbers = beforeSlash.match(/\d+/g) ?? []
  if (numbers.length < 2) return { slot: null, port: null }

  return {
    slot: numbers[numbers.length - 2] ?? null,
    port: numbers[numbers.length - 1] ?? null,
  }
}

const CRITICALITY_DOT_COUNT = 10

function criticalityDotToneClasses(tone: SplitterOperationalScore['tone']): {
  filled: string
  muted: string
} {
  switch (tone) {
    case 'critical':
      return { filled: 'bg-rose-500 shadow-sm', muted: 'bg-rose-100' }
    case 'attention':
      return { filled: 'bg-amber-500 shadow-sm', muted: 'bg-amber-100' }
    default:
      return { filled: 'bg-emerald-500 shadow-sm', muted: 'bg-emerald-100' }
  }
}

type PortCellKind = 'free' | 'residential' | 'corporate'

/**
 * Espelho por número de porta a partir dos clientes (mesma regra da lista de portas).
 * Vários clientes na mesma porta: prevalece corporativo se qualquer um for.
 */
function buildPortCellsFromClientes(
  outPorts: number,
  clientes: SplitterCliente[],
): Array<{ port: number; kind: PortCellKind }> {
  const total = Math.max(0, Math.round(outPorts))
  const byPort = new Map<number, 'residential' | 'corporate'>()

  for (const c of clientes) {
    const p = c.port
    if (p === null || !Number.isFinite(p)) continue
    const portNum = Math.trunc(p)
    if (portNum < 1 || portNum > total) continue

    const next: 'residential' | 'corporate' = c.isCorporate ? 'corporate' : 'residential'
    const prev = byPort.get(portNum)
    if (!prev) {
      byPort.set(portNum, next)
    } else if (next === 'corporate' || prev === 'residential') {
      byPort.set(portNum, 'corporate')
    }
  }

  return Array.from({ length: total }, (_, index) => {
    const port = index + 1
    const occ = byPort.get(port)
    const kind: PortCellKind = occ === 'corporate' ? 'corporate' : occ === 'residential' ? 'residential' : 'free'
    return { port, kind }
  })
}

/** Fallback quando a consulta de conexões não está disponível: apenas total ocupado (sem posição real). */
function buildPortCellsFromBusyTotal(
  totalPorts: number,
  busyCount: number,
): Array<{ port: number; kind: PortCellKind }> {
  const total = Math.max(0, Math.round(totalPorts))
  const busy = Math.max(0, Math.min(total, Math.round(busyCount)))
  return Array.from({ length: total }, (_, index) => {
    const port = index + 1
    const kind: PortCellKind = index < busy ? 'residential' : 'free'
    return { port, kind }
  })
}

function occupiedCountFromCells(cells: Array<{ kind: PortCellKind }>): number {
  return cells.filter((c) => c.kind !== 'free').length
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
  connectionsLoadState,
  connectionClientes,
  onRefreshNow,
  isRefreshing,
  lastUpdatedAtMs,
}: SplitterDetailSummaryProps) {
  const canOpenMassiva = useAccessAuthStore((state) => state.hasPermission('canOpenMassiva'))
  const [clockMs, setClockMs] = useState(() => Date.now())
  const mirrorLive = connectionsLoadState === 'success'
  const portCells = mirrorLive
    ? buildPortCellsFromClientes(splitter.outPorts, connectionClientes)
    : connectionsLoadState === 'pending'
      ? null
      : buildPortCellsFromBusyTotal(splitter.outPorts, splitter.busyCount)

  const occupiedPorts =
    portCells !== null ? occupiedCountFromCells(portCells) : splitter.busyCount

  const usageRatio =
    splitter.outPorts > 0 ? occupiedPorts / splitter.outPorts : 0
  const usagePercent = Math.round(Math.min(100, usageRatio * 100))
  const animatedUsagePercent = Math.round(
    Math.max(0, Math.min(100, useAnimatedNumber(usagePercent, 750))),
  )
  const animatedCriticality = Math.round(
    Math.max(0, Math.min(100, useAnimatedNumber(operationalScore.score, 700))),
  )
  const animatedMassivas = Math.max(0, Math.round(useAnimatedNumber(massivaStats.totalTickets, 650)))
  const hasOpenMassiva = massivaStats.openTickets > 0
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
  const integrationRef = splitter.integrationCode || splitter.code || '-'

  const dotTone = criticalityDotToneClasses(operationalScore.tone)
  const filledCriticalityDots = Math.min(
    CRITICALITY_DOT_COUNT,
    Math.max(0, Math.round((animatedCriticality / 100) * CRITICALITY_DOT_COUNT)),
  )
  const lastUpdatedLabel = formatLastUpdatedAge(lastUpdatedAtMs, clockMs)

  useEffect(() => {
    const interval = window.setInterval(() => setClockMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-outline-variant/60 bg-surface-container-low/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/70">
              Atualizado {lastUpdatedLabel}
            </span>
            {canOpenMassiva ? (
              <Link
                to="/massiva"
                state={{
                  massivaPrefill: {
                    splitterCode: splitter.code,
                    splitterLabel: splitter.title || splitter.code,
                  },
                }}
                className="inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900 transition hover:bg-amber-100"
              >
                Abrir massiva
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onRefreshNow}
              disabled={isRefreshing}
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition',
                isRefreshing
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15',
              )}
            >
              {isRefreshing ? 'Atualizando…' : 'Atualizar agora'}
            </button>
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
              Criticidade
            </p>
            <div
              className="mt-2 flex items-center gap-1"
              role="img"
              aria-label={`Criticidade ${operationalScore.label}, índice ${animatedCriticality} de 100`}
            >
              {Array.from({ length: CRITICALITY_DOT_COUNT }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-300',
                    i < filledCriticalityDots ? dotTone.filled : dotTone.muted,
                  )}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant bg-white px-3 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
              Massivas
            </p>
            <p
              className={cn(
                'mt-1 inline-flex items-center gap-1.5 text-3xl font-bold leading-tight',
                hasOpenMassiva ? 'text-rose-600' : 'text-on-surface',
              )}
            >
              {animatedMassivas}
              {hasOpenMassiva ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-1 ring-rose-200 motion-safe:animate-pulse">
                  <BellRing size={13} strokeWidth={2.2} />
                </span>
              ) : (
                <BellOff
                  size={14}
                  className="text-on-surface-variant/50"
                  strokeWidth={2}
                />
              )}
            </p>
            {hasOpenMassiva ? (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                {massivaStats.openTickets} aberta{massivaStats.openTickets === 1 ? '' : 's'} agora
              </p>
            ) : (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/55">
                Sem aberta no momento
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] animate-in fade-in slide-in-from-bottom-1 duration-700">
        <div className="transition-all duration-300">
          <div className="mb-1.5 flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                Ocupação das portas
              </p>
              <p className="text-sm font-semibold text-on-surface-variant/80">
                {occupiedPorts} de {splitter.outPorts} portas utilizadas
              </p>
              {connectionsLoadState === 'pending' ? (
                <p className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-on-surface-variant/55">
                  Carregando espelho por porta (total provisório pelo cadastro).
                </p>
              ) : connectionsLoadState === 'error' ? (
                <p className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-on-surface-variant/55">
                  Consulta de conexões indisponível — uso apenas do total ocupado do equipamento.
                </p>
              ) : mirrorLive ? (
                <p className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-on-surface-variant/60">
                  Percentual alinhado às portas listadas na consulta de conexões.
                </p>
              ) : null}
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
            Mapa de distribuição das portas
          </p>
          {mirrorLive ? (
            <p className="mt-0.5 text-[10px] leading-snug text-on-surface-variant/55">
              Verde: cliente PF/residencial · Roxo: corporativo · Cinza: livre.
            </p>
          ) : null}

          {portCells === null ? (
            <div className="mt-3 flex min-h-[3rem] items-center justify-center rounded-lg border border-dashed border-outline-variant/70 bg-surface-container-low/25 px-3 py-2 text-center text-xs text-on-surface-variant/65">
              Carregando espelho das portas…
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {portCells.map((cell) => {
                const occupied = cell.kind !== 'free'
                const corp = cell.kind === 'corporate'
                const res = cell.kind === 'residential'
                return (
                  <span
                    key={cell.port}
                    title={
                      corp
                        ? `Porta ${cell.port} · cliente corporativo`
                        : res
                          ? `Porta ${cell.port} · ocupada`
                          : `Porta ${cell.port} · livre`
                    }
                    className={cn(
                      'inline-flex h-7 min-w-8 items-center justify-center rounded-md border px-1.5 text-[9px] font-semibold transition-all duration-300 hover:-translate-y-0.5',
                      occupied && 'animate-in fade-in zoom-in-95 duration-300',
                      corp &&
                        'border-violet-500 bg-violet-600 text-white shadow-sm',
                      res &&
                        'border-emerald-300 bg-emerald-500 text-white',
                      cell.kind === 'free' &&
                        'border-outline-variant/70 bg-surface-container-low/20 text-on-surface-variant/45',
                    )}
                    style={occupied ? { animationDelay: `${cell.port * 28}ms` } : undefined}
                  >
                    {cell.port}
                  </span>
                )
              })}
            </div>
          )}
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
