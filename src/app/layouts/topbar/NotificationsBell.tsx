import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, ShieldCheck, Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAppNotifications, type AppNotificationTone } from '@/features/notifications/useAppNotifications'

const toneStyles: Record<AppNotificationTone, { tile: string; icon: typeof Bell }> = {
  danger: { tile: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300', icon: AlertTriangle },
  warning: { tile: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300', icon: AlertTriangle },
  info: { tile: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300', icon: ShieldCheck },
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { items, total } = useAppNotifications()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={total > 0 ? `${total} notificações` : 'Notificações'}
        className="relative flex size-10 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Bell className="size-5" strokeWidth={2} aria-hidden />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-surface-container-lowest">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 px-4 py-3">
              <p className="text-sm font-bold text-on-surface">Notificações</p>
              {total > 0 && (
                <span className="rounded-full bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-300">
                  {total}
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300">
                  <Check className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-on-surface">Tudo em dia</p>
                <p className="text-xs text-on-surface-variant">Nenhuma pendência precisa da sua atenção.</p>
              </div>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-neutral-100 dark:divide-white/5 overflow-y-auto">
                {items.map((item) => {
                  const tone = toneStyles[item.tone]
                  const Icon = tone.icon
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-container-low"
                      >
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone.tile)}>
                          <Icon className="size-4.5" strokeWidth={2} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-on-surface">{item.title}</span>
                          <span className="block text-xs text-on-surface-variant">{item.description}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-neutral-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-on-surface-variant">
                          {item.count}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
