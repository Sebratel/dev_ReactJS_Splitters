import { AlertTriangle, Check, Minus, X } from 'lucide-react'
import type { TrailState, TrailStep } from '@/features/gmud/lib/gmudStatusTrail'
import { cn } from '@/shared/lib/utils'

/** Intervalo entre um passo e o seguinte na animação de entrada. */
const STEP_MS = 300

const DOT: Record<TrailState, string> = {
  done: 'bg-emerald-600 text-white',
  current: 'bg-primary text-neutral-900',
  pending: 'bg-surface-container-low text-on-surface-variant ring-1 ring-neutral-300/80 dark:ring-white/15',
  failed: 'bg-rose-600 text-white',
  skipped: 'bg-surface-container-low text-on-surface-variant/70 ring-1 ring-neutral-200/70 dark:ring-white/10',
}

const HINT: Record<TrailState, string> = {
  done: 'text-on-surface-variant',
  current: 'text-primary font-semibold',
  pending: 'text-on-surface-variant/70',
  failed: 'text-rose-600 dark:text-rose-300 font-semibold',
  skipped: 'text-on-surface-variant/70',
}

function Dot({ state, index }: { state: TrailState; index: number }) {
  return (
    <span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-bold', DOT[state])} aria-hidden>
      {state === 'done' ? <Check size={14} /> : state === 'failed' ? <X size={14} /> : state === 'skipped' ? <Minus size={14} /> : index + 1}
    </span>
  )
}

/** Onde a GMUD está, em 5 passos; "Áreas" e "Comitê" decidem em paralelo. */
export function GmudStatusTrail({ steps, notice }: { steps: TrailStep[]; notice?: string | null }) {
  return (
    <section className="rounded-2xl border border-neutral-200/90 bg-surface-container-lowest p-4 dark:border-white/10" aria-label="Situação da GMUD">
      <ol className="grid grid-cols-5 gap-1">
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex min-w-0 flex-col items-center gap-1 text-center">
            {i > 0 ? (
              <span
                className={cn(
                  'gmud-trail-line absolute right-1/2 top-3.5 h-px w-full -translate-y-1/2',
                  steps[i - 1]?.state === 'done' ? 'bg-emerald-600/60' : 'bg-neutral-200 dark:bg-white/10',
                )}
                style={{ '--d': `${(i - 1) * STEP_MS + 150}ms` } as React.CSSProperties}
                aria-hidden
              />
            ) : null}
            <span className="relative z-10">
              {s.state === 'current' ? (
                <span
                  className="gmud-trail-halo absolute inset-0 rounded-full bg-primary/50"
                  style={{ '--d': `${steps.length * STEP_MS}ms` } as React.CSSProperties}
                  aria-hidden
                />
              ) : null}
              <span className="gmud-trail-dot relative block" style={{ '--d': `${i * STEP_MS}ms` } as React.CSSProperties}>
                <Dot state={s.state} index={i} />
              </span>
            </span>
            <span
              className="gmud-trail-label flex min-w-0 max-w-full flex-col items-center gap-1"
              style={{ '--d': `${i * STEP_MS + 200}ms` } as React.CSSProperties}
            >
              <span className={cn('text-xs font-semibold', s.state === 'pending' || s.state === 'skipped' ? 'text-on-surface-variant' : 'text-on-surface')}>
                {s.label}
              </span>
              <span className={cn('max-w-full truncate text-[11px]', HINT[s.state])} title={s.hint}>{s.hint}</span>
            </span>
          </li>
        ))}
      </ol>
      {notice ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          {notice}
        </p>
      ) : null}
    </section>
  )
}
