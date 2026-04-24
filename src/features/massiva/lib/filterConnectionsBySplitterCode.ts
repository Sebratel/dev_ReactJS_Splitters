import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function canonicalToken(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

export type SplitterConnectionsIndex = Map<string, SplitterCliente[]>

export function buildSplitterConnectionsIndex(
  connections: readonly SplitterCliente[],
): SplitterConnectionsIndex {
  const index: SplitterConnectionsIndex = new Map()

  for (const connection of connections) {
    const keys = new Set<string>()
    const code = normalizeText(connection.splitterCode)
    const title = normalizeText(connection.splitterTitle)
    const codeCanonical = canonicalToken(connection.splitterCode)
    const titleCanonical = canonicalToken(connection.splitterTitle)

    if (code !== '') keys.add(code)
    if (title !== '') keys.add(title)
    if (codeCanonical !== '') keys.add(codeCanonical)
    if (titleCanonical !== '') keys.add(titleCanonical)

    for (const key of keys) {
      const bucket = index.get(key)
      if (bucket === undefined) {
        index.set(key, [connection])
      } else {
        bucket.push(connection)
      }
    }
  }

  return index
}

/**
 * Match estrito por codigo/titulo normalizado (sem fuzzy includes),
 * para evitar inflar contagens com splitters parecidos.
 */
export function filterConnectionsBySplitterCode(
  connections: readonly SplitterCliente[],
  splitterCode: string,
  index?: SplitterConnectionsIndex,
): SplitterCliente[] {
  const code = normalizeText(splitterCode)
  const codeCanonical = canonicalToken(splitterCode)
  if (code === '') return []

  if (index !== undefined) {
    const byCode = index.get(code) ?? []
    const byCanonical = index.get(codeCanonical) ?? []
    if (byCode === byCanonical) return [...byCode]

    const merged = new Set<SplitterCliente>()
    for (const connection of byCode) merged.add(connection)
    for (const connection of byCanonical) merged.add(connection)
    return [...merged]
  }

  return connections.filter((connection) => {
    const rawCode = normalizeText(connection.splitterCode)
    const rawTitle = normalizeText(connection.splitterTitle)
    if (rawCode === code || rawTitle === code) return true

    const rawCodeCanonical = canonicalToken(connection.splitterCode)
    const rawTitleCanonical = canonicalToken(connection.splitterTitle)
    return rawCodeCanonical === codeCanonical || rawTitleCanonical === codeCanonical
  })
}
