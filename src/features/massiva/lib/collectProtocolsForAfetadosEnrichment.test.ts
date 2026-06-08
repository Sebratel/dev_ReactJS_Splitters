import { describe, expect, it } from 'vitest'
import {
  collectProtocolsForAfetadosEnrichment,
  protocolsFingerprintForAfetadosEnrichment,
} from '@/features/massiva/lib/collectProtocolsForAfetadosEnrichment'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ticket(partial: Partial<MassivaTicket> & { protocol: number }): MassivaTicket {
  return {
    assignmentId: null,
    title: 'Registro Evento Massivo',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: 'aberta',
    ellevenLifecycle: 'open',
    ellevenIncidentStatusId: 1,
    ellevenStatusTexts: [],
    openedAt: null,
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: null,
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
    ...partial,
  }
}

describe('collectProtocolsForAfetadosEnrichment', () => {
  it('inclui só abertas com lifecycle não encerrado', () => {
    const protocols = collectProtocolsForAfetadosEnrichment([
      ticket({ protocol: 1686776, status: 'aberta', ellevenLifecycle: 'open' }),
      ticket({ protocol: 1645316, status: 'encerrada', ellevenLifecycle: 'closed' }),
      ticket({ protocol: 1647509, status: 'aberta', ellevenLifecycle: 'closed' }),
      ticket({ protocol: 1686767, status: 'aberta', ellevenLifecycle: 'unknown' }),
    ])
    expect(protocols).toEqual([1686767, 1686776])
  })

  it('fingerprint vazio quando não há abertas elegíveis', () => {
    expect(
      protocolsFingerprintForAfetadosEnrichment([
        ticket({ protocol: 1, status: 'encerrada', ellevenLifecycle: 'closed' }),
      ]),
    ).toBe('')
  })
})
