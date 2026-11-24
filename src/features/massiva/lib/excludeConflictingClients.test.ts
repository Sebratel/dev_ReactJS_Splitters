import { describe, expect, it } from 'vitest'
import {
  buildConflictContractSet,
  partitionClientesByConflicts,
} from '@/features/massiva/lib/excludeConflictingClients'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

const cliente = (user: string, contractId: number | null) =>
  ({ user, contract: contractId == null ? null : { id: contractId } }) as unknown as SplitterCliente

describe('partitionClientesByConflicts', () => {
  const clientes = [cliente('ana', 10), cliente('beto', 11), cliente('cris', 12), cliente('sem', null)]

  it('deixa de fora só quem já está em outro evento', () => {
    const { kept, excluded } = partitionClientesByConflicts(clientes, buildConflictContractSet([11, 12]))
    expect(kept.map((c) => c.user)).toEqual(['ana', 'sem'])
    expect(excluded.map((c) => c.user)).toEqual(['beto', 'cris'])
  })

  it('sem conflitos mantém todo mundo', () => {
    const { kept, excluded } = partitionClientesByConflicts(clientes, buildConflictContractSet([]))
    expect(kept).toHaveLength(4)
    expect(excluded).toHaveLength(0)
  })

  it('ignora ids inválidos ao montar o conjunto', () => {
    const set = buildConflictContractSet([0, -1, 3.5, 11])
    expect([...set]).toEqual([11])
  })
})
