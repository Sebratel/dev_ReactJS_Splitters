/**
 * Textos de situação do Elleven → aberto vs encerrado/cancelado (listagem costuma variar o nome do campo).
 */

export const ELLEVEN_CLOSED_STATUS_TEXT_RE =
  /encerr|fechad|fechado|finaliz|resolv|conclu[ií]d|cancelad|cancel|anulad|arquiv|solucion|atendid|inativ|close[d]?|closed|rejeitad|desist/i

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

export function ellevenStatusTextsIndicateOpen(texts: readonly string[]): boolean {
  return texts.some(ellevenStatusTextIndicatesOpen)
}
