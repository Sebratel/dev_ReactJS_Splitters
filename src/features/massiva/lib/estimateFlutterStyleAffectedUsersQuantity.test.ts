import { describe, expect, it } from 'vitest'
import { estimateFlutterStyleAffectedUsersQuantity } from '@/features/massiva/lib/estimateFlutterStyleAffectedUsersQuantity'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function row(
  code: string,
  authId: number,
): SplitterCliente {
  return {
    clientId: 1,
    authenticationId: authId,
    user: `u${authId}`,
    name: '',
    phone: null,
    email: null,
    status: 0,
    port: null,
    blocked: false,
    blockedDescription: null,
    splitterCode: code,
    splitterTitle: null,
    address: null,
    accessPoint: null,
    isCorporate: false,
    contract: null,
  }
}

describe('estimateFlutterStyleAffectedUsersQuantity', () => {
  it('conta authenticationId únicos > 0 nos splitters efetivos', () => {
    const connections = [
      row('A', 10),
      row('A', 10),
      row('A', 0),
      row('B', 20),
    ]
    expect(
      estimateFlutterStyleAffectedUsersQuantity(['A', 'B'], connections),
    ).toBe(2)
    expect(estimateFlutterStyleAffectedUsersQuantity(['Z'], connections)).toBe(0)
  })
})
