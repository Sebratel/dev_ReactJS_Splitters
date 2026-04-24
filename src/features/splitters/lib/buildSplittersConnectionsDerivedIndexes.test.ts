import { describe, expect, it } from 'vitest'
import { buildSplittersConnectionsDerivedIndexes } from '@/features/splitters/lib/buildSplittersConnectionsDerivedIndexes'
import { buildSplittersClientNamesIndex } from '@/features/splitters/lib/buildSplittersClientNamesIndex'
import { buildSplittersOccupancyCountIndex } from '@/features/splitters/lib/buildSplittersOccupancyCountIndex'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function row(code: string | null, name: string): SplitterCliente {
  return {
    clientId: 1,
    authenticationId: 1,
    user: 'u',
    name,
    phone: null,
    email: null,
    status: 0,
    port: null,
    blocked: false,
    blockedDescription: null,
    splitterCode: code,
    splitterTitle: null,
    address: null,
    accessPoint: null,
    isCorporate: false,
    contract: null,
  }
}

describe('buildSplittersConnectionsDerivedIndexes', () => {
  it('agrega contagens e nomes por splitter', () => {
    const connections = [
      row('A', 'Maria'),
      row('A', 'joão'),
      row('A', 'Maria'),
      row(null, 'X'),
    ]
    const derived = buildSplittersConnectionsDerivedIndexes(connections)
    expect(derived.occupancyCountBySplitterCode.get('A')).toBe(3)
    expect(derived.clientNamesIndex.get('A')).toEqual(['joão', 'maria'])
    expect(buildSplittersClientNamesIndex(connections)).toEqual(
      derived.clientNamesIndex,
    )
    expect(buildSplittersOccupancyCountIndex(connections)).toEqual(
      derived.occupancyCountBySplitterCode,
    )
  })
})
