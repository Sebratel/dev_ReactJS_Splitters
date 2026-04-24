import { describe, expect, it } from 'vitest'
import { parseSplitterLatLng } from '@/features/splitters/lib/parseSplitterCoordinates'

describe('parseSplitterLatLng', () => {
  it('aceita vírgula decimal e rejeita inválidos', () => {
    expect(parseSplitterLatLng('-23,5', '-46.6')).toEqual({ lat: -23.5, lng: -46.6 })
    expect(parseSplitterLatLng('', '1')).toBeNull()
    expect(parseSplitterLatLng('x', '1')).toBeNull()
  })
})
