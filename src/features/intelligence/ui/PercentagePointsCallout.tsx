import { CircleHelp } from 'lucide-react'
import { PP_TOOLTIP } from '@/features/intelligence/lib/percentagePointsHelp'
import { cn } from '@/shared/lib/utils'

type PercentagePointsCalloutProps = {
  periodLabel?: string
  className?: string
}

export function PercentagePointsCallout({ periodLabel, className }: PercentagePointsCalloutProps) {
  const periodHint =
    periodLabel != null
      ? ` O ${periodLabel} usa a ocupação de hoje menos a de ~${periodLabel === 'Δ7d' ? '7' : '30'} dias atrás (histórico de snapshots).`
      : ''

  return (
    <div
      className={cn(
        'flex gap-2 rounded-xl border border-sky-200/80 dark:border-sky-800/50 bg-sky-50/70 dark:bg-sky-950/40 px-2.5 py-2 text-[11px] leading-relaxed text-on-surface-variant',
        className,
      )}
      title={PP_TOOLTIP}
    >
      <CircleHelp size={14} className="mt-0.5 shrink-0 text-sky-700 dark:text-sky-200" aria-hidden />
      <p>
        <span className="font-semibold text-sky-950 dark:text-sky-100">pp = pontos percentuais</span> — quanto a ocupação subiu ou
        desceu na escala de 0–100%, somando ou subtraindo direto. Ex.:{' '}
        <span className="font-semibold text-on-surface">70% → 78% = +8 pp</span> (não é “+11% em cima de 70%”).
        {periodHint} Se aparecer <span className="font-semibold">0,00 pp</span>, a ocupação não mudou no histórico
        disponível — não significa 0% de uso.
      </p>
    </div>
  )
}
