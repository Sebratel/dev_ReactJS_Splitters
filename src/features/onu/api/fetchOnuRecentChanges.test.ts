import { describe, expect, it } from 'vitest'
import { parseEvents, parseRecentChanges } from './fetchOnuRecentChanges'

describe('parseEvents', () => {
  it('mapeia evento de queda com todos os campos', () => {
    const [e] = parseEvents([
      {
        id: 10,
        kind: 'drop',
        previousStatus: 'up',
        newStatus: 'power_fail',
        trigger: 'alarm',
        previousRxPower: '-21.0',
        newRxPower: null,
        at: '2026-06-25T12:00:00.000Z',
        ageSeconds: '120',
        username: 'cliente1',
        oltHostname: 'OLT_01',
      },
    ])
    expect(e.kind).toBe('drop')
    expect(e.previousRxPower).toBeCloseTo(-21)
    expect(e.newRxPower).toBeNull()
    expect(e.ageSeconds).toBe(120)
    expect(e.username).toBe('cliente1')
  })

  it('kind desconhecido vira "drop" por padrão', () => {
    const [e] = parseEvents([{ id: 1, kind: 'xpto' }])
    expect(e.kind).toBe('drop')
  })

  it('preserva "recovery"', () => {
    const [e] = parseEvents([{ id: 2, kind: 'recovery' }])
    expect(e.kind).toBe('recovery')
  })

  it('retorna [] para entrada não-array', () => {
    expect(parseEvents(null)).toEqual([])
    expect(parseEvents(undefined)).toEqual([])
    expect(parseEvents({})).toEqual([])
  })
})

describe('parseRecentChanges', () => {
  it('mapeia contadores e eventos', () => {
    const r = parseRecentChanges({
      generatedAt: '2026-06-25T12:00:00.000Z',
      drops: '3',
      recoveries: 2,
      events: [{ id: 1, kind: 'drop' }, { id: 2, kind: 'recovery' }],
    })
    expect(r.drops).toBe(3)
    expect(r.recoveries).toBe(2)
    expect(r.events).toHaveLength(2)
  })

  it('defaults seguros com payload vazio', () => {
    const r = parseRecentChanges({})
    expect(r.drops).toBe(0)
    expect(r.recoveries).toBe(0)
    expect(r.events).toEqual([])
    expect(r.generatedAt).toBe('')
  })
})
