import type { MassivaRouteRow } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'
import {
  buildMassivaRouteCatalogFromRows,
  listMassivaApCodes,
  listMassivaPortsForApSlot,
  listMassivaSlotsForAp,
  listMassivaSplittersForRoute,
} from '@/features/massiva/lib/buildMassivaRouteCatalog'
import type { MassivaRouteCatalog } from '@/features/massiva/model/massivaLocalPreview'
import type { GmudEscopoRede, GmudEscopoSplitter } from '@/features/gmud/model/gmudEscopoRede'

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

/** Rotas (AP/slot/PON/splitter) do POP/Site informado; comparação sem diferenciar caixa. */
export function routesForSite(rows: MassivaRouteRow[], popSite: string): MassivaRouteRow[] {
  const site = norm(popSite)
  if (site === '') return []
  return rows.filter((r) => norm(r.siteTitle) === site)
}

export type EscopoRedeOptions = {
  aps: { code: string; title: string }[]
  slots: number[]
  ports: number[]
  splitters: GmudEscopoSplitter[]
}

/** Splitters alcançáveis pelo recorte atual: AP inteiro, um slot ou só as PONs marcadas. */
function splittersInScope(catalog: MassivaRouteCatalog, escopo: GmudEscopoRede): GmudEscopoSplitter[] {
  const codes = new Set<string>()
  const slots = escopo.slot === null ? listMassivaSlotsForAp(catalog, escopo.apCode) : [escopo.slot]
  for (const slot of slots) {
    const ports = escopo.slot !== null && escopo.ports.length > 0 ? escopo.ports : listMassivaPortsForApSlot(catalog, escopo.apCode, slot)
    for (const port of ports) {
      for (const code of listMassivaSplittersForRoute(catalog, escopo.apCode, slot, port)) codes.add(code)
    }
  }
  return [...codes]
    .map((code) => ({ code, title: catalog.splitterTitles.get(code) ?? code }))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { numeric: true }))
}

/** Opções de cada nível da cascata, a partir das rotas do site e da escolha feita até aqui. */
export function buildEscopoRedeOptions(siteRows: MassivaRouteRow[], escopo: GmudEscopoRede): EscopoRedeOptions {
  const catalog = buildMassivaRouteCatalogFromRows(siteRows)
  const aps = listMassivaApCodes(catalog).map((code) => ({ code, title: catalog.apTitles.get(code) ?? code }))
  if (escopo.apCode === '') return { aps, slots: [], ports: [], splitters: [] }
  return {
    aps,
    slots: listMassivaSlotsForAp(catalog, escopo.apCode),
    ports: escopo.slot === null ? [] : listMassivaPortsForApSlot(catalog, escopo.apCode, escopo.slot),
    splitters: splittersInScope(catalog, escopo),
  }
}

/** Remove da escolha o que deixou de existir no recorte (ex.: trocou o slot e a PON marcada sumiu). */
export function pruneEscopoRede(escopo: GmudEscopoRede, options: EscopoRedeOptions): GmudEscopoRede {
  const ports = escopo.ports.filter((p) => options.ports.includes(p))
  const validSplitters = new Set(options.splitters.map((s) => s.code))
  return { ...escopo, ports, splitters: escopo.splitters.filter((s) => validSplitters.has(s.code)) }
}
