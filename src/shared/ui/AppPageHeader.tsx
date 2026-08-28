import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type AppPageHeaderProps = {
  badge: string
  title: string
  description?: string
  /** Ícone opcional à esquerda (reforça o contexto do módulo). */
  icon?: LucideIcon
  /** Botão principal no tom âmbar (ex.: voltar ao painel ou listagem). */
  primaryAction?: {
    to: string
    label: string
    state?: LinkProps['state']
    replace?: boolean
  }
  /** Área à direita antes do botão principal: chips de status, resumos, links secundários. */
  trailing?: ReactNode
  className?: string
}

/**
 * Cabeçalho padronizado para páginas internas (fora do dashboard).
 * Layout: selo + título + descrição à esquerda; ações à direita.
 */
export function AppPageHeader({
  badge,
  title,
  description,
  icon: Icon,
  primaryAction,
  trailing,
  className,
}: AppPageHeaderProps) {
  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 dark:from-amber-950/20 via-white dark:via-surface-container-lowest to-amber-50/30 dark:to-amber-950/20 shadow-[0_4px_24px_-8px_rgba(180,83,9,0.18)] ring-1 ring-amber-100/80',
        'animate-in fade-in slide-in-from-top-2 zoom-in-[0.99] duration-300 ease-out',
        'motion-reduce:animate-none motion-reduce:opacity-100',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-72 rounded-full bg-yellow-200/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:py-5 xl:px-7">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          {Icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-amber-600/10 text-amber-900 dark:text-amber-200 shadow-inner ring-1 ring-amber-300/50 sm:h-12 sm:w-12">
              <Icon size={22} aria-hidden className="opacity-90" />
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            <span className="inline-flex items-center rounded-full border border-amber-200/80 dark:border-amber-800/50 bg-surface-container-lowest/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-900/90 shadow-sm backdrop-blur-sm">
              {badge}
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">{title}</h1>
            {description ? (
              <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant sm:text-sm md:block line-clamp-3 sm:line-clamp-none">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {(trailing != null || primaryAction != null) && (
          <div className="flex w-full min-w-0 shrink-0 flex-wrap items-stretch gap-3 sm:w-auto sm:items-center sm:justify-end">
            {trailing}
            {primaryAction ? (
              <Link
                to={primaryAction.to}
                replace={primaryAction.replace}
                state={primaryAction.state}
                aria-label={primaryAction.label}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full border border-amber-800/15 bg-amber-400 px-3 py-2.5 text-xs font-semibold text-neutral-900 shadow-sm transition hover:bg-amber-500 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
                title={primaryAction.label}
              >
                <ArrowLeft size={16} aria-hidden className="shrink-0 opacity-80" />
                <span className="inline max-w-[9.5rem] truncate sm:max-w-none">{primaryAction.label}</span>
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </header>
  )
}
