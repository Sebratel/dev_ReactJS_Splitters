import { describe, expect, it } from 'vitest'
import { findSplitterByCode } from '@/features/splitters/lib/findSplitterByCode'
import type { Splitter } from '@/features/splitters/model/splitter'

function sp(code: string): Splitter {
  return { code } as Splitter
}

describe('findSplitterByCode', () => {
  it('encontra por código', () => {
    const list = [sp('S1'), sp('S2')]
    expect(findSplitterByCode(list, 'S2')).toBe(list[1])
    expect(findSplitterByCode(list, 'X')).toBeUndefined()
  })
})
