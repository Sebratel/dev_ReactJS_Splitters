import { describe, expect, it } from 'vitest'
import {
  parseMassivaTicketFromApi,
  resolveMassivaStatusFromIncidentStatusId,
} from '@/features/massiva/model/massivaTicket'

describe('parseMassivaTicketFromApi (estimateTimeOfRestoration)', () => {
  it('lê ETR de `incident` mesmo com `atendimento` irmão preenchido', () => {
    const t = parseMassivaTicketFromApi({
      protocol: 1,
      atendimento: { id: 10 },
      incident: { estimateTimeOfRestoration: 167 },
    })
    expect(t.estimateTimeOfRestoration).toBe(167)
  })

  it('lê ETR no topo, snake_case ou em assignment', () => {
    expect(
      parseMassivaTicketFromApi({
        protocol: 2,
        estimateTimeOfRestoration: 90,
      }).estimateTimeOfRestoration,
    ).toBe(90)
    expect(
      parseMassivaTicketFromApi({
        protocol: 3,
        estimate_time_of_restoration: 45,
      }).estimateTimeOfRestoration,
    ).toBe(45)
    expect(
      parseMassivaTicketFromApi({
        protocol: 4,
        assignment: { estimateTimeOfRestoration: 30 },
      }).estimateTimeOfRestoration,
    ).toBe(30)
  })

  it('lê previsaoEncerramentoAtualizadaPor se o BFF enviar', () => {
    expect(
      parseMassivaTicketFromApi({
        protocol: 9,
        usuarioAtualizouPrevisao: 'Ana Silva',
      }).previsaoEncerramentoAtualizadaPor,
    ).toBe('Ana Silva')
  })

  it('prioriza horário de início digitado no template da descrição', () => {
    const t = parseMassivaTicketFromApi({
      protocol: 11,
      beginningDate: '2026-05-05T10:54:00Z',
      description:
        '🧾 INFORMACOES OBRIGATORIAS - ABERTURA\n⏱️ Horario que iniciou o evento: 05/05/2026, 10:30',
    })
    expect(t.openedAt?.getHours()).toBe(10)
    expect(t.openedAt?.getMinutes()).toBe(30)
  })

  it('prioriza prazo de normalização digitado no template da descrição', () => {
    const t = parseMassivaTicketFromApi({
      protocol: 12,
      finalDate: '2026-05-05T23:00:00Z',
      description:
        '📅 Prazo inicial de normalização: 05/05/2026, 20:00 - ()',
    })
    expect(t.expectedCloseAt?.getHours()).toBe(20)
    expect(t.expectedCloseAt?.getMinutes()).toBe(0)
  })

  it('usa incidentStatusId do Elleven (1 aberta, 4 encerrada)', () => {
    expect(resolveMassivaStatusFromIncidentStatusId(1)).toBe('aberta')
    expect(resolveMassivaStatusFromIncidentStatusId(4)).toBe('encerrada')
    expect(
      parseMassivaTicketFromApi({
        protocol: 20,
        incidentStatusId: 4,
        situation: 'Em andamento',
      }).status,
    ).toBe('encerrada')
    expect(
      parseMassivaTicketFromApi({
        protocol: 21,
        incidentStatus: { id: 4, title: 'Aberto' },
      }).status,
    ).toBe('encerrada')
    expect(
      parseMassivaTicketFromApi({
        protocol: 21,
        incidentStatus: { id: 4, title: 'Aberto' },
      }).ellevenLifecycle,
    ).toBe('closed')
  })

  it('interpreta expectedCloseAt em ISO com Z respeitando UTC', () => {
    const t = parseMassivaTicketFromApi({
      protocol: 10,
      finalDate: '2026-05-05T19:00:00Z',
    })
    expect(t.expectedCloseAt?.getTime()).toBe(
      new Date('2026-05-05T19:00:00Z').getTime(),
    )
  })
})
