import { describe, expect, it } from 'vitest'
import {
  formatBrazilDateTimeShortDisplay,
  formatBrazilDayMonthDisplay,
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
})
