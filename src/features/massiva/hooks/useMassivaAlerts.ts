import { useEffect, useRef, useState } from 'react'
import { useHomeDashboardMassivaOpen } from '@/features/massiva/hooks/useHomeDashboardMassivaOpen'
import { useMassivaAlertsStore } from '@/features/massiva/store/massivaAlertsStore'
import { playMassivaAlert } from '@/features/massiva/lib/massivaAlertSound'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/**
 * Observa as massivas abertas e dispara alertas (som + toast) quando:
 * nova massiva aberta, perto de vencer (janela `nearMinutes`) e ao vencer o prazo.
 * Sempre rastreia o estado (evita alertar histórico ao ligar); só toca quando ligado.
 */
export function useMassivaAlerts(
  active: boolean,
  options?: { sound?: boolean; toast?: boolean; source?: MassivaTicket[] },
): void {
  const enabled = useMassivaAlertsStore((s) => s.enabled)
  const nearMinutes = useMassivaAlertsStore((s) => s.nearMinutes)
  const pushToast = useMassivaAlertsStore((s) => s.pushToast)
  // Quando o chamador passa uma `source` (ex.: o painel de parede já busca as
  // massivas abertas a cada 8s), o alerta observa EXATAMENTE esses dados — bipa
  // no mesmo instante em que o card aparece. Aí o hook interno (mais lento, 15s)
  // fica desligado para não duplicar busca.
  const source = options?.source
  const internal = useHomeDashboardMassivaOpen({ enabled: source == null })
  const openMassivas = source ?? internal.openMassivas
  // Som segue o toggle; toast pode ser forçado (ex.: painel de parede sempre mostra).
  const playSound = options?.sound ?? enabled
  const showToast = options?.toast ?? enabled

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
        if (playSound) playMassivaAlert('new')
        if (showToast) pushToast({ kind: 'new', protocol: t.protocol, title: 'Nova massiva aberta' })
      }

      const exp = t.expectedCloseAt?.getTime() ?? null
      if (exp == null) continue
      const diff = exp - now
      if (diff <= 0) {
        if (!st.expired.has(t.protocol)) {
          st.expired.add(t.protocol)
          st.near.add(t.protocol)
          // Não duplica com o "nova" no mesmo ciclo (previsão padrão é +4h).
          if (!isNew) {
            if (playSound) playMassivaAlert('expired')
            if (showToast) pushToast({ kind: 'expired', protocol: t.protocol, title: 'Massiva venceu o prazo' })
          }
        }
      } else if (diff <= nearMs) {
        if (!st.near.has(t.protocol)) {
          st.near.add(t.protocol)
          if (!isNew) {
            if (playSound) playMassivaAlert('near')
            if (showToast) pushToast({ kind: 'near', protocol: t.protocol, title: 'Massiva perto de vencer' })
          }
        }
      } else {
        // Voltou a ter folga (previsão empurrada) → rearma para bipar de novo
        // caso reentre no risco. No fluxo natural do tempo isto nunca acontece.
        st.near.delete(t.protocol)
        st.expired.delete(t.protocol)
      }
    }

    // Limpa protocolos que saíram das abertas (encerrados/cancelados).
    const openSet = new Set(openMassivas.map((t) => t.protocol))
    for (const set of [st.known, st.near, st.expired]) {
      for (const p of [...set]) if (!openSet.has(p)) set.delete(p)
    }
  }, [openMassivas, playSound, showToast, nearMinutes, active, tick, pushToast])
}
