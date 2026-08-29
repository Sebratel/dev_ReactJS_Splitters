/**
 * Textos de situação do Elleven → aberto vs encerrado/cancelado (listagem costuma variar o nome do campo).
 */

export const ELLEVEN_CLOSED_STATUS_TEXT_RE =
  /encerr|fechad|fechado|finaliz|resolv|conclu[ií]d|cancelad|cancel|anulad|arquiv|solucion|atendid|inativ|close[d]?|closed|rejeitad|desist/i

/**
 * Subconjunto de "encerrado" que representa CANCELAMENTO (distinto de resolução).
 * Usado para classificar o status como `cancelada` em vez de `encerrada`.
 */
export const ELLEVEN_CANCELLED_STATUS_TEXT_RE = /cancelad|cancel|anulad|desist/i

export const ELLEVEN_OPEN_STATUS_TEXT_RE =
  /(^|\s)(abert[ao]?|open)(\s|$)|em\s+aberto/i

export function normalizeEllevenStatusText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().toLowerCase()
}

export function ellevenStatusTextIndicatesClosed(text: string): boolean {
  const s = normalizeEllevenStatusText(text)
  if (s === '') return false
  return ELLEVEN_CLOSED_STATUS_TEXT_RE.test(s)
}

export function ellevenStatusTextIndicatesOpen(text: string): boolean {
  const s = normalizeEllevenStatusText(text)
  if (s === '') return false
  if (ellevenStatusTextIndicatesClosed(s)) return false
  return (
    ELLEVEN_OPEN_STATUS_TEXT_RE.test(s) ||
    s.includes('andamento') ||
    s.includes('progress')
  )
}

export function ellevenStatusTextsIndicateClosed(texts: readonly string[]): boolean {
  return texts.some(ellevenStatusTextIndicatesClosed)
}

export function ellevenStatusTextIndicatesCancelled(text: string): boolean {
  const s = normalizeEllevenStatusText(text)
  if (s === '') return false
  return ELLEVEN_CANCELLED_STATUS_TEXT_RE.test(s)
}

export function ellevenStatusTextsIndicateCancelled(texts: readonly string[]): boolean {
  return texts.some(ellevenStatusTextIndicatesCancelled)
}

export function ellevenStatusTextsIndicateOpen(texts: readonly string[]): boolean {
  return texts.some(ellevenStatusTextIndicatesOpen)
}
