import { motion, useReducedMotion } from 'framer-motion'
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
  const reduceMotion = useReducedMotion()

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
        <motion.div
          className={cn('h-full w-full min-w-0 rounded-full origin-left', tone.bar, tone.barGlow)}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: clamped / 100 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
          }
          style={{ transformOrigin: '0% 50%' }}
        />
      </div>
    </div>
  )
}
