import { describe, expect, it } from 'vitest'
import { openGmudOccurrences } from '@/features/gmud/lib/openGmudOccurrences'
import { buildGmudOccurrences } from '@/features/gmud/lib/gmudRecurrence'

const quatro = buildGmudOccurrences({ dataInicio: '2026-11-20', dataFim: '2026-11-20', vezes: 4, intervaloDias: 15 })
const uma = buildGmudOccurrences({ dataInicio: '2026-11-20', dataFim: '2026-11-20', vezes: 1, intervaloDias: 0 })

function harness(failAt?: number) {
  const opened: Array<{ indice: number; key: string | null; dataInicio: string }> = []
  const registered: string[] = []
  return {
    opened,
    registered,
    openOne: async (occ: (typeof quatro)[number], key: string | null) => {
      if (occ.indice === failAt) throw new Error('Elleven fora do ar')
      opened.push({ indice: occ.indice, key, dataInicio: occ.dataInicio })
      return { protocol: String(1000 + occ.indice), assignmentId: 500 + occ.indice }
    },
    registerOne: async (_occ: (typeof quatro)[number], o: { protocol: string }) => {
      registered.push(o.protocol)
    },
  }
}

describe('openGmudOccurrences', () => {
  it('abre um protocolo por ocorrência, cada um com a sua data e a sua chave', async () => {
    const h = harness()
    const protocols = await openGmudOccurrences({ occurrences: quatro, idempotencyKeyBase: 'k1', openOne: h.openOne, registerOne: h.registerOne })
    expect(protocols).toEqual(['1001', '1002', '1003', '1004'])
    expect(h.opened.map((o) => o.dataInicio)).toEqual(['2026-11-20', '2026-12-05', '2026-12-20', '2027-01-04'])
    expect(h.opened.map((o) => o.key)).toEqual(['k1:1', 'k1:2', 'k1:3', 'k1:4'])
    expect(h.registered).toEqual(protocols)
  })

  it('sem repetição usa a chave original, sem sufixo', async () => {
    const h = harness()
    await openGmudOccurrences({ occurrences: uma, idempotencyKeyBase: 'k1', openOne: h.openOne, registerOne: h.registerOne })
    expect(h.opened[0]?.key).toBe('k1')
  })

  it('falha na 3ª: não desfaz as 2 abertas e o erro lista os protocolos já abertos', async () => {
    const h = harness(3)
    await expect(
      openGmudOccurrences({ occurrences: quatro, idempotencyKeyBase: 'k1', openOne: h.openOne, registerOne: h.registerOne }),
    ).rejects.toThrow(/Foram abertos 2 de 4 protocolos \(1001, 1002\).*Elleven fora do ar.*não são duplicados/)
    expect(h.registered).toEqual(['1001', '1002'])
  })

  it('falha na 1ª: devolve o erro original, sem texto de série', async () => {
    const h = harness(1)
    await expect(
      openGmudOccurrences({ occurrences: quatro, idempotencyKeyBase: 'k1', openOne: h.openOne, registerOne: h.registerOne }),
    ).rejects.toThrow('Elleven fora do ar')
  })

  it('falha ao registrar na plataforma depois de abrir também conta como erro da ocorrência', async () => {
    const h = harness()
    let n = 0
    await expect(
      openGmudOccurrences({
        occurrences: quatro,
        idempotencyKeyBase: 'k1',
        openOne: h.openOne,
        registerOne: async (occ, o) => {
          n += 1
          if (n === 2) throw new Error('banco fora')
          await h.registerOne(occ, o)
        },
      }),
    ).rejects.toThrow(/Foram abertos 1 de 4 protocolos \(1001\).*banco fora/)
  })
})
