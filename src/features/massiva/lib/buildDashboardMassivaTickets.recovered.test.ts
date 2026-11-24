import { describe, expect, it } from 'vitest'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import { MASSIVA_SOURCE_CONFERENCIA_ELLEVEN } from '@/features/massiva/model/massivaConferenciaStatus'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const periodStart = new Date('2026-05-01T00:00:00.000Z')

function bffOpen(protocol: number, openedAt: Date): MassivaTicket {
  return {
    protocol,
    assignmentId: 9001,
    title: 'Registro Incidente de Rede',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: 'aberta',
    ellevenLifecycle: 'open',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt,
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: null,
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

/** Linha como a conferência cria: sem operador e sem clientes afetados. */
function recoveredRow(
  protocol: number,
  partial: Partial<MassivaHistoryListRow> = {},
): MassivaHistoryListRow {
  return {
    id: 10,
    protocol,
    assignmentId: 9001,
    accessPointCode: '',
    title: 'OLT 03 - SLEFT',
    operatorEmail: '',
    affectedClients: 0,
    status: 'aberta',
    openedAt: new Date(),
    expectedCloseAt: null,
    closedAt: null,
    updatedAt: null,
    source: MASSIVA_SOURCE_CONFERENCIA_ELLEVEN,
    ...partial,
  }
}

function build(rows: MassivaHistoryListRow[], bff: MassivaTicket[] = []) {
  return buildDashboardMassivaTickets({
    bffTickets: bff,
    localRows: rows,
    recentOpenTickets: [],
    periodStart,
  })
}

describe('buildDashboardMassivaTickets — massivas recuperadas pela conferência', () => {
  it('marca recoveredFromElleven quando a linha local veio da conferência (aberta recente, sem BFF)', () => {
    const [t] = build([recoveredRow(1886908)])
    expect(t?.protocol).toBe(1886908)
    expect(t?.recoveredFromElleven).toBe(true)
  })

  it('mantém a marca depois de mesclar com o Elleven (aberta recente + BFF aberto)', () => {
    const row = recoveredRow(1886908)
    const [t] = build([row], [bffOpen(1886908, row.openedAt as Date)])
    expect(t?.status).toBe('aberta')
    expect(t?.recoveredFromElleven).toBe(true)
  })

  it('mantém a marca em linha aberta antiga (mais de 7 dias) que o Elleven ainda mostra aberta', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const [t] = build([recoveredRow(1886908, { openedAt: old })], [bffOpen(1886908, old)])
    expect(t?.recoveredFromElleven).toBe(true)
  })

  it('mantém a marca quando a linha recuperada já está encerrada', () => {
    const when = new Date(Date.now() - 60 * 60 * 1000)
    const [t] = build([recoveredRow(1874738, { status: 'encerrada', openedAt: when, closedAt: when })])
    expect(t?.status).toBe('encerrada')
    expect(t?.recoveredFromElleven).toBe(true)
  })

  it('linha parcial (sem operador e sem afetados) vira ticket válido, sem lançar', () => {
    const [t] = build([recoveredRow(1886908)])
    expect(t?.createdBy).toBe('')
    expect(t?.affectedClients).toBe(0)
    expect(t?.title).toBe('OLT 03 - SLEFT')
  })

  it('linhas de outras origens NÃO ganham a chave (formato do ticket inalterado)', () => {
    const [a] = build([recoveredRow(1, { source: 'nexaview-local' })])
    const [b] = build([recoveredRow(2, { source: null })])
    const [c] = build([recoveredRow(3, { source: undefined })])
    for (const t of [a, b, c]) {
      expect(t).toBeDefined()
      expect('recoveredFromElleven' in (t as MassivaTicket)).toBe(false)
    }
  })
})
