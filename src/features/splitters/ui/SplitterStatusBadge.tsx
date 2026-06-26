import { cn } from '@/shared/lib/utils'

type SplitterStatusBadgeProps = {
  active: boolean
  className?: string
  /** Quando informado, substitui os rótulos padrão "Ativo" / "Inativo" (apenas UI). */
  labels?: { active: string; inactive: string }
  /**
   * "brand" (padrão): verde primário — indica estado operacional (splitter, porta).
   * "neutral": bolacha verde + texto neutro — indica estado cadastral (contrato).
   */
  variant?: 'brand' | 'neutral'
}

export function SplitterStatusBadge({
  active,
  className,
  labels,
  variant = 'brand',
}: SplitterStatusBadgeProps) {
  const on = labels?.active ?? 'Ativo'
  const off = labels?.inactive ?? 'Inativo'

  if (variant === 'neutral' && active) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-low/60 py-1 pl-1 pr-2.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant',
          className,
        )}
      >
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="1.5,5 4,7.5 8.5,2.5" />
          </svg>
        </span>
        {on}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
        active
          ? 'border-primary/25 bg-primary/[0.09] text-primary'
          : 'border-on-surface-variant/15 bg-on-surface-variant/[0.06] text-on-surface-variant',
        className,
      )}
    >
      {active ? on : off}
    </span>
  )
}
