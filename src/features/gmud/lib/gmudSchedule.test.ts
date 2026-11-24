import { describe, expect, it } from 'vitest'
import {
  buildMonthGrid,
  buildRescheduleReport,
  formatWindow,
  isWindowValid,
  localDayKey,
  shiftWindowToDay,
  windowCoversDay,
} from '@/features/gmud/lib/gmudSchedule'

const base = { dataInicio: '2026-10-15', horaInicio: '22:00', dataFim: '2026-10-16', horaFim: '02:00' }

describe('shiftWindowToDay', () => {
  it('mantém horários e a duração em dias (atravessa a meia-noite)', () => {
    expect(shiftWindowToDay(base, '2026-10-20')).toEqual({
      dataInicio: '2026-10-20',
      horaInicio: '22:00',
      dataFim: '2026-10-21',
      horaFim: '02:00',
    })
  })

  it('funciona para trás e virando o mês', () => {
    expect(shiftWindowToDay(base, '2026-09-30')).toMatchObject({ dataInicio: '2026-09-30', dataFim: '2026-10-01' })
  })
})

describe('isWindowValid', () => {
  it('aceita fim depois do início e rejeita o contrário', () => {
    expect(isWindowValid(base)).toBe(true)
    expect(isWindowValid({ ...base, dataFim: '2026-10-15', horaFim: '21:00' })).toBe(false)
    expect(isWindowValid({ ...base, horaInicio: '9:00' })).toBe(false)
  })
})

describe('formatWindow / buildRescheduleReport', () => {
  it('formata janela de um dia e de dois dias', () => {
    expect(formatWindow(base)).toBe('15/10/2026 22:00 às 16/10/2026 02:00')
    expect(formatWindow({ ...base, dataFim: '2026-10-15', horaFim: '23:30' })).toBe('15/10/2026 22:00 às 23:30')
  })

  it('monta o relato padrão com janela anterior, nova, motivo e autor', () => {
    const text = buildRescheduleReport({
      previous: base,
      next: shiftWindowToDay(base, '2026-10-20'),
      user: 'Bruno Soares',
      motivo: 'Chuva prevista',
      now: new Date(2026, 9, 9, 10, 5),
    })
    expect(text).toBe(
      [
        'REAGENDAMENTO DA GMUD',
        'Janela anterior: 15/10/2026 22:00 às 16/10/2026 02:00',
        'Nova janela: 20/10/2026 22:00 às 21/10/2026 02:00',
        'Motivo: Chuva prevista',
        'Reagendado via plataforma por Bruno Soares em 09/10/2026 10:05.',
      ].join('\n'),
    )
  })
})

describe('buildMonthGrid', () => {
  it('cobre o mês inteiro em semanas de domingo a sábado', () => {
    const weeks = buildMonthGrid(2026, 9) // outubro/2026 começa numa quinta
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0][0].getDay()).toBe(0)
    expect(localDayKey(weeks[0][4])).toBe('2026-10-01')
    const allDays = weeks.flat().map(localDayKey)
    expect(allDays).toContain('2026-10-31')
  })
})

describe('windowCoversDay', () => {
  it('considera todos os dias da janela', () => {
    expect(windowCoversDay(base, '2026-10-15')).toBe(true)
    expect(windowCoversDay(base, '2026-10-16')).toBe(true)
    expect(windowCoversDay(base, '2026-10-17')).toBe(false)
  })
})
