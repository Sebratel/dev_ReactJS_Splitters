import { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  description?: string
  /** Layout mais baixo (dashboard denso). Descrição passa a tooltip se existir. */
  compact?: boolean
  /** Superfície com vidro leve e sombra (só home / painéis premium). */
  surface?: 'default' | 'elevated'
  trend?: {
    value: number
    label: string
  }
  className?: string
}

/**
 * Card de indicador operacional — layout executivo (fundo claro, hierarquia forte).
 * `className` costuma trazer `border-l-*` para diferenciar o conjunto sem saturar a tela.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  compact = false,
  surface = 'default',
  trend,
  className,
}: StatCardProps) {
  const insight =
    compact && description ? description : !compact ? description : undefined

  return (
    <div
      title={compact && description ? description : undefined}
      className={cn(
        'group flex h-full min-w-0 flex-col justify-between rounded-2xl border transition-[box-shadow,transform,border-color] duration-300',
        surface === 'elevated'
          ? 'border-white/50 dark:border-white/10 bg-surface-container-lowest/75 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.08)] ring-1 ring-stone-200/30 dark:ring-white/10 backdrop-blur-md motion-safe:hover:-translate-y-0.5 hover:border-amber-200/40 dark:hover:border-amber-800/50 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.15)]'
          : 'border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)]',
        compact
          ? 'min-h-[100px] p-3.5 sm:p-4'
          : 'min-h-[120px] p-4 sm:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl text-on-surface-variant dark:text-on-surface/85 ring-1 ring-inset transition-colors group-hover:text-on-surface',
            surface === 'elevated'
              ? 'bg-gradient-to-br from-amber-50/90 dark:from-amber-950/20 to-stone-50/80 dark:to-white/5 ring-amber-200/40 dark:ring-amber-800/50 group-hover:from-amber-100/80 dark:group-hover:from-amber-950/25 group-hover:to-stone-50 dark:group-hover:to-white/5'
              : 'bg-neutral-100 dark:bg-white/5 ring-neutral-200/80 dark:ring-white/10 group-hover:bg-surface-container-low',
            compact ? 'h-9 w-9' : 'h-11 w-11',
          )}
          aria-hidden
        >
          <Icon
            className={cn(
              compact ? 'h-4 w-4' : 'h-[1.2rem] w-[1.2rem] sm:h-5 sm:w-5',
            )}
            strokeWidth={1.75}
          />
        </div>
        {trend != null ? (
          <div className="flex max-w-[min(100%,10.5rem)] flex-col items-end gap-0.5 text-right">
            <span
              className="shrink-0 rounded-md border border-neutral-200/80 dark:border-white/10 bg-surface-container-low px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-on-surface-variant"
              title={trend.label}
            >
              {trend.value === 0
                ? '0%'
                : `${trend.value > 0 ? '↑' : '↓'} ${Math.abs(trend.value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            </span>
            {trend.label ? (
              <span className="text-[10px] font-medium leading-tight text-on-surface-variant/60">{trend.label}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={cn('min-w-0', compact ? 'pt-2' : 'pt-3')}>
        <p
          className={cn(
            'font-semibold tabular-nums tracking-tight text-on-surface',
            compact ? 'text-xl leading-none sm:text-2xl' : 'text-2xl sm:text-[1.75rem] sm:leading-none',
          )}
        >
          {value}
        </p>
        <h3
          className={cn(
            'mt-1.5 font-semibold uppercase leading-snug tracking-[0.08em] text-on-surface-variant',
            compact ? 'text-[10px] sm:text-[11px]' : 'mt-1.5 text-[11px] sm:text-[12px]',
          )}
        >
          {label}
        </h3>
        {insight ? (
          <p className="mt-1 text-[11px] font-medium leading-snug text-on-surface-variant/60">{insight}</p>
        ) : null}
      </div>
    </div>
  )
}
