import { describe, expect, it } from 'vitest'
import { applyEffectiveMassivaTicket } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ticket(partial: Partial<MassivaTicket>): MassivaTicket {
  return {
    protocol: 1,
    assignmentId: null,
    title: 't',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'aberta',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'unknown',
    ellevenIncidentStatusId: partial.ellevenIncidentStatusId ?? null,
    openedAt: null,
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: partial.closedAt ?? null,
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
    ...partial,
  }
}

describe('applyEffectiveMassivaTicket', () => {
  it('closedAt define encerrada', () => {
    const t = applyEffectiveMassivaTicket(
      ticket({ status: 'aberta', closedAt: new Date() }),
    )
    expect(t.status).toBe('encerrada')
  })

  it('ellevenLifecycle closed define encerrada mesmo com status aberta', () => {
    const t = applyEffectiveMassivaTicket(
      ticket({ status: 'aberta', ellevenLifecycle: 'closed' }),
    )
    expect(t.status).toBe('encerrada')
  })
})
