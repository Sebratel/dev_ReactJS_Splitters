import { describe, expect, it } from 'vitest'
import { findOltByCode } from '@/features/splitters/lib/findOltByCode'
import type { Olt } from '@/features/splitters/model/olt'

function olt(code: string): Olt {
  return { code } as Olt
}

describe('findOltByCode', () => {
  it('encontra por código e retorna undefined quando não existe', () => {
    const list = [olt('A'), olt('B')]
    expect(findOltByCode(list, 'B')).toBe(list[1])
    expect(findOltByCode(list, 'Z')).toBeUndefined()
  })
})
