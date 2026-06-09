import type { MassivaRouteSlotPortPair } from '@/features/massiva/model/massivaLocalPreview'
import {
  formatOltSlotPonPair,
  formatOltSlotWithPonNumbers,
} from '@/shared/lib/oltTopologyLabels'

export type MassivaRoutePairsSummary = {
  /** Texto curto para o botão/input. */
  display: string
  /** Lista completa (tooltip). */
  full: string
}

function groupPortsBySlot(
  pairs: readonly MassivaRouteSlotPortPair[],
): Map<number, number[]> {
  const bySlot = new Map<number, number[]>()
  for (const { slot, port } of pairs) {
    const list = bySlot.get(slot) ?? []
    if (!list.includes(port)) list.push(port)
    bySlot.set(slot, list)
  }
  for (const [slot, ports] of bySlot) {
    bySlot.set(
      slot,
      [...ports].sort((a, b) => a - b),
    )
  }
  return bySlot
}

/**
 * Resume pares slot/PON para o campo "Seleção múltipla".
 * Ex.: `Slot 1: 1, 2 · Slot 3: 4 · 5 comb.`
 */
export function formatMassivaRoutePairsSummary(
  pairs: readonly MassivaRouteSlotPortPair[],
  options?: { maxSlotsInDisplay?: number; maxPortsPerSlotInDisplay?: number },
): MassivaRoutePairsSummary {
  if (pairs.length === 0) {
    return { display: '', full: '' }
  }

  if (pairs.length === 1) {
    const only = pairs[0]
    const line = formatOltSlotPonPair(only.slot, only.port)
    return { display: line, full: line }
  }

  const bySlot = groupPortsBySlot(pairs)
  const slots = [...bySlot.keys()].sort((a, b) => a - b)
  const maxSlots = options?.maxSlotsInDisplay ?? 2
  const maxPorts = options?.maxPortsPerSlotInDisplay ?? 4

  const fullParts = slots.map((slot) =>
    formatOltSlotWithPonNumbers(slot, bySlot.get(slot) ?? [], Number.POSITIVE_INFINITY),
  )
  const full = `${fullParts.join(' · ')} (${pairs.length} combinações)`

  const shownSlots = slots.slice(0, maxSlots)
  const displayParts = shownSlots.map((slot) =>
    formatOltSlotWithPonNumbers(slot, bySlot.get(slot) ?? [], maxPorts),
  )

  const hiddenSlots = slots.length - shownSlots.length
  let display = displayParts.join(' · ')
  if (hiddenSlots > 0) {
    display += ` · +${hiddenSlots} slot(s)`
  }
  display += ` · ${pairs.length} comb.`

  return { display, full }
}
