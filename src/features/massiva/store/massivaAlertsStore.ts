import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type MassivaAlertToastKind = 'new' | 'near' | 'expired'

export type MassivaAlertToast = {
  id: string
  kind: MassivaAlertToastKind
  protocol: number
  title: string
  at: number
}

type MassivaAlertsState = {
  /** Alertas sonoros ligados. Persistido. */
  enabled: boolean
  /** Minutos antes da previsão para o alerta "perto de vencer". Persistido. */
  nearMinutes: number
  /** Toasts visuais ativos (não persistidos). */
  toasts: MassivaAlertToast[]
  setEnabled: (value: boolean) => void
  toggleEnabled: () => void
  setNearMinutes: (value: number) => void
  pushToast: (toast: Omit<MassivaAlertToast, 'id' | 'at'>) => void
  dismissToast: (id: string) => void
}

export const useMassivaAlertsStore = create<MassivaAlertsState>()(
  persist(
    (set) => ({
      enabled: false,
      nearMinutes: 30,
      toasts: [],
      setEnabled: (enabled) => set({ enabled }),
      toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
      setNearMinutes: (nearMinutes) => set({ nearMinutes }),
      pushToast: (toast) =>
        set((s) => ({
          toasts: [
            ...s.toasts,
            { ...toast, id: `${toast.kind}-${toast.protocol}-${Date.now()}`, at: Date.now() },
          ].slice(-4),
        })),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'nexaview.massiva.sound-alerts.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ enabled: s.enabled, nearMinutes: s.nearMinutes }),
    },
  ),
)
