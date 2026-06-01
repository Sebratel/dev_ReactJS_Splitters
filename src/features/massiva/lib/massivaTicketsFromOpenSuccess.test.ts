import { describe, expect, it } from 'vitest'
import { massivaTicketsFromOpenSuccess } from '@/features/massiva/lib/massivaTicketsFromOpenSuccess'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'

function minimalContext(): MassivaOpenFinalContext {
  return {
    personId: 1,
    operatorEmail: 'op@test.com',
    basis: {
      topology: {
        routes: [
          {
            apCode: 'AP-01',
            apDisplayTitle: 'AP Um',
            effectiveSplitterDisplay: [{ code: 'SPL-99', label: 'SPL-99' }],
          },
        ],
      },
      collectedClientes: [],
    } as MassivaOpenFinalContext['basis'],
    plan: {
      requests: [
        {
          authenticationAccessPointCode: 'AP-01',
          assignmentTitle: 'Registro Evento Massivo',
        },
      ],
    } as MassivaOpenFinalContext['plan'],
    assignmentDescription: '',
    assignmentFinalDateLocal: '2026-05-25T18:00:00',
    assignmentBeginningDateLocal: null,
    eventIdentifiedAtLocal: null,
    massivaOpenPath: '/open',
    massivaAfetadosPath: '/afetados',
    affectedUsersQuantityFlutterParity: 0,
    descriptionAutoSyncEnabled: false,
  }
}

describe('massivaTicketsFromOpenSuccess', () => {
  it('usa título do plano e código do splitter do contexto', () => {
    const tickets = massivaTicketsFromOpenSuccess(
      {
        results: [
          {
            accessPointCode: 'AP-01',
            protocol: 9001,
            assignmentId: 10,
            message: 'ok',
            createdProtocols: [],
          },
        ],
      },
      minimalContext(),
    )
    expect(tickets).toHaveLength(1)
    expect(tickets[0]?.title).toBe('Registro Evento Massivo')
    expect(tickets[0]?.splitterCode).toBe('SPL-99')
    expect(tickets[0]?.status).toBe('aberta')
  })

  it('inclui protocolos em createdProtocols', () => {
    const tickets = massivaTicketsFromOpenSuccess({
      results: [
        {
          accessPointCode: 'AP-01',
          protocol: null,
          assignmentId: 10,
          message: 'ok',
          createdProtocols: [9002],
        },
      ],
    })
    expect(tickets.map((t) => t.protocol)).toEqual([9002])
  })
})
