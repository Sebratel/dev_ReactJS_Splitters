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

/** Chave estável de uma rota (para não repetir na lista). */
export function escopoRotaKey(escopo: GmudEscopoRede): string {
  return JSON.stringify(normalizeEscopoRede(escopo))
}

/** Lista de rotas limpa para gravar: sem vazias nem repetidas. Vazia = site inteiro. */
export function normalizeEscopoRotas(rotas: readonly GmudEscopoRede[] | null | undefined): GmudEscopoRede[] {
  const seen = new Set<string>()
  const out: GmudEscopoRede[] = []
  for (const r of rotas ?? []) {
    const n = normalizeEscopoRede(r)
    if (!n) continue
    const key = JSON.stringify(n)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  return out
}

/** Rotas de uma GMUD já gravada: `escopoRotas` (lista) ou, nas antigas, o `escopoRede` único. */
export function rotasFromCategoriaData(
  data: { escopoRotas?: GmudEscopoRede[]; escopoRede?: GmudEscopoRede } | null | undefined,
): GmudEscopoRede[] {
  if (!data) return []
  if (Array.isArray(data.escopoRotas)) return normalizeEscopoRotas(data.escopoRotas)
  return normalizeEscopoRotas(data.escopoRede ? [data.escopoRede] : [])
}

/** Uma frase por rota, separadas por "; ". */
export function formatEscopoRotas(rotas: readonly GmudEscopoRede[] | null | undefined): string {
  return normalizeEscopoRotas(rotas).map((r) => formatEscopoRede(r)).filter((t) => t !== '').join('; ')
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
