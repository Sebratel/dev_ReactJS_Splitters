import { describe, expect, it } from 'vitest'
import { gmudDeadline } from '@/features/gmud/lib/gmudDeadline'

const now = new Date('2026-10-09T12:00:00Z')

describe('gmudDeadline', () => {
  it('encerrada e cancelada têm prioridade sobre o prazo', () => {
    expect(gmudDeadline({ status: 'Encerrado', slaDate: '2026-01-01T00:00:00Z', conclusionDate: '2026-02-01T00:00:00Z', now }).tone).toBe('done')
    expect(gmudDeadline({ status: 'Cancelado', slaDate: null, conclusionDate: '2026-02-01T00:00:00Z', now }).label).toBe('Cancelada')
  })

  it('vencida mostra há quantos dias', () => {
    expect(gmudDeadline({ status: 'Abertura', slaDate: '2026-06-01T12:00:00Z', conclusionDate: null, now })).toEqual({
      tone: 'overdue',
      label: 'Vencida há 130 d',
    })
  })

  it('vence hoje / em até 2 dias = atenção; depois disso = ok', () => {
    expect(gmudDeadline({ status: 'Abertura', slaDate: '2026-10-09T20:00:00Z', conclusionDate: null, now }).label).toBe('Vence hoje')
    expect(gmudDeadline({ status: 'Abertura', slaDate: '2026-10-11T13:00:00Z', conclusionDate: null, now }).tone).toBe('soon')
    expect(gmudDeadline({ status: 'Abertura', slaDate: '2026-10-20T12:00:00Z', conclusionDate: null, now })).toEqual({ tone: 'ok', label: 'Vence em 11 d' })
  })

  it('sem prazo', () => {
    expect(gmudDeadline({ status: 'Abertura', slaDate: null, conclusionDate: null, now }).tone).toBe('none')
  })
})
