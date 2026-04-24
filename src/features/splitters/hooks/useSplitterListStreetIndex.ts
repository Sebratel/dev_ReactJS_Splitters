import { useMemo } from 'react'
import {
  buildDistinctSortedStreets,
  buildStreetBySplitterCode,
  countSplittersWithKnownStreet,
  type StreetBySplitterCode,
} from '@/features/splitters/lib/buildStreetBySplitterCode'
import type { Splitter } from '@/features/splitters/model/splitter'

export type SplitterListStreetIndex = {
  streetBySplitterCode: StreetBySplitterCode
  /** Opções do multiselect de ruas. */
  streetOptions: string[]
  /** Quantos splitters têm rua conhecida (BFF ou cache). */
  knownStreetCount: number
  totalSplitters: number
}

/**
 * Índice de ruas só com dados já disponíveis (BFF + `splitterAddressCache`).
 * Não chama reverse geocode — evita N requisições ao abrir a listagem.
 */
export function useSplitterListStreetIndex(
  splitters: Splitter[] | undefined,
): SplitterListStreetIndex {
  return useMemo(() => {
    if (!splitters?.length) {
      const empty = new Map<string, string | null>()
      return {
        streetBySplitterCode: empty,
        streetOptions: [],
        knownStreetCount: 0,
        totalSplitters: 0,
      }
    }

    const streetBySplitterCode = buildStreetBySplitterCode(splitters)
    return {
      streetBySplitterCode,
      streetOptions: buildDistinctSortedStreets(streetBySplitterCode),
      knownStreetCount: countSplittersWithKnownStreet(streetBySplitterCode),
      totalSplitters: splitters.length,
    }
  }, [splitters])
}
