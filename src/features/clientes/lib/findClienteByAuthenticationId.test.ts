import { describe, expect, it } from 'vitest'
import { findClienteByAuthenticationId } from '@/features/clientes/lib/findClienteByAuthenticationId'
import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'

describe('findClienteByAuthenticationId', () => {
  it('encontra por authenticationId', () => {
    const list = [{ authenticationId: 10 } as ClienteDetail, { authenticationId: 20 } as ClienteDetail]
    expect(findClienteByAuthenticationId(list, 20)).toBe(list[1])
    expect(findClienteByAuthenticationId(list, 99)).toBeUndefined()
  })
})
