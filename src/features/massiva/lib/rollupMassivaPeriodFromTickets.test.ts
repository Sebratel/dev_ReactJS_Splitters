import { describe, expect, it } from 'vitest'
import { rollupMassivaPeriodFromTickets } from '@/features/massiva/lib/rollupMassivaPeriodFromTickets'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ticket(partial: Partial<MassivaTicket>): MassivaTicket {
  return {
    protocol: partial.protocol ?? 1,
    assignmentId: null,
    title: partial.title ?? 'Registro Incidente de Rede',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'aberta',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'unknown',
    ellevenIncidentStatusId: null,
    openedAt: partial.openedAt ?? new Date('2026-05-10T12:00:00'),
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: partial.closedAt ?? null,
    affectedClients: partial.affectedClients ?? 10,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

describe('rollupMassivaPeriodFromTickets', () => {
  const range = {
    start: new Date('2026-05-01T00:00:00'),
    end: new Date('2026-05-31T23:59:59'),
  }

  it('conta aberta com lifecycle unknown no período', () => {
    const rollup = rollupMassivaPeriodFromTickets(
      [ticket({ protocol: 10, ellevenLifecycle: 'unknown', status: 'aberta' })],
      range,
    )
    expect(rollup.openMassivasCount).toBe(1)
    expect(rollup.distinctMassivaCount).toBe(1)
    expect(rollup.affectedClientsDistinctSum).toBe(10)
  })

  it('não conta encerrada no Elleven como aberta', () => {
    const rollup = rollupMassivaPeriodFromTickets(
      [
        ticket({
          protocol: 11,
          ellevenLifecycle: 'closed',
          status: 'encerrada',
          closedAt: new Date('2026-05-12'),
        }),
      ],
      range,
    )
    expect(rollup.openMassivasCount).toBe(0)
    expect(rollup.closedMassivasCount).toBe(1)
  })
})
