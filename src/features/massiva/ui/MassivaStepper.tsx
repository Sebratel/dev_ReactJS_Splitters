import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type MassivaStepId = 'rota' | 'splitters' | 'validacao' | 'abertura'

export type MassivaStepIndicatorStatus = 'current' | 'success' | 'warning' | 'error' | 'idle'

export type MassivaStepItem = {
  id: MassivaStepId
  title: string
  description: string
  status: MassivaStepIndicatorStatus
}

type MassivaStepperProps = {
  currentStep: MassivaStepId
  steps: MassivaStepItem[]
  onStepChange: (step: MassivaStepId) => void
}

function StepIcon({ status }: { status: MassivaStepIndicatorStatus }) {
  if (status === 'success') {
    return <CheckCircle2 size={16} aria-hidden />
  }
  if (status === 'warning' || status === 'error') {
    return <AlertTriangle size={16} aria-hidden />
  }
  return <Circle size={16} aria-hidden />
}

export function MassivaStepper({
  currentStep,
  steps,
  onStepChange,
}: MassivaStepperProps) {
  return (
    <nav aria-label="Etapas da abertura de massiva">
      <ol className="grid auto-rows-fr gap-2 sm:grid-cols-2 min-[1700px]:grid-cols-4">
        {steps.map((step, index) => {
          const isCurrent = currentStep === step.id
          const toneClass =
            step.status === 'success'
              ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
              : step.status === 'warning'
                ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
                : step.status === 'error'
                  ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                  : isCurrent
                    ? 'border-sky-300 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 shadow-sm'
                    : 'border-neutral-200 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant'

          return (
            <li key={step.id} className="min-w-0 h-full">
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                className={cn(
                  'flex h-full w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50',
                  toneClass,
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 bg-surface-container-lowest/70">
                  <StepIcon status={isCurrent ? 'current' : step.status} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                    Etapa {index + 1}
                  </span>
                  <span className="mt-1 block min-h-[20px] text-sm font-semibold">{step.title}</span>
                  <span className="mt-0.5 block min-h-[34px] text-xs leading-relaxed opacity-80">
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
