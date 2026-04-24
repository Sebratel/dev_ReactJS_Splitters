import { describe, expect, it } from 'vitest'
import { haversineDistanceMeters } from '@/features/splitters/lib/haversineMeters'

describe('haversineDistanceMeters', () => {
  it('distância zero no mesmo ponto e positiva entre pontos distintos', () => {
    expect(haversineDistanceMeters(-23.5, -46.6, -23.5, -46.6)).toBeLessThan(1)
    expect(
      haversineDistanceMeters(-23.55, -46.63, -23.56, -46.64),
    ).toBeGreaterThan(0)
  })
})
