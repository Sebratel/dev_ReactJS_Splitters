/**
 * Afunilamento da GMUD de Rede Externa dentro do POP/Site: ponto de acesso → slot → PON → splitter.
 * Tudo é opcional; sem ponto de acesso a GMUD vale para o site inteiro (comportamento anterior).
 * Persistido em `categoria_data.escopoRede` (sem coluna nova no banco).
 */
export type GmudEscopoSplitter = { code: string; title: string }

export type GmudEscopoRede = {
  apCode: string
  apTitle: string
  /** null = todos os slots do ponto de acesso. */
  slot: number | null
  /** Vazio = todas as PONs do slot. */
  ports: number[]
  /** Vazio = todos os splitters. */
  splitters: GmudEscopoSplitter[]
}

export function emptyEscopoRede(): GmudEscopoRede {
  return { apCode: '', apTitle: '', slot: null, ports: [], splitters: [] }
}

/** O filtro só existe a partir do ponto de acesso; slot/PON/splitter dependem dele. */
export function hasEscopoRede(escopo: GmudEscopoRede | null | undefined): escopo is GmudEscopoRede {
  return escopo != null && escopo.apCode.trim() !== ''
}

/** Limpa o filtro para gravar: remove valores vazios e repetidos, ordena PONs. */
export function normalizeEscopoRede(escopo: GmudEscopoRede | null | undefined): GmudEscopoRede | null {
  if (!hasEscopoRede(escopo)) return null
  const slot = escopo.slot != null && Number.isFinite(escopo.slot) ? escopo.slot : null
  const ports = slot === null ? [] : [...new Set(escopo.ports.filter((p) => Number.isFinite(p)))].sort((a, b) => a - b)
  const seen = new Set<string>()
  const splitters = escopo.splitters
    .map((s) => ({ code: s.code.trim(), title: s.title.trim() }))
    .filter((s) => s.code !== '' && !seen.has(s.code) && seen.add(s.code))
  return {
    apCode: escopo.apCode.trim(),
    apTitle: escopo.apTitle.trim() || escopo.apCode.trim(),
    slot,
    ports,
    splitters,
  }
}

/** Texto curto para telas, e-mail e máscara do Elleven. Ex.: "OLT-01 · Slot 2 · PON 4, 5 · Splitters: A, B". */
export function formatEscopoRede(escopo: GmudEscopoRede | null | undefined): string {
  const e = normalizeEscopoRede(escopo)
  if (!e) return ''
  const parts = [e.apTitle]
  if (e.slot !== null) parts.push(`Slot ${e.slot}`)
  if (e.ports.length > 0) parts.push(`${e.ports.length > 1 ? 'PONs' : 'PON'} ${e.ports.join(', ')}`)
  if (e.splitters.length > 0) {
    parts.push(`${e.splitters.length > 1 ? 'Splitters' : 'Splitter'}: ${e.splitters.map((s) => s.title || s.code).join(', ')}`)
  }
  return parts.join(' · ')
}
