/**
 * Extrai o bloco do título de um splitter de condomínio.
 * Espelha `extractBlockFromTitle` em `server/condominiumClassifier.js` (ex.: "BL A", "BLOCO D").
 *
 * Ex.: "SLE-C-3919-3-2-10/7 - COND. RESIDENCIAL PREMIERE - BL A - 8°" → "A"
 */
const BLOCK_REGEX = /\bBL(?:OCO)?\s+([A-Z0-9]+)/i

export function extractBlockFromSplitterTitle(title: string | null | undefined): string | null {
  const match = String(title ?? '').match(BLOCK_REGEX)
  return match ? match[1].toUpperCase() : null
}
