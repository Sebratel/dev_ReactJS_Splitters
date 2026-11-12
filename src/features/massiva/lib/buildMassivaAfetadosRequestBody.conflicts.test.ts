import { describe, expect, it } from 'vitest'
import { buildMassivaAfetadosRequestBody } from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

const cliente = { user: 'ana', authenticationId: 1, contract: { id: 10 } } as unknown as SplitterCliente

function ctx(extra: Partial<MassivaOpenFinalContext> = {}): MassivaOpenFinalContext {
  return {
    operatorEmail: 'op@sebratel.com.br',
    assignmentDescription: 'queda',
    assignmentFinalDateLocal: '2026-11-12T18:00:00',
    basis: { collectedClientes: [cliente] },
    ...extra,
  } as unknown as MassivaOpenFinalContext
}

describe('buildMassivaAfetadosRequestBody — clientes em outro evento', () => {
  it('por padrão não manda includeConflicting (o gateway deixa de fora quem já está em outro evento)', () => {
    const body = buildMassivaAfetadosRequestBody(ctx(), 1888, 777)
    expect(body.includeConflicting).toBeUndefined()
    expect(body.usuarioAfetadoEntities).toHaveLength(1)
  })

  it('manda includeConflicting quando o operador escolheu incluir mesmo assim', () => {
    const body = buildMassivaAfetadosRequestBody(ctx({ includeConflictingClients: true }), 1888, 777)
    expect(body.includeConflicting).toBe(true)
  })
})
