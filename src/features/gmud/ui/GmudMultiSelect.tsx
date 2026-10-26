import { cn } from '@/shared/lib/utils'
import type { GmudConfigItem } from '@/features/gmud/api/gmudConfigLists'

type Props = {
  options: GmudConfigItem[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Mostra skeleton de loading quando os dados ainda estão chegando. */
  loading?: boolean
}

export function GmudMultiSelect({ options, value, onChange, placeholder, loading }: Props) {
  const toggle = (label: string) =>
    onChange(value.includes(label) ? value.filter((v) => v !== label) : [...value, label])

  if (loading) {
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-7 w-20 animate-pulse rounded-full bg-neutral-200/70 dark:bg-white/10"
          />
        ))}
      </div>
    )
  }

  if (options.length === 0) {
    return (
      <p className="mt-1 text-xs text-on-surface-variant/60 italic">
        {placeholder ?? 'Nenhuma opção disponível.'}
      </p>
    )
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = value.includes(opt.label)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.label)}
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 transition',
              selected
                ? 'bg-primary text-white ring-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface ring-neutral-200/70 dark:ring-white/10 hover:bg-surface-container',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
