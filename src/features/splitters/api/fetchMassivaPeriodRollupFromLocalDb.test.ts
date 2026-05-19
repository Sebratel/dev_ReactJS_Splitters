import { describe, expect, it } from 'vitest'

describe('fetchMassivaPeriodRollupFromLocalDb request shape', () => {
  it('documents all_linked scope for painel da rede (sem lista de códigos)', () => {
    const body = {
      scope: 'all_linked' as const,
      openedAtFrom: '2026-02-19T00:00:00.000Z',
      openedAtTo: '2026-05-20T23:59:59.999Z',
    }
    expect(body.scope).toBe('all_linked')
    expect(JSON.stringify(body).length).toBeLessThan(200)
    expect('splitterCodes' in body).toBe(false)
  })
})
