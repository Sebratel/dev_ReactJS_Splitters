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
  })
})
