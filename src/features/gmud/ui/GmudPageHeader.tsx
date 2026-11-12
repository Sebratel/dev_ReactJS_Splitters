import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Cabeçalho compacto das telas da GMUD: ícone + título + subtítulo e as ações da tela à direita.
 * A cor de destaque fica só na ação principal da tela; "voltar" é um link discreto, não um botão.
 */
export function GmudPageHeader({
  title,
  subtitle,
  icon: Icon,
  backTo,
  actions,
  className,
}: {
  title: string
  subtitle?: ReactNode
  icon: LucideIcon
  /** Quando a tela é filha da lista (nova, detalhe, indicadores, configurações). */
  backTo?: { to: string; label: string }
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('min-w-0 space-y-1.5', className)}>
      {backTo ? (
        <Link
          to={backTo.to}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-on-surface-variant transition hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ChevronLeft size={14} aria-hidden /> {backTo.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary ring-1 ring-neutral-200/70 dark:ring-white/10">
            <Icon size={20} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-on-surface">{title}</h1>
            {subtitle ? <p className="truncate text-xs text-on-surface-variant sm:text-sm">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
