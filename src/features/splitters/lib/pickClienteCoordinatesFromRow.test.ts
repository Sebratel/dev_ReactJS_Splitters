import { describe, expect, it } from 'vitest'
import {
  CLIENT_LATITUDE_ROW_KEYS,
  pickCoordinateFromRow,
  pickOptionalCoordinate,
} from '@/features/splitters/lib/pickClienteCoordinatesFromRow'

describe('pickClienteCoordinatesFromRow', () => {
  it('pickOptionalCoordinate', () => {
    expect(pickOptionalCoordinate(null)).toBeNull()
    expect(pickOptionalCoordinate(1.5)).toBe(1.5)
    expect(pickOptionalCoordinate('-2,5')).toBe(-2.5)
    expect(pickOptionalCoordinate('x')).toBeNull()
  })

  it('pickCoordinateFromRow usa primeira chave válida', () => {
    const row = { foo: '9', [CLIENT_LATITUDE_ROW_KEYS[0]]: '10' }
    expect(pickCoordinateFromRow(row, CLIENT_LATITUDE_ROW_KEYS)).toBe(10)
    expect(pickCoordinateFromRow({}, CLIENT_LATITUDE_ROW_KEYS)).toBeNull()
  })
})
