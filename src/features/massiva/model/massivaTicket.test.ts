import { describe, expect, it } from 'vitest'
import { parseMassivaTicketFromApi } from '@/features/massiva/model/massivaTicket'

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
})
