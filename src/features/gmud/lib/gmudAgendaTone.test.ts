import { describe, expect, it } from 'vitest'
import { agendaTone, upcomingInRange } from '@/features/gmud/lib/gmudAgendaTone'

describe('agendaTone', () => {
  it('por tipo', () => {
    expect(agendaTone({ tipo: 'Programada', ellevenEncerradoEm: null })).toBe('programada')
    expect(agendaTone({ tipo: 'Emergencial', ellevenEncerradoEm: null })).toBe('emergencial')
    expect(agendaTone({ tipo: 'Pré-aprovada', ellevenEncerradoEm: null })).toBe('pre_aprovada')
    expect(agendaTone({ tipo: null, ellevenEncerradoEm: null })).toBe('programada')
  })
  it('encerrada vence o tipo', () => {
    expect(agendaTone({ tipo: 'Emergencial', ellevenEncerradoEm: '2026-11-01T10:00:00Z' })).toBe('encerrada')
  })
})

describe('upcomingInRange', () => {
  const mk = (dataInicio: string, dataFim: string, horaInicio = '08:00') => ({ dataInicio, dataFim, horaInicio })
  it('pega as que cobrem algum dia do intervalo e ordena por início', () => {
    const items = [mk('2026-11-20', '2026-11-20'), mk('2026-11-10', '2026-11-13'), mk('2026-11-12', '2026-11-12', '22:30'), mk('2026-11-12', '2026-11-12', '09:00')]
    expect(upcomingInRange(items, '2026-11-12', '2026-11-19').map((i) => i.dataInicio + ' ' + i.horaInicio)).toEqual([
      '2026-11-10 08:00',
      '2026-11-12 09:00',
      '2026-11-12 22:30',
    ])
  })
})
