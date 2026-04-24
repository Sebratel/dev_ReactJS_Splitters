import { cn } from '@/shared/lib/utils'
import { getOccupancyVisualTone } from '@/features/splitters/ui/occupancyVisual'

type OccupancyBarProps = {
  usagePercent: number
  className?: string
  /** Barra mais fina (ex.: telas densas / detalhe). */
  compact?: boolean
}

export function OccupancyBar({ usagePercent, className, compact }: OccupancyBarProps) {
  const clamped = Math.min(100, Math.max(0, usagePercent))
  const tone = getOccupancyVisualTone(clamped)

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full border border-on-surface/[0.06]',
          compact ? 'h-2' : 'h-3',
          tone.track,
        )}
        role="presentation"
      >
        <div
          className={cn(
            'h-full min-w-0 rounded-full transition-[width] duration-700 ease-out',
            tone.bar,
            tone.barGlow,
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
