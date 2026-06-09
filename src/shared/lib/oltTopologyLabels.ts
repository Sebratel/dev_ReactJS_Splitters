/** Rótulos de topologia OLT (não confundir com porta física do splitter/GeoGrid). */
export const OLT_SLOT_LABEL = 'Slot'
export const OLT_PON_LABEL = 'PON'

export function formatOltSlotPonPair(slot: number, pon: number): string {
  return `${OLT_SLOT_LABEL} ${slot} / ${OLT_PON_LABEL} ${pon}`
}

function formatPonNumbersList(pons: readonly number[], maxPonsShown: number): string {
  if (pons.length === 0) return '—'
  if (pons.length <= maxPonsShown) {
    return pons.join(', ')
  }
  const head = pons.slice(0, maxPonsShown - 1).join(', ')
  return `${head}, +${pons.length - (maxPonsShown - 1)}`
}

export function formatOltSlotWithPonNumbers(
  slot: number,
  pons: readonly number[],
  maxPonsShown: number,
): string {
  return `${OLT_SLOT_LABEL} ${slot}: ${formatPonNumbersList(pons, maxPonsShown)}`
}

/** Segmento em minúsculas para descrições técnicas e protocolos. */
export function formatOltTopologySegment(slot: number, pon: number): string {
  return `slot ${slot} / pon ${pon}`
}

export function formatOltTopologyDescriptionLine(input: {
  apCode: string
  apDisplayTitle: string
  slot: number
  pon: number
  splitterCount: number
}): string {
  const { apCode, apDisplayTitle, slot, pon, splitterCount } = input
  return `PA ${apCode} (${apDisplayTitle}) / ${formatOltTopologySegment(slot, pon)} / ${splitterCount} splitter(s)`
}
