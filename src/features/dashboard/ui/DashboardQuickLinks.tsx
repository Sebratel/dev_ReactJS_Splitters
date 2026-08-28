import { Link } from 'react-router-dom'
import { GitBranch, Map, Zap } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/utils'

const items = [
  { to: '/splitters', label: 'Splitters', icon: GitBranch },
  { to: '/massiva', label: 'Massivas', icon: Zap },
  { to: '/intelligence', label: 'Inteligência', icon: Map },
] as const

export function DashboardQuickLinks() {
  const reduceMotion = useReducedMotion()

  return (
    <nav
      className="flex flex-wrap items-center gap-2"
      aria-label="Atalhos do dashboard"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/60 sm:text-[11px]">
        Atalhos
      </span>
      {items.map(({ to, label, icon: Icon }, i) => (
        <motion.div
          key={to}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: reduceMotion ? 0 : 0.04 * i }}
        >
          <Link
            to={to}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-white/70 bg-surface-container-lowest/70 px-4 py-2 text-[12px] font-semibold text-stone-800 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.15)] ring-1 ring-stone-200/40 dark:ring-white/10 backdrop-blur-sm',
              'transition-[transform,box-shadow,border-color,background] duration-200 hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-gradient-to-r hover:from-amber-50/90 dark:hover:from-amber-950/20 hover:to-white dark:hover:to-surface-container-lowest hover:shadow-lg motion-reduce:hover:translate-y-0',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/80',
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        </motion.div>
      ))}
    </nav>
  )
}
