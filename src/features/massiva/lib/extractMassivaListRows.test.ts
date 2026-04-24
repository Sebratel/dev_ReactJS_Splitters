import { describe, expect, it } from 'vitest'
import { extractMassivaListRows } from '@/features/massiva/lib/extractMassivaListRows'

describe('extractMassivaListRows', () => {
  it('aceita array na raiz', () => {
    expect(extractMassivaListRows([{ a: 1 }, 2])).toEqual([{ a: 1 }])
  })

  it('lê response.data, data.items e fallback objeto único', () => {
    expect(
      extractMassivaListRows({ response: { data: [{ x: 1 }] } }),
    ).toEqual([{ x: 1 }])
    expect(
      extractMassivaListRows({ data: { items: [{ y: 2 }] } }),
    ).toEqual([{ y: 2 }])
    expect(extractMassivaListRows({ data: { foo: 1 } })).toEqual([{ foo: 1 }])
  })

  it('objeto com protocol vira linha única', () => {
    expect(extractMassivaListRows({ protocol: 99 })).toEqual([{ protocol: 99 }])
  })

  it('valor não objeto retorna vazio', () => {
    expect(extractMassivaListRows(null)).toEqual([])
    expect(extractMassivaListRows('x')).toEqual([])
  })
})
