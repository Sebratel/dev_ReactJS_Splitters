/**
 * Título legível da GMUD. Os títulos do Elleven repetem o protocolo, o tipo de solicitação e o
 * solicitante ("Protocolo 1846364 - Gestão de Mudança de Rede / GMUD - Lucas Scheuer"). Remove esse
 * ruído e devolve só o que descreve a mudança; se não sobrar nada, devolve "GMUD sem descrição".
 */
export function cleanGmudTitle(title: string, protocol?: number | null, requester?: string | null): string {
  let t = String(title ?? '').trim()
  if (t === '') return 'GMUD sem descrição'

  t = t.replace(/^protocolo\s*\d+\s*[-–—:]\s*/i, '')
  if (protocol) t = t.replace(new RegExp(`\\b${protocol}\\b\\s*[-–—]?\\s*`, 'g'), '')
  t = t.replace(/gest[aã]o de mudan[cç]a de rede\s*(\/\s*gmud)?\s*[-–—]?\s*/i, '')
  t = t.replace(/^gmud\s*[-–—:]\s*/i, '')

  const req = String(requester ?? '').trim()
  if (req !== '') {
    const parts = req.split(/\s+/)
    const variants = [req, `${parts[0]} ${parts[parts.length - 1]}`, parts[0]]
    for (const v of variants) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      t = t.replace(new RegExp(`\\s*[-–—]\\s*${escaped}\\s*$`, 'i'), '')
      t = t.replace(new RegExp(`^${escaped}\\s*$`, 'i'), '')
    }
  }
  t = t.replace(/^[\s\-–—/:]+|[\s\-–—/:]+$/g, '').trim()
  return t === '' ? 'GMUD sem descrição' : t
}

/** Linha que é só um rótulo de formulário ("DESCRIÇÃO DA MANUTENÇÃO:", "Objetivo:"). */
function isLabelLine(line: string): boolean {
  if (!line.endsWith(':')) return false
  const body = line.slice(0, -1)
  return body.length <= 30 || body === body.toUpperCase()
}

/**
 * Título para exibição: o título limpo; se ele não disser nada ("GMUD sem descrição"), usa o
 * começo da descrição do protocolo (já em texto simples).
 */
export function gmudDisplayTitle(input: {
  title: string
  protocol?: number | null
  requester?: string | null
  descriptionText?: string | null
}): string {
  const cleaned = cleanGmudTitle(input.title, input.protocol, input.requester)
  if (cleaned !== 'GMUD sem descrição') return cleaned
  const firstLine = String(input.descriptionText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l !== '' && !isLabelLine(l))
  if (!firstLine) return cleaned
  return firstLine.length > 110 ? `${firstLine.slice(0, 107).trimEnd()}…` : firstLine
}
