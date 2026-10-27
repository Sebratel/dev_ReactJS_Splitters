import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useToastStore, type ToastTone } from '@/shared/store/toastStore'

const TONE_STYLES: Record<ToastTone, { wrap: string; icon: string; Icon: React.ElementType }> = {
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-950/60',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  error: {
    wrap: 'border-red-200 bg-red-50 dark:border-red-700/50 dark:bg-red-950/60',
    icon: 'text-red-600 dark:text-red-400',
    Icon: AlertCircle,
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/60',
    icon: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    wrap: 'border-blue-200 bg-blue-50 dark:border-blue-700/50 dark:bg-blue-950/60',
    icon: 'text-blue-600 dark:text-blue-400',
    Icon: Info,
  },
}

export function ToastStack() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-4 z-[100] flex flex-col gap-2 sm:right-6">
      {toasts.map((t) => {
        const { wrap, icon, Icon } = TONE_STYLES[t.tone]
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${wrap} animate-in slide-in-from-bottom-4 fade-in duration-200 max-w-sm`}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${icon}`} />
            <p className="flex-1 text-sm font-medium text-on-surface leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-on-surface-variant/60 transition hover:text-on-surface"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
