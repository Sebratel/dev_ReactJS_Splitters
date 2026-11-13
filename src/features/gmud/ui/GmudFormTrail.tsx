import { AlertTriangle, Check } from 'lucide-react'
import type { WizardState, WizardStep } from '@/features/gmud/lib/gmudWizard'
import { cn } from '@/shared/lib/utils'

const DOT: Record<WizardState, string> = {
  done: 'bg-emerald-600 text-white',
  current: 'bg-primary text-neutral-900',
  pending: 'bg-surface-container-low text-on-surface-variant ring-1 ring-neutral-300/80 dark:ring-white/15',
  attention: 'bg-amber-100 text-amber-800 ring-1 ring-amber-400 dark:bg-amber-950/50 dark:text-amber-200',
}

/** Linha do tempo das etapas do formulário: dá para voltar a qualquer etapa já alcançada. */
export function GmudFormTrail({
  steps,
  states,
  current,
  maxReached,
  pendCounts,
  onSelect,
}: {
  steps: WizardStep[]
  states: WizardState[]
  current: number
  maxReached: number
  pendCounts: number[]
  onSelect: (index: number) => void
}) {
  return (
    <nav className="rounded-2xl border border-neutral-200/90 bg-surface-container-lowest p-4 dark:border-white/10" aria-label="Etapas do formulário">
      <ol className="grid grid-cols-5 gap-1">
        {steps.map((s, i) => {
          const st = states[i] ?? 'pending'
          const alcancavel = i <= maxReached
          const hint =
            st === 'current' ? 'em andamento' : st === 'done' ? 'completa' : st === 'attention' ? `${pendCounts[i] ?? 0} pendência${(pendCounts[i] ?? 0) === 1 ? '' : 's'}` : ''
          return (
            <li key={s.key} className="relative flex min-w-0 flex-col items-center">
              {i > 0 ? (
                <span
                  className={cn(
                    'absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2',
                    i <= maxReached ? 'bg-emerald-600/60' : 'bg-neutral-200 dark:bg-white/10',
                  )}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                disabled={!alcancavel}
                onClick={() => onSelect(i)}
                aria-current={i === current ? 'step' : undefined}
                className="relative z-10 flex min-w-0 max-w-full flex-col items-center gap-1 rounded-lg px-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">
                  {st === 'current' ? <span className="gmud-trail-halo absolute inset-0 rounded-full bg-primary/50" aria-hidden /> : null}
                  <span className={cn('relative flex size-7 items-center justify-center rounded-full text-xs font-bold', DOT[st])} aria-hidden>
                    {st === 'done' ? <Check size={14} strokeWidth={3} /> : st === 'attention' ? <AlertTriangle size={13} /> : i + 1}
                  </span>
                </span>
                <span className={cn('text-xs font-semibold', st === 'pending' ? 'text-on-surface-variant' : 'text-on-surface')}>{s.label}</span>
                <span
                  className={cn(
                    'max-w-full truncate text-[11px]',
                    st === 'current' ? 'font-semibold text-amber-700 dark:text-amber-300' : st === 'done' ? 'text-emerald-700 dark:text-emerald-300' : st === 'attention' ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-on-surface-variant/70',
                  )}
                >
                  {hint || ' '}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
