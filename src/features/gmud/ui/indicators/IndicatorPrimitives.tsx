import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { CARD, COLORS } from '@/features/gmud/ui/indicators/indicatorTheme'

const TONE = {
  neutral: 'text-on-surface',
  danger: 'text-rose-600 dark:text-rose-300',
  warning: 'text-amber-600 dark:text-amber-300',
  success: 'text-emerald-600 dark:text-emerald-300',
} as const

export function KpiCard({
  label,
  value,
  hint,
  Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  Icon: LucideIcon
  tone?: keyof typeof TONE
}) {
  return (
    <div className={cn(CARD, 'flex flex-col gap-2 p-4')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
        <Icon size={16} className="text-on-surface-variant/70" />
      </div>
      <span className={cn('text-3xl font-bold tabular-nums leading-none', TONE[tone])}>{value}</span>
      {hint ? <span className="text-xs text-on-surface-variant">{hint}</span> : null}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  return (
    <section className={cn(CARD, 'flex min-w-0 flex-col gap-3 p-4', className)}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-on-surface">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-on-surface-variant">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mt-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      {description ? <p className="mt-0.5 max-w-3xl text-sm text-on-surface-variant">{description}</p> : null}
    </div>
  )
}

/** Barras horizontais simples (ranking/categorias). */
export function BarList({
  items,
  color = COLORS.primary,
  emptyLabel = 'Sem dados no período.',
  max = 8,
}: {
  items: { key: string; count: number }[]
  color?: string
  emptyLabel?: string
  max?: number
}) {
  const shown = items.slice(0, max)
  const top = Math.max(1, ...shown.map((i) => i.count))
  if (shown.length === 0) return <p className="py-4 text-center text-xs text-on-surface-variant">{emptyLabel}</p>
  return (
    <ul className="space-y-2">
      {shown.map((i) => (
        <li key={i.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-on-surface" title={i.key}>{i.key}</span>
            <span className="shrink-0 font-semibold tabular-nums text-on-surface">{i.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-container-low">
            <div className="h-full rounded-full" style={{ width: `${(i.count / top) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Mapa de calor dia da semana × hora. */
export function Heatmap({ matrix, color = COLORS.primary }: { matrix: number[][]; color?: string }) {
  const max = Math.max(0, ...matrix.flat())
  if (max === 0) return <p className="py-4 text-center text-xs text-on-surface-variant">Sem dados no período.</p>
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] gap-[3px]" style={{ gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))' }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[9px] tabular-nums text-on-surface-variant">
            {h % 3 === 0 ? `${h}h` : ''}
          </span>
        ))}
        {matrix.map((row, d) => (
          <div key={d} className="contents">
            <span className="text-[10px] font-semibold text-on-surface-variant">{WEEKDAYS[d]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                title={`${WEEKDAYS[d]} ${h}h: ${v}`}
                className="aspect-square rounded-[3px] bg-surface-container-low"
                style={v > 0 ? { background: color, opacity: 0.18 + 0.82 * (v / max) } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Aviso para blocos que só ganham dados com GMUDs abertas pela plataforma. */
export function PlatformPending({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs text-on-surface-variant">
      <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
      <span>{children ?? 'Começa a ser medido com as GMUDs abertas pela plataforma.'}</span>
    </div>
  )
}
