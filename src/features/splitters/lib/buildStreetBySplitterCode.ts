import { loadCachedGeocodedAddress } from '@/features/splitters/lib/splitterAddressCache'
import type { Splitter } from '@/features/splitters/model/splitter'

/**
 * Código do splitter → texto de rua usado no filtro (`_streetBySplitter` na Home Flutter).
 *
 * Ordem (igual `_resolveAddressesInBackground` no Flutter, mas **sem** chamadas de rede):
 * 1. `splitter.street` do BFF
 * 2. `street` do endereço em cache (`localStorage`, preenchido pelo detalhe / reverse geocode)
 * 3. `null` se ainda não houver dado (não dispara geocoding em massa na listagem)
 */
export type StreetBySplitterCode = ReadonlyMap<string, string | null>

export function buildStreetBySplitterCode(
  splitters: readonly Splitter[],
): Map<string, string | null> {
  const map = new Map<string, string | null>()

  for (const s of splitters) {
    const fromApi = s.street?.trim()
    if (fromApi && fromApi.length > 0) {
      map.set(s.code, fromApi)
      continue
    }

    const cached = loadCachedGeocodedAddress(s.code)
    const fromCache = cached?.street?.trim()
    if (fromCache && fromCache.length > 0) {
      map.set(s.code, fromCache)
      continue
    }

    map.set(s.code, null)
  }

  return map
}

/** Valores distintos não vazios, para multiselect (paridade lista de ruas na Home Flutter). */
export function buildDistinctSortedStreets(
  streetBySplitterCode: ReadonlyMap<string, string | null>,
): string[] {
  const set = new Set<string>()
  for (const v of streetBySplitterCode.values()) {
    if (v !== null && v.trim() !== '') {
      set.add(v.trim())
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function countSplittersWithKnownStreet(
  streetBySplitterCode: ReadonlyMap<string, string | null>,
): number {
  let n = 0
  for (const v of streetBySplitterCode.values()) {
    if (v !== null && v.trim() !== '') n += 1
  }
  return n
}
