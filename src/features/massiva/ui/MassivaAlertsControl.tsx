import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertOctagon, Clock, Megaphone, Volume2, VolumeX, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { useMassivaAlerts } from '@/features/massiva/hooks/useMassivaAlerts'
import {
  useMassivaAlertsStore,
  type MassivaAlertToast,
} from '@/features/massiva/store/massivaAlertsStore'
import { playMassivaAlert, primeMassivaAudio } from '@/features/massiva/lib/massivaAlertSound'

const TOAST_META: Record<
  MassivaAlertToast['kind'],
  { Icon: typeof Clock; cls: string; accent: string }
> = {
  new: {
    Icon: Megaphone,
    cls: 'border-sky-300/70 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/50',
    accent: 'text-sky-700 dark:text-sky-200',
  },
  near: {
    Icon: Clock,
    cls: 'border-amber-300/70 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/50',
    accent: 'text-amber-800 dark:text-amber-100',
  },
  expired: {
    Icon: AlertOctagon,
    cls: 'border-rose-300/70 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/50',
    accent: 'text-rose-700 dark:text-rose-200',
  },
}

function ToastCard({ toast, onClose }: { toast: MassivaAlertToast; onClose: () => void }) {
  const meta = TOAST_META[toast.kind]
  useEffect(() => {
    const id = window.setTimeout(onClose, 9_000)
    return () => window.clearTimeout(id)
  }, [onClose])
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg',
        meta.cls,
      )}
      role="status"
    >
      <meta.Icon className={cn('mt-0.5 size-4 shrink-0', meta.accent)} aria-hidden />
      <div className="min-w-0">
        <p className={cn('text-xs font-bold', meta.accent)}>{toast.title}</p>
        <p className="text-[11px] text-on-surface-variant">
          Protocolo <span className="font-mono font-semibold">{toast.protocol}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-1 shrink-0 rounded-md p-0.5 text-on-surface-variant/60 transition hover:bg-white/40 dark:hover:bg-white/10 hover:text-on-surface-variant"
        aria-label="Fechar alerta"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** Só o stack de toasts de alerta (portal, canto inferior). Reutilizável. */
export function MassivaAlertToasts() {
  const toasts = useMassivaAlertsStore((s) => s.toasts)
  const dismissToast = useMassivaAlertsStore((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => dismissToast(t.id)} />
      ))}
    </div>,
    document.body,
  )
}

function MassivaAlertsActive() {
  useMassivaAlerts(true)
  const enabled = useMassivaAlertsStore((s) => s.enabled)
  const setEnabled = useMassivaAlertsStore((s) => s.setEnabled)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void primeMassivaAudio()
          const next = !enabled
          setEnabled(next)
          if (next) playMassivaAlert('test')
        }}
        aria-pressed={enabled}
        title={
          enabled
            ? 'Alertas sonoros de massiva ligados — clique para desligar'
            : 'Ativar alertas sonoros de massiva (nova, perto de vencer, vencida)'
        }
        aria-label="Alertas sonoros de massiva"
        className={cn(
          'flex size-10 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
          enabled
            ? 'text-amber-600 dark:text-amber-300 hover:bg-surface-container-low'
            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
        )}
      >
        {enabled ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
      </button>

      <MassivaAlertToasts />
    </>
  )
}

/**
 * Controle de alertas sonoros de massiva no topo — botão liga/desliga + toasts.
 * Só para quem tem permissão de massiva; a detecção roda app-wide enquanto montado.
 */
export function MassivaAlertsControl() {
  const canView = useAccessAuthStore((s) => s.hasPermission('canViewMassiva'))
  if (!canView) return null
  return <MassivaAlertsActive />
}
