import { Wifi, WifiOff, Loader2, HelpCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  deriveAttenuation,
  deriveOnuSignalStatus,
  formatAgo,
  isNoOpticalSignal,
  onuStatusLabel,
  type OnuDiagnostic,
  type OnuSignalStatus,
} from '@/features/onu/model/onuDiagnostic'

type OnuStatusBadgeProps = {
  diagnostic: OnuDiagnostic | null | undefined
  loading?: boolean
  compact?: boolean
  className?: string
}

type StatusStyle = {
  border: string
  leftBg: string
  leftText: string
  rightBg: string
  rightText: string
}

const STATUS_STYLES: Record<OnuSignalStatus, StatusStyle> = {
  online: {
    border: 'border-emerald-300',
    leftBg: 'bg-emerald-500',
    leftText: 'text-white',
    rightBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    rightText: 'text-emerald-800 dark:text-emerald-200',
  },
  degraded: {
    border: 'border-amber-300',
    leftBg: 'bg-amber-500',
    leftText: 'text-white',
    rightBg: 'bg-amber-50 dark:bg-amber-950/40',
    rightText: 'text-amber-800 dark:text-amber-200',
  },
  offline: {
    border: 'border-rose-200 dark:border-rose-800/50',
    leftBg: 'bg-rose-500',
    leftText: 'text-white',
    rightBg: 'bg-rose-50 dark:bg-rose-950/40',
    rightText: 'text-rose-800 dark:text-rose-200',
  },
  unknown: {
    border: 'border-slate-200 dark:border-white/10',
    leftBg: 'bg-slate-400',
    leftText: 'text-white',
    rightBg: 'bg-surface-container-low',
    rightText: 'text-on-surface-variant',
  },
}

function formatDbm(value: number | null): string | null {
  if (value === null) return null
  return `${value.toFixed(1)} dBm`
}

export function OnuStatusBadge({
  diagnostic,
  loading = false,
  className,
}: OnuStatusBadgeProps) {
  if (loading && !diagnostic) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-surface-container-low px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60',
          className,
        )}
        aria-label="Carregando status da ONU"
      >
        <Loader2 size={11} className="animate-spin" />
        ONU
      </span>
    )
  }

  const status = deriveOnuSignalStatus(diagnostic)
  const rx = formatDbm(diagnostic?.rxPower ?? null)
  const noSignal = isNoOpticalSignal(diagnostic)

  const attenuation = deriveAttenuation(diagnostic)
  const styleKey: OnuSignalStatus =
    attenuation.level === 'critical'
      ? 'offline'
      : attenuation.level === 'warning'
        ? 'degraded'
        : status
  const style = STATUS_STYLES[styleKey]
  const attenuated = attenuation.level === 'critical' || attenuation.level === 'warning'

  const leftLabel = noSignal
    ? 'Sem sinal'
    : attenuated
      ? attenuation.level === 'critical'
        ? 'Crítico'
        : 'Atenuado'
      : onuStatusLabel(status)

  const Icon = attenuated && !noSignal
    ? AlertTriangle
    : status === 'offline'
      ? WifiOff
      : status === 'unknown'
        ? HelpCircle
        : Wifi

  const rightValue = !noSignal && rx && (status === 'online' || status === 'degraded' || attenuated)
    ? rx
    : null

  const titleParts = [`ONU: ${leftLabel}`]
  if (rx && !noSignal) titleParts.push(`RX ${rx}`)
  if (attenuation.deltaDb !== null && attenuated) {
    titleParts.push(`${attenuation.deltaDb.toFixed(1)} dB abaixo do projetado`)
  }
  if (diagnostic?.oltHostname) titleParts.push(`OLT ${diagnostic.oltHostname}`)
  const freshness = formatAgo(diagnostic?.statusSeenAgeSeconds ?? null)
  if (freshness) titleParts.push(`status verificado ${freshness}`)

  return (
    <span
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-full border text-[10px] font-bold uppercase tracking-wider',
        style.border,
        className,
      )}
      title={titleParts.join(' · ')}
      aria-label={titleParts.join('. ')}
    >
      {/* Lado esquerdo: status colorido */}
      <span
        className={cn(
          'flex items-center gap-1 px-2.5 py-1',
          style.leftBg,
          style.leftText,
        )}
      >
        <Icon size={11} strokeWidth={2} />
        {leftLabel}
      </span>

      {/* Lado direito: valor em dBm — só quando disponível */}
      {rightValue ? (
        <span
          className={cn(
            'flex items-center px-2.5 py-1 font-semibold',
            style.rightBg,
            style.rightText,
          )}
        >
          {rightValue}
        </span>
      ) : null}
    </span>
  )
}
