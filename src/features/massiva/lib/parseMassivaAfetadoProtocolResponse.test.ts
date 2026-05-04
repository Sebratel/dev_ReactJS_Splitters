import { describe, expect, it } from 'vitest'
import {
  parseMassivaAfetadoProtocolEnrichment,
} from '@/features/massiva/lib/parseMassivaAfetadoProtocolResponse'

describe('parseMassivaAfetadoProtocolEnrichment (impactedUsers + ETR)', () => {
  it('conta chaves de impactedUsers e lê estimateTimeOfRestoration aninhado', () => {
    const sample = {
      message: 'Impacted users successfully found.',
      data: {
        impactedUsers: {
          '225401': {
            reason: 'x',
            estimateTimeOfRestoration: 55,
          },
        },
      },
      timestamp: '2026-04-23T19:34:05.238967134',
    }
    const e = parseMassivaAfetadoProtocolEnrichment(sample)
    expect(e.count).toBe(1)
    expect(e.estimateTimeOfRestoration).toBe(55)
    expect(e.affectedClientsResidential).toBeNull()
    expect(e.affectedClientsCorporate).toBeNull()
  })

  it('discrimina por isCorporate em impactedUsers quando todos têm flag', () => {
    const e = parseMassivaAfetadoProtocolEnrichment({
      data: {
        impactedUsers: {
          a: { isCorporate: false },
          b: { isCorporate: true },
          c: { client: { corporativo: false } },
        },
      },
    })
    expect(e.count).toBe(3)
    expect(e.affectedClientsResidential).toBe(2)
    expect(e.affectedClientsCorporate).toBe(1)
  })

  it('lê pares escalares de totais residencial/corporativo', () => {
    const e = parseMassivaAfetadoProtocolEnrichment({
      result: { quantidadeAfetadosResidencial: 12, quantidadeAfetadosCorporativo: 3 },
    })
    expect(e.affectedClientsResidential).toBe(12)
    expect(e.affectedClientsCorporate).toBe(3)
  })
})
