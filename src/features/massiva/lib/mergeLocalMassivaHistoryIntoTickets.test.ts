import { describe, expect, it } from 'vitest'
import {
  LOCAL_ONLY_OPEN_MAX_AGE_MS,
  mergeLocalMassivaHistoryIntoTickets,
} from '@/features/massiva/lib/mergeLocalMassivaHistoryIntoTickets'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function bffTicket(partial: Partial<MassivaTicket> & Pick<MassivaTicket, 'protocol'>): MassivaTicket {
  return {
    protocol: partial.protocol,
    assignmentId: partial.assignmentId ?? null,
    title: partial.title ?? 'BFF',
    description: '',
    apCode: partial.apCode ?? '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'desconhecida',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'unknown',
    ellevenIncidentStatusId: partial.ellevenIncidentStatusId ?? null,
    openedAt: partial.openedAt ?? null,
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: partial.closedAt ?? null,
    affectedClients: partial.affectedClients ?? 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

function localRow(partial: Partial<MassivaHistoryListRow> & Pick<MassivaHistoryListRow, 'protocol'>): MassivaHistoryListRow {
  return {
    id: 1,
    protocol: partial.protocol,
    assignmentId: partial.assignmentId ?? 2016111,
    accessPointCode: partial.accessPointCode ?? 'OLT 04',
    title: partial.title ?? 'Local',
    operatorEmail: 'op@test.com',
    affectedClients: partial.affectedClients ?? 1,
    status: partial.status ?? 'aberta',
    openedAt: partial.openedAt ?? new Date(),
    expectedCloseAt: null,
    closedAt: partial.closedAt ?? null,
    updatedAt: null,
  }
}

describe('mergeLocalMassivaHistoryIntoTickets', () => {
  it('adiciona protocolo via recentOpens mesmo sem BFF', () => {
    const merged = mergeLocalMassivaHistoryIntoTickets(
      [],
      [],
      [bffTicket({ protocol: 1676225, status: 'aberta', openedAt: new Date() })],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.protocol).toBe(1676225)
  })

  it('não promove local aberta antiga ausente no BFF', () => {
    const old = new Date(Date.now() - LOCAL_ONLY_OPEN_MAX_AGE_MS - 60_000)
    const merged = mergeLocalMassivaHistoryIntoTickets(
      [],
      [localRow({ protocol: 111, openedAt: old, status: 'aberta' })],
      [],
    )
    expect(merged).toHaveLength(0)
  })

  it('BFF encerrada não vira aberta por histórico local', () => {
    const merged = mergeLocalMassivaHistoryIntoTickets(
      [bffTicket({ protocol: 99, status: 'encerrada', closedAt: new Date() })],
      [localRow({ protocol: 99, status: 'aberta', openedAt: new Date() })],
      [],
    )
    expect(merged[0]?.status).toBe('encerrada')
  })

  it('closedAt no BFF força encerrada mesmo com status ambíguo', () => {
    const merged = mergeLocalMassivaHistoryIntoTickets(
      [bffTicket({ protocol: 88, status: 'desconhecida', closedAt: new Date('2026-05-20') })],
      [],
      [],
    )
    expect(merged[0]?.status).toBe('encerrada')
  })

  it('preenche openedAt do BFF a partir do histórico local', () => {
    const openedAt = new Date('2026-05-25T15:30:00')
    const merged = mergeLocalMassivaHistoryIntoTickets(
      [bffTicket({ protocol: 99, status: 'aberta', openedAt: null })],
      [localRow({ protocol: 99, openedAt, status: 'aberta' })],
      [],
    )
    expect(merged[0]?.openedAt).toEqual(openedAt)
  })
})
