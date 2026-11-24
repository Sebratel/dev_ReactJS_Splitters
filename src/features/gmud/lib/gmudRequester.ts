const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du'])

function titleCase(word: string): string {
  const lower = word.toLocaleLowerCase('pt-BR')
  return PARTICLES.has(lower) ? lower : lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
}

function significantTokens(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter((t) => t !== '')
}

/**
 * Nome curto para a lista: primeiro e último nome, com iniciais maiúsculas (o Voalle devolve em caixa alta).
 * "LUCAS EDUARDO SCHEUER" → "Lucas Scheuer"; "MISAEL GOMES DA CRUZ" → "Misael Cruz".
 */
export function shortRequesterName(name: string | null | undefined): string {
  const tokens = significantTokens(name ?? '')
  if (tokens.length === 0) return '—'
  const nonParticles = tokens.filter((t) => !PARTICLES.has(t.toLocaleLowerCase('pt-BR')))
  const usable = nonParticles.length > 0 ? nonParticles : tokens
  if (usable.length === 1) return titleCase(usable[0] as string)
  return `${titleCase(usable[0] as string)} ${titleCase(usable[usable.length - 1] as string)}`
}

/** Duas letras para o avatar: primeiro e último nome. */
export function requesterInitials(name: string | null | undefined): string {
  const tokens = significantTokens(name ?? '').filter((t) => !PARTICLES.has(t.toLocaleLowerCase('pt-BR')))
  if (tokens.length === 0) return '?'
  const first = tokens[0] as string
  const last = tokens.length > 1 ? (tokens[tokens.length - 1] as string) : ''
  return (first.charAt(0) + last.charAt(0)).toLocaleUpperCase('pt-BR')
}

/**
 * Posição da cor do avatar na paleta: sempre a mesma para a mesma pessoa (hash do e-mail ou do nome,
 * sem diferenciar maiúsculas). `size` é o tamanho da paleta.
 */
export function requesterAvatarIndex(key: string | null | undefined, size: number): number {
  if (!Number.isInteger(size) || size <= 0) return 0
  const text = (key ?? '').trim().toLocaleLowerCase('pt-BR')
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) hash = (hash * 33 + text.charCodeAt(i)) >>> 0
  return hash % size
}
