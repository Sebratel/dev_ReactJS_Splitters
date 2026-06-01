import { describe, expect, it } from 'vitest'
import {
  isMassivaClosedForCounts,
  isMassivaClosedForPanelList,
  isMassivaOpenForCounts,
  isMassivaOpenForGlobalDashboard,
  isMassivaOpenForPanelList,
  summarizeMassivaPeriodCounts,
} from '@/features/massiva/lib/massivaDashboardEligibility'
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
    ellevenLifecycle: partial.ellevenLifecycle ?? 'open',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: partial.ellevenStatusTexts ?? [],
    openedAt: partial.openedAt ?? new Date(),
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

describe('massivaDashboardEligibility', () => {
  it('exclui fora do catálogo das contagens', () => {
    expect(
      isMassivaOpenForCounts(ticket({ title: 'Chamado avulso XYZ', status: 'aberta' })),
    ).toBe(false)
  })

  it('lista fora do catálogo aberta no painel sem entrar nos KPIs estritos', () => {
    const oot = ticket({
      title: 'OLT 04 - NHOPN',
      status: 'aberta',
      ellevenLifecycle: 'open',
    })
    expect(isMassivaOpenForPanelList(oot)).toBe(true)
    expect(isMassivaOpenForCounts(oot)).toBe(false)
  })

  it('fluxo padrão aceita aberta com lifecycle unknown (BFF)', () => {
    const catalog = ticket({
      title: 'Registro Incidente de Rede',
      status: 'aberta',
      ellevenLifecycle: 'unknown',
    })
    expect(isMassivaOpenForGlobalDashboard(catalog)).toBe(true)
    expect(isMassivaOpenForCounts(catalog)).toBe(false)
  })

  it('lista encerrada fora do catálogo no painel', () => {
    const oot = ticket({
      title: 'Chamado avulso',
      status: 'encerrada',
      ellevenLifecycle: 'closed',
      closedAt: new Date(),
    })
    expect(isMassivaClosedForPanelList(oot)).toBe(true)
    expect(isMassivaClosedForCounts(oot)).toBe(false)
  })

  it('conta protocolo recente mesmo com título fora do catálogo', () => {
    const recent = new Set([77])
    expect(
      isMassivaOpenForCounts(
        ticket({
          protocol: 77,
          title: 'Massiva AP 123',
          status: 'aberta',
          ellevenLifecycle: 'open',
        }),
        recent,
      ),
    ).toBe(true)
    expect(
      isMassivaOpenForGlobalDashboard(
        ticket({
          protocol: 77,
          title: 'Massiva AP 123',
          status: 'aberta',
          ellevenLifecycle: 'open',
        }),
        recent,
      ),
    ).toBe(true)
  })

  it('não conta aberta quando ellevenLifecycle é closed', () => {
    expect(
      isMassivaOpenForCounts(
        ticket({ status: 'aberta', ellevenLifecycle: 'closed' }),
      ),
    ).toBe(false)
    expect(
      isMassivaClosedForCounts(
        ticket({ status: 'aberta', ellevenLifecycle: 'closed' }),
      ),
    ).toBe(true)
  })

  it('global dashboard aceita unknown com status aberta', () => {
    expect(
      isMassivaOpenForGlobalDashboard(
        ticket({ protocol: 99, ellevenLifecycle: 'unknown', status: 'aberta' }),
      ),
    ).toBe(true)
  })

  it('permite unknown só com protocolo recente na aba Abertas', () => {
    const recent = new Set([42])
    expect(
      isMassivaOpenForCounts(
        ticket({ protocol: 42, ellevenLifecycle: 'unknown', status: 'aberta' }),
        recent,
      ),
    ).toBe(true)
    expect(
      isMassivaOpenForCounts(
        ticket({ protocol: 43, ellevenLifecycle: 'unknown', status: 'aberta' }),
        recent,
      ),
    ).toBe(false)
  })

  it('deduplica o mesmo protocolo na contagem do período', () => {
    const summary = summarizeMassivaPeriodCounts([
      ticket({ protocol: 10, status: 'aberta', ellevenLifecycle: 'open' }),
      ticket({ protocol: 10, status: 'aberta', ellevenLifecycle: 'open' }),
    ])
    expect(summary).toEqual({
      totalProtocols: 1,
      openCount: 1,
      closedCount: 0,
      unknownCount: 0,
    })
  })

  it('resume abertas e encerradas sem duplicar', () => {
    const summary = summarizeMassivaPeriodCounts([
      ticket({ protocol: 1, status: 'aberta', ellevenLifecycle: 'open' }),
      ticket({ protocol: 2, status: 'encerrada', ellevenLifecycle: 'closed' }),
      ticket({ protocol: 3, title: 'Chamado avulso', status: 'aberta' }),
    ])
    expect(summary).toEqual({
      totalProtocols: 2,
      openCount: 1,
      closedCount: 1,
      unknownCount: 0,
    })
  })
})
