import {
  CANCELLATION_CATEGORY_LABELS,
  CANCELLATION_CATEGORY_ORDER,
  type CancellationCategory,
} from '@/features/cancellations/model/cancellationsSummary'

const CATEGORY_DOT: Record<CancellationCategory, string> = {
  rede: 'bg-rose-500',
  tecnico: 'bg-amber-500',
  financeiro: 'bg-slate-400',
  pre_instalacao: 'bg-sky-400',
  mudanca: 'bg-violet-400',
  operacional: 'bg-neutral-300 dark:bg-white/15',
  outros: 'bg-neutral-200 dark:bg-white/10',
}

type CancellationMotiveFilterProps = {
  selected: CancellationCategory[]
  onChange: (next: CancellationCategory[]) => void
  counts?: Partial<Record<CancellationCategory, number>>
  className?: string
}

export function CancellationMotiveFilter({
  selected,
  onChange,
  counts,
  className = '',
}: CancellationMotiveFilterProps) {
  const toggle = (cat: CancellationCategory) => {
    onChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat])
  }

  return (
    <div className={className}>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
        Motivo de cancelamento
        {selected.length > 0 ? (
          <span className="ml-1.5 font-normal normal-case text-indigo-600 dark:text-indigo-300">
            ({selected.length} selecionado{selected.length > 1 ? 's' : ''})
          </span>
        ) : (
          <span className="ml-1.5 font-normal normal-case text-on-surface-variant/60">— todos</span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {CANCELLATION_CATEGORY_ORDER.map((cat) => {
          const isOn = selected.includes(cat)
          const count = counts?.[cat] ?? 0
          const disabled = counts != null && count === 0
          return (
            <button
              key={cat}
              type="button"
              disabled={disabled}
              onClick={() => toggle(cat)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                isOn
                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-200'
                  : disabled
                    ? 'cursor-not-allowed border-neutral-100 dark:border-white/5 bg-surface-container-low text-on-surface-variant/60'
                    : 'border-neutral-200 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant hover:border-neutral-300 hover:bg-surface-container-low'
              }`}
            >
              <span className={`size-2 shrink-0 rounded-full ${CATEGORY_DOT[cat]}`} aria-hidden />
              {CANCELLATION_CATEGORY_LABELS[cat]}
              {counts != null ? (
                <span className={`tabular-nums ${isOn ? 'text-indigo-700 dark:text-indigo-200' : 'text-on-surface-variant/60'}`}>
                  {count.toLocaleString('pt-BR')}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
