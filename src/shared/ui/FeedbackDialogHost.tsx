import { useEffect, useRef } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useFeedbackDialogStore, type FeedbackVariant } from '@/shared/store/feedbackDialogStore'
import { cn } from '@/shared/lib/utils'

const STYLE: Record<FeedbackVariant, { ring: string; badge: string; Icon: React.ElementType; button: string }> = {
  success: {
    ring: 'ring-emerald-200 dark:ring-emerald-800/60',
    badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
    Icon: CheckCircle2,
    button: 'bg-emerald-600 hover:bg-emerald-700',
  },
  error: {
    ring: 'ring-red-200 dark:ring-red-800/60',
    badge: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
    Icon: AlertCircle,
    button: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    ring: 'ring-amber-200 dark:ring-amber-800/60',
    badge: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
    Icon: AlertTriangle,
    button: 'bg-primary hover:bg-primary/90',
  },
  info: {
    ring: 'ring-blue-200 dark:ring-blue-800/60',
    badge: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300',
    Icon: Info,
    button: 'bg-primary hover:bg-primary/90',
  },
}

/**
 * Popup centralizado para avisos de sucesso e erro. Montado uma vez no layout do app; as telas
 * chamam `showFeedbackDialog(...)`. Mensagens em sequência entram numa fila.
 */
export function FeedbackDialogHost() {
  const current = useFeedbackDialogStore((s) => s.queue[0])
  const close = useFeedbackDialogStore((s) => s.close)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const id = current?.id

  useEffect(() => {
    if (!id) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    primaryRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus?.()
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [id, close])

  if (!current) return null

  const { variant, title, message, items, primary, secondary } = current
  const { ring, badge, Icon, button } = STYLE[variant]
  const titleId = `feedback-title-${current.id}`
  const bodyId = `feedback-body-${current.id}`

  const run = (action?: { onClick?: () => void }) => {
    close()
    action?.onClick?.()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={() => close()} aria-hidden />
      <div
        role={variant === 'error' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message || items?.length ? bodyId : undefined}
        className={cn(
          'relative w-full max-w-md rounded-3xl border border-neutral-200/80 bg-surface-container-lowest p-6 shadow-2xl ring-1 dark:border-white/10',
          ring,
        )}
      >
        <button
          type="button"
          onClick={() => close()}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container-low"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <span className={cn('inline-flex size-12 items-center justify-center rounded-2xl', badge)} aria-hidden>
            <Icon size={26} />
          </span>
          <h2 id={titleId} className="mt-3 text-lg font-bold text-on-surface">{title}</h2>
          <div id={bodyId} className="mt-1.5 max-h-[50vh] w-full overflow-y-auto text-sm text-on-surface-variant">
            {message ? <p className="whitespace-pre-wrap leading-relaxed">{message}</p> : null}
            {items && items.length > 0 ? (
              <ul className="mt-2 space-y-1 rounded-xl bg-surface-container-low px-4 py-3 text-left text-sm text-on-surface">
                {items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {secondary ? (
            <button
              type="button"
              onClick={() => run(secondary)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-on-surface ring-1 ring-neutral-200 transition hover:bg-surface-container-low dark:ring-white/10"
            >
              {secondary.label}
            </button>
          ) : null}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => run(primary)}
            className={cn('rounded-xl px-5 py-2 text-sm font-bold text-white transition', button)}
          >
            {primary?.label ?? 'Entendi'}
          </button>
        </div>
      </div>
    </div>
  )
}
