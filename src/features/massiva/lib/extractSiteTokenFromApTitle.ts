/**
 * Extrai o token do Site a partir do título do OLT/AP da rota.
 * O site costuma vir após o último "-": "OLT 04 - NHOPN" -> "NHOPN".
 * É só um candidato — deve ser validado no catálogo de sites antes de usar.
 */
export function extractSiteTokenFromApTitle(title: string | null | undefined): string {
  const t = String(title ?? '').trim()
  if (t === '') return ''
  const afterDash = t.includes('-') ? t.slice(t.lastIndexOf('-') + 1) : t
  const tokens = afterDash.trim().split(/\s+/).filter(Boolean)
  const last = tokens.length > 0 ? tokens[tokens.length - 1] : afterDash.trim()
  return last.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}
