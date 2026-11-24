import { describe, expect, it } from 'vitest'
import { mergeMassivaClientConflicts } from '@/features/massiva/api/fetchMassivaClientConflicts'
import type { MassivaClientConflicts } from '@/features/massiva/model/massivaClientConflicts'

const ev = (protocol: number, contractIds: number[]) => ({
  origin: 'massiva' as const,
  protocol,
  title: '',
  openedAt: null,
  finishDate: null,
  clients: contractIds.map((contractId) => ({ contractId, pppoe: `c${contractId}` })),
})

describe('mergeMassivaClientConflicts', () => {
  it('junta o mesmo evento vindo de consultas diferentes, sem repetir cliente', () => {
    const a: MassivaClientConflicts = { events: [ev(1888, [1, 2])], contractIds: [1, 2] }
    const b: MassivaClientConflicts = { events: [ev(1888, [2, 3]), ev(1700, [9])], contractIds: [2, 3, 9] }
    const merged = mergeMassivaClientConflicts([a, b])
    expect(merged.events.map((e) => e.protocol)).toEqual([1700, 1888])
    expect(merged.events.find((e) => e.protocol === 1888)?.clients.map((c) => c.contractId)).toEqual([1, 2, 3])
    expect(merged.contractIds.sort((x, y) => x - y)).toEqual([1, 2, 3, 9])
  })

  it('sem partes devolve vazio', () => {
    expect(mergeMassivaClientConflicts([])).toEqual({ events: [], contractIds: [] })
  })
})
