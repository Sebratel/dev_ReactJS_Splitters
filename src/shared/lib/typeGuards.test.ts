import { describe, expect, it } from 'vitest'
import { isJsonObject } from '@/shared/lib/typeGuards'

describe('isJsonObject', () => {
  it('aceita objetos literais e rejeita null, array e primitivos', () => {
    expect(isJsonObject({ a: 1 })).toBe(true)
    expect(isJsonObject(null)).toBe(false)
    expect(isJsonObject([])).toBe(false)
    expect(isJsonObject('x')).toBe(false)
  })
})
