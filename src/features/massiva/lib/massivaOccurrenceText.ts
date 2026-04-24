/**
 * BFF: texto às vezes vem com tags HTML e escapes literais; prepara para leitura / PDF.
 */
export function preprocessOccurrenceTextForDisplay(raw: string): string {
  let t = raw
  t = t.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  t = t.replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '\n')
  t = t.replace(/&nbsp;/gi, ' ')
  t = t.replace(/&#(\d+);/g, (_m, dec) => {
    const n = Number.parseInt(String(dec), 10)
    if (!Number.isFinite(n)) return _m
    try {
      return String.fromCodePoint(n)
    } catch {
      return _m
    }
  })
  t = t.replace(/&amp;/g, '&')
  t = t.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  if (t.includes('\\u')) {
    t = t.replace(/\\u([0-9a-fA-F]{4})/g, (seq, hex) => {
      const code = Number.parseInt(hex, 16)
      if (!Number.isFinite(code) || code < 0) return seq
      if (code >= 0xd800 && code <= 0xdfff) return seq
      try {
        return String.fromCodePoint(code)
      } catch {
        return seq
      }
    })
  }
  t = t.replace(/[ \t]+$/gm, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

export function splitOccurrenceIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}
