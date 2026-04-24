import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'
import type { TopologyIndices, ResolvedAutoIspRoute } from '@/features/autoisp/model/topology.types'

/**
 * Tenta resolver uma rota técnica a partir de um evento do AutoISP.
 * Paridade com _resolveRouteByAutoIspUsername e _resolveRouteByPonlink do Flutter.
 */
export function resolveRouteFromEvent(
  event: AutoIspEvent,
  indices: TopologyIndices
): ResolvedAutoIspRoute | null {
  // 1. PPPoE(s) do evento → busca na base de conexões (consenso entre recursos)
  const byUser = resolveRouteByUsernameConsensus(event, indices)
  if (byUser) return byUser

  // 2. Ponlink + catálogo de rotas (fallback estrutural)
  const byPon = resolveRouteByPonlink(event, indices)
  if (byPon) return byPon

  return null
}

/** Chaves para bater login AutoISP com `USUÁRIO[CLIENTE]` (ex.: com ou sem domínio). */
function pppoeLookupKeys(rawUsername: string): string[] {
  const t = rawUsername.trim().toLowerCase()
  if (t === '') return []
  const keys = new Set<string>([t])
  const at = t.indexOf('@')
  if (at > 0) keys.add(t.slice(0, at))
  return [...keys]
}

function lookupRouteByPppoeUsername(
  rawUsername: string,
  indices: TopologyIndices
): ResolvedAutoIspRoute | null {
  for (const key of pppoeLookupKeys(rawUsername)) {
    const match = indices.routeByUsername[key]
    if (match) return match
  }
  return null
}

function routeIdentityKey(r: ResolvedAutoIspRoute): string {
  return `${r.ap}\0${r.slot}\0${r.port}`
}

/**
 * Para cada recurso do evento com PPPoE, localiza a rota na base; escolhe AP/slot/porta
 * mais frequente entre os matches (vários clientes no mesmo evento PON).
 */
function resolveRouteByUsernameConsensus(
  event: AutoIspEvent,
  indices: TopologyIndices
): ResolvedAutoIspRoute | null {
  const matches: ResolvedAutoIspRoute[] = []
  for (const resource of event.resources) {
    const route = lookupRouteByPppoeUsername(resource.pppoeUsername ?? '', indices)
    if (route) matches.push(route)
  }
  if (matches.length === 0) return null

  const tally = new Map<
    string,
    { count: number; representative: ResolvedAutoIspRoute }
  >()
  for (const r of matches) {
    const k = routeIdentityKey(r)
    const prev = tally.get(k)
    if (prev) prev.count += 1
    else tally.set(k, { count: 1, representative: r })
  }

  let best: { count: number; representative: ResolvedAutoIspRoute } | null = null
  for (const v of tally.values()) {
    if (!best || v.count > best.count) best = v
  }
  if (!best) return null

  const winKey = routeIdentityKey(best.representative)
  const sameKey = matches.filter((r) => routeIdentityKey(r) === winKey)
  const splitters = new Set(
    sameKey
      .map((r) => r.splitterCode)
      .filter((c): c is string => typeof c === 'string' && c.trim() !== ''),
  )
  const splitterCode = splitters.size === 1 ? [...splitters][0]! : null

  return {
    ap: best.representative.ap,
    slot: best.representative.slot,
    port: best.representative.port,
    splitterCode,
    username: null,
  }
}

/**
 * Busca rota baseada na string de ponlink (ex: "X/7/2") presente no evento.
 */
function resolveRouteByPonlink(
  event: AutoIspEvent,
  indices: TopologyIndices
): ResolvedAutoIspRoute | null {
  // Pega o primeiro ponlink não vazio disponível nos recursos do evento
  const firstPon = event.resources
    .map((r) => (r.ponlink || '').trim())
    .find((it) => it.length > 0)

  if (!firstPon) return null

  // O formato esperado pelo Flutter é segmentado por '/'
  // Ex: "NOME_DO_LINK/SLOT/PORTA"
  const parts = firstPon.split('/')
  if (parts.length !== 3) return null

  const slot = parseInt(parts[1], 10)
  const port = parseInt(parts[2], 10)

  if (isNaN(slot) || isNaN(port)) return null

  // Busca quais APs no catálogo possuem esse slot e porta configurados
  const apCandidates = Object.entries(indices.routeCatalog)
    .filter(([, slots]) => slots[slot]?.[port]?.size > 0)
    .map(([apCode]) => apCode)
    .sort()

  if (apCandidates.length === 0) return null

  const ap = apCandidates[0]
  const splitters = Array.from(indices.routeCatalog[ap][slot][port])

  return {
    ap,
    slot,
    port,
    splitterCode: splitters.length === 1 ? splitters[0] : null,
    username: null,
  }
}

/**
 * Preenche AP / slot / porta só com dados do evento (ponlink), **sem** `listarConnections`.
 * Usa os **dois últimos** segmentos como slot e porta; o restante forma o código do AP.
 * Ex.: `MEU-AP/7/2` ou `OLT-X/CAIXA/12/3` → AP=`OLT-X/CAIXA`, slot=12, port=3.
 */
export function resolveRouteFromEventStandalone(
  event: AutoIspEvent,
): ResolvedAutoIspRoute | null {
  for (const resource of event.resources) {
    const raw = (resource.ponlink || '').trim()
    if (!raw) continue

    const normalized = raw.split('\\').join('/')
    const segments = normalized
      .split('/')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
    if (segments.length < 3) continue

    const slot = Number.parseInt(segments[segments.length - 2] ?? '', 10)
    const port = Number.parseInt(segments[segments.length - 1] ?? '', 10)
    if (!Number.isFinite(slot) || !Number.isFinite(port)) continue

    const apParts = segments.slice(0, -2)
    const ap = apParts.join('/')
    if (!ap) continue

    const pppoe = (resource.pppoeUsername || '').trim()

    return {
      ap,
      slot,
      port,
      splitterCode: null,
      username: pppoe.length > 0 ? pppoe : null,
    }
  }

  return null
}



