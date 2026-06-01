import { describe, expect, it } from 'vitest'
import {
  ellevenStatusTextIndicatesClosed,
  ellevenStatusTextsIndicateClosed,
} from '@/features/massiva/lib/massivaEllevenStatusText'
import { inferEllevenMassivaLifecycle } from '@/features/massiva/lib/inferEllevenMassivaLifecycle'
import { parseMassivaTicketFromApi } from '@/features/massiva/model/massivaTicket'

describe('massivaEllevenStatusText', () => {
  it('trata Cancelado como encerrado', () => {
    expect(ellevenStatusTextIndicatesClosed('Cancelado')).toBe(true)
    expect(ellevenStatusTextsIndicateClosed(['cancelado'])).toBe(true)
  })

  it('inferEllevenMassivaLifecycle fecha com situacao Cancelado e id aberto', () => {
    expect(
      inferEllevenMassivaLifecycle({
        statusTexts: ['cancelado'],
        incidentStatusId: 1,
        closedAt: null,
        expectedCloseAt: null,
      }),
    ).toBe('closed')
  })

  it('parseMassivaTicketFromApi lê situacao Cancelado', () => {
    const t = parseMassivaTicketFromApi({
      protocol: 1676359,
      situacao: 'Cancelado',
      incidentStatusId: 1,
    })
    expect(t.status).toBe('encerrada')
    expect(t.ellevenLifecycle).toBe('closed')
    expect(t.ellevenStatusTexts).toContain('cancelado')
  })
})
