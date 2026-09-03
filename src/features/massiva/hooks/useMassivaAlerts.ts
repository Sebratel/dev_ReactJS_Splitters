import { useEffect, useRef, useState } from 'react'
import { useHomeDashboardMassivaOpen } from '@/features/massiva/hooks/useHomeDashboardMassivaOpen'
import { useMassivaAlertsStore } from '@/features/massiva/store/massivaAlertsStore'
import { playMassivaAlert } from '@/features/massiva/lib/massivaAlertSound'

/**
 * Observa as massivas abertas e dispara alertas (som + toast) quando:
 * nova massiva aberta, perto de vencer (janela `nearMinutes`) e ao vencer o prazo.
 * Sempre rastreia o estado (evita alertar histórico ao ligar); só toca quando ligado.
 */
export function useMassivaAlerts(active: boolean): void {
  const enabled = useMassivaAlertsStore((s) => s.enabled)
  const nearMinutes = useMassivaAlertsStore((s) => s.nearMinutes)
  const pushToast = useMassivaAlertsStore((s) => s.pushToast)
  const { openMassivas } = useHomeDashboardMassivaOpen()

  const stateRef = useRef({
    initialized: false,
    known: new Set<number>(),
    near: new Set<number>(),
    expired: new Set<number>(),
  })

  // Reavalia "perto de vencer"/"vencida" com o tempo, mesmo sem mudança nos dados.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setTick((x) => x + 1), 30_000)
    return () => window.clearInterval(id)
  }, [active])

  useEffect(() => {
    if (!active) return
    const st = stateRef.current
    const now = Date.now()
    const nearMs = Math.max(1, nearMinutes) * 60_000

    // 1ª passada: marca o estado atual sem alertar (não dispara p/ o que já existia).
    if (!st.initialized) {
      for (const t of openMassivas) {
        st.known.add(t.protocol)
        const exp = t.expectedCloseAt?.getTime() ?? null
        if (exp != null) {
          if (exp - now <= 0) {
            st.expired.add(t.protocol)
            st.near.add(t.protocol)
          } else if (exp - now <= nearMs) {
            st.near.add(t.protocol)
          }
        }
      }
      st.initialized = true
      return
    }

    for (const t of openMassivas) {
      const isNew = !st.known.has(t.protocol)
      if (isNew) {
        st.known.add(t.protocol)
        if (enabled) {
          playMassivaAlert('new')
          pushToast({ kind: 'new', protocol: t.protocol, title: 'Nova massiva aberta' })
        }
      }

      const exp = t.expectedCloseAt?.getTime() ?? null
      if (exp == null) continue
      const diff = exp - now
      if (diff <= 0) {
        if (!st.expired.has(t.protocol)) {
          st.expired.add(t.protocol)
          st.near.add(t.protocol)
          // Não duplica com o "nova" no mesmo ciclo (previsão padrão é +4h).
          if (enabled && !isNew) {
            playMassivaAlert('expired')
            pushToast({ kind: 'expired', protocol: t.protocol, title: 'Massiva venceu o prazo' })
          }
        }
      } else if (diff <= nearMs) {
        if (!st.near.has(t.protocol)) {
          st.near.add(t.protocol)
          if (enabled && !isNew) {
            playMassivaAlert('near')
            pushToast({ kind: 'near', protocol: t.protocol, title: 'Massiva perto de vencer' })
          }
        }
      }
    }

    // Limpa protocolos que saíram das abertas (encerrados/cancelados).
    const openSet = new Set(openMassivas.map((t) => t.protocol))
    for (const set of [st.known, st.near, st.expired]) {
      for (const p of [...set]) if (!openSet.has(p)) set.delete(p)
    }
  }, [openMassivas, enabled, nearMinutes, active, tick, pushToast])
}
