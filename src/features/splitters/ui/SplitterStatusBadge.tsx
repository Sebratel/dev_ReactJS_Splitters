import { cn } from '@/shared/lib/utils'

type SplitterStatusBadgeProps = {
  active: boolean
  className?: string
  /** Quando informado, substitui os rótulos padrão "Ativo" / "Inativo" (apenas UI). */
  labels?: { active: string; inactive: string }
}

export function SplitterStatusBadge({
  active,
  className,
  labels,
}: SplitterStatusBadgeProps) {
  const on = labels?.active ?? 'Ativo'
  const off = labels?.inactive ?? 'Inativo'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
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
