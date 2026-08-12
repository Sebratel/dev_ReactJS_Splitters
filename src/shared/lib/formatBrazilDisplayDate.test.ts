import { describe, expect, it } from 'vitest'
import {
  formatBrazilCompactDateTimeDisplay,
  formatBrazilDateDisplay,
  formatBrazilDateTimeShortDisplay,
  formatBrazilDayMonthDisplay,
  formatBrazilDayMonthTimeDisplay,
} from '@/shared/lib/formatBrazilDisplayDate'

describe('formatBrazilDisplayDate', () => {
  it('converte ISO UTC para horário de São Paulo', () => {
    const value = formatBrazilDateTimeShortDisplay('2026-05-14T20:59:36.000Z')
    expect(value).toMatch(/14\/05\/2026/)
    expect(value).toMatch(/17:59/)
  })

  it('formata dia e mês no fuso de São Paulo', () => {
    const value = formatBrazilDayMonthDisplay('2026-05-14T20:59:36.000Z')
    expect(value).toBe('14/05')
  })

  // O mesmo instante em todas as variantes: a data local em São Paulo é 14/05 às 17:59,
  // três horas atrás do UTC. Se alguma variante trocar de fuso, sai daqui.
  it('formata só a data em dd/MM/yyyy', () => {
    expect(formatBrazilDateDisplay('2026-05-14T20:59:36.000Z')).toBe('14/05/2026')
  })

  it('formata dia, mês e hora sem o ano', () => {
    expect(formatBrazilDayMonthTimeDisplay('2026-05-14T20:59:36.000Z')).toMatch(
      /^14\/05,? 17:59$/,
    )
  })

  it('formata a versão compacta com o mês por extenso', () => {
    const value = formatBrazilCompactDateTimeDisplay('2026-05-14T20:59:36.000Z')
    expect(value).toMatch(/14/)
    expect(value).toMatch(/mai/i)
    expect(value).toMatch(/17:59/)
  })

  // Todas as variantes partilham o mesmo guard de entrada inválida.
  it.each([
    ['formatBrazilDateDisplay', formatBrazilDateDisplay],
    ['formatBrazilDateTimeShortDisplay', formatBrazilDateTimeShortDisplay],
    ['formatBrazilDayMonthTimeDisplay', formatBrazilDayMonthTimeDisplay],
    ['formatBrazilCompactDateTimeDisplay', formatBrazilCompactDateTimeDisplay],
    ['formatBrazilDayMonthDisplay', formatBrazilDayMonthDisplay],
  ])('%s devolve o fallback para entrada vazia ou inválida', (_nome, formatar) => {
    expect(formatar(null)).toBe('—')
    expect(formatar(undefined)).toBe('—')
    expect(formatar('não é data')).toBe('—')
    expect(formatar(null, 'sem data')).toBe('sem data')
  })
})
