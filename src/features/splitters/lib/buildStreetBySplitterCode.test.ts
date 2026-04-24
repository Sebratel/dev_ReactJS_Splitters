import { describe, expect, it, vi } from 'vitest'
import {
  buildDistinctSortedStreets,
  buildStreetBySplitterCode,
  countSplittersWithKnownStreet,
} from '@/features/splitters/lib/buildStreetBySplitterCode'
import type { GeocodedAddress } from '@/features/splitters/model/geocodedAddress'
import type { Splitter } from '@/features/splitters/model/splitter'

const cached: GeocodedAddress = {
  street: 'Cached',
  neighborhood: null,
  city: null,
  state: null,
  postalCode: null,
}

vi.mock('@/features/splitters/lib/splitterAddressCache', () => ({
  loadCachedGeocodedAddress: vi.fn(() => cached),
}))

function sp(code: string, street: string | null): Splitter {
  return { code, street } as Splitter
}

describe('buildStreetBySplitterCode', () => {
  it('prioriza street da API e usa cache quando API vazia', () => {
    const map = buildStreetBySplitterCode([
      sp('A', 'Api St'),
      sp('B', null),
    ])
    expect(map.get('A')).toBe('Api St')
    expect(map.get('B')).toBe('Cached')
  })

  it('buildDistinctSortedStreets e countSplittersWithKnownStreet', () => {
    const m = new Map<string, string | null>([
      ['a', 'Z'],
      ['b', 'Z'],
      ['c', null],
      ['d', '  '],
    ])
    expect(buildDistinctSortedStreets(m)).toEqual(['Z'])
    expect(countSplittersWithKnownStreet(m)).toBe(2)
  })
})
