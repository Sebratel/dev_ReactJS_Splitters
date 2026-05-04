import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'
import type { SplitterOperationalScore } from '@/features/splitters/model/splitterOperationalInsights'
import { criticalityDotsFromScore, scoreDotToneClassName } from '@/features/splitters/ui/operationalScoreVisual'

type OperationalScoreHealthDotsProps = {
  score: number
  tone: SplitterOperationalScore['tone']
  className?: string
  dotClassName?: string
}

export function OperationalScoreHealthDots({
  score,
  tone,
  className,
  dotClassName = 'h-1.5 w-1.5',
}: OperationalScoreHealthDotsProps) {
  const reduceMotion = useReducedMotion()
  const filledCriticalityDots = criticalityDotsFromScore(score)

  return (
    <motion.span
      className={cn('inline-flex items-center gap-1', className)}
      aria-hidden="true"
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduceMotion ? 0 : 0.055,
            delayChildren: reduceMotion ? 0 : 0.08,
          },
        },
      }}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const active = index < filledCriticalityDots
        return (
          <motion.span
            key={index}
            className={cn(
              'inline-block shrink-0 rounded-full',
              dotClassName,
              active ? scoreDotToneClassName(tone) : 'bg-slate-300',
            )}
            variants={
              reduceMotion
                ? {}
                : {
                    hidden: { scale: 0, opacity: 0 },
                    visible: {
                      scale: 1,
                      opacity: 1,
                      transition: {
                        type: 'spring',
                        stiffness: 520,
                        damping: 22,
                      },
                    },
                  }
            }
          />
        )
      })}
    </motion.span>
  )
}
