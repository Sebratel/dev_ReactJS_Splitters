const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

/**
 * Converte a descrição HTML do Elleven em texto simples (sem renderizar HTML): quebras de
 * parágrafo/linha viram "\n", tags somem e as entidades comuns são decodificadas.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  let t = String(html ?? '')
  if (t.trim() === '') return ''
  t = t.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  t = t.replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
  t = t.replace(/<\s*li[^>]*>/gi, '• ')
  t = t.replace(/<[^>]*>/g, '')
  t = t.replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
  t = t.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
  return t
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
