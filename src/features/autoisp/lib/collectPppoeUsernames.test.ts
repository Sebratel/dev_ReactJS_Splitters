import { describe, expect, it } from 'vitest'
import { collectPppoeUsernamesFromEvents } from '@/features/autoisp/lib/collectPppoeUsernames'
import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'

function event(id: number, pppoes: Array<string | null>): AutoIspEvent {
  return {
    id,
    eventType: 'port',
    adminStatus: 'open',
    startAt: null,
    endAt: null,
    countOnus: pppoes.length,
    countCircuits: 0,
    resources: pppoes.map((pppoeUsername) => ({
      ponlink: null,
      pppoeUsername,
      networkStatus: null,
      contractId: null,
      onuId: null,
    })),
  }
}

describe('collectPppoeUsernamesFromEvents', () => {
  it('une os PPPoE de todos os eventos, sem repetir (ignora caixa) e ordenados', () => {
    const out = collectPppoeUsernamesFromEvents([
      event(1, ['Zeca', 'ana']),
      event(2, ['ANA', 'bia@prov.com']),
    ])
    expect(out).toEqual(['ana', 'bia@prov.com', 'Zeca'])
  })

  it('ignora nulos, vazios e espaços', () => {
    expect(collectPppoeUsernamesFromEvents([event(1, [null, '', '   ', ' joao '])])).toEqual(['joao'])
  })

  it('sem eventos devolve lista vazia', () => {
    expect(collectPppoeUsernamesFromEvents([])).toEqual([])
  })

  it('limita por evento: uma queda de PON com centenas de ONUs não domina a consulta', () => {
    const big = event(1, Array.from({ length: 300 }, (_, i) => `u${String(i).padStart(3, '0')}`))
    const out = collectPppoeUsernamesFromEvents([big, event(2, ['outro'])], { maxPerEvent: 20 })
    expect(out).toHaveLength(21)
    expect(out).toContain('outro')
  })

  it('respeita o limite total', () => {
    const events = [event(1, ['a', 'b', 'c']), event(2, ['d', 'e'])]
    expect(collectPppoeUsernamesFromEvents(events, { max: 4 })).toHaveLength(4)
  })

  it('mesma entrada gera a mesma saída (chave estável para o React Query)', () => {
    const a = collectPppoeUsernamesFromEvents([event(1, ['b', 'a'])])
    const b = collectPppoeUsernamesFromEvents([event(9, ['a', 'b'])])
    expect(a).toEqual(b)
  })
})
