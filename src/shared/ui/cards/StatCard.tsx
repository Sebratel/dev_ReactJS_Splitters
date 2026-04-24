import { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  description?: string
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
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'group flex h-full min-h-[118px] min-w-0 flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)] sm:p-[1.125rem]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200/80 transition-colors group-hover:bg-neutral-50 group-hover:text-neutral-800"
          aria-hidden
        >
          <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" strokeWidth={1.75} />
        </div>
        {trend != null ? (
          <div className="flex max-w-[min(100%,10.5rem)] flex-col items-end gap-0.5 text-right">
            <span
              className="shrink-0 rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-neutral-600"
              title={trend.label}
            >
              {trend.value === 0
                ? '0%'
                : `${trend.value > 0 ? '↑' : '↓'} ${Math.abs(trend.value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            </span>
            {trend.label ? (
              <span className="text-[9px] font-medium leading-tight text-neutral-400">{trend.label}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 pt-3">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 sm:text-[1.65rem] sm:leading-none">
          {value}
        </p>
        <h3 className="mt-1.5 text-[10px] font-semibold uppercase leading-snug tracking-[0.08em] text-neutral-500 sm:text-[11px]">
          {label}
        </h3>
        {description ? (
          <p className="mt-1 text-[10px] font-medium leading-snug text-neutral-400">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
