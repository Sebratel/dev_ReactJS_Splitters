import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'

type FabAttentionMotionProps = {
  children: ReactNode
  /** Quando true (ex.: painel aberto), não anima — evita distração e poupa CPU. */
  pause?: boolean
  className?: string
}

/**
 * Animação contínua discreta para FABs (flutuação + escala leve), com respeito a
 * `prefers-reduced-motion` e pausa opcional.
 */
export function FabAttentionMotion({ children, pause, className }: FabAttentionMotionProps) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion || pause) {
    return <span className={cn('inline-flex', className)}>{children}</span>
  }

  return (
    <motion.span
      className={cn('inline-flex will-change-transform', className)}
      initial={false}
      animate={{
        y: [0, -5, 0],
        scale: [1, 1.04, 1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: [0.45, 0, 0.55, 1],
        repeatDelay: 0.35,
      }}
    >
      {children}
    </motion.span>
  )
}
