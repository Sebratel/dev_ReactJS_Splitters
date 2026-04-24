import { describe, expect, it, vi } from 'vitest'
import {
  computeProjectedRestorationAt,
  formatMassivaListDateDisplay,
  formatPrevisaoEncerramentoDisplay,
  formatRestorationHoursLabel,
  normalizeDateTimeLocalString,
  parseDateTimeLocalToDate,
} from '@/features/massiva/lib/formatMassivaListDate'

describe('computeProjectedRestorationAt', () => {
  it('soma ETR (h) a abertura; null se adicionar faltar', () => {
    const open = new Date(2026, 3, 23, 10, 0, 0)
    const out = computeProjectedRestorationAt(open, 30)
    expect(out).not.toBeNull()
    expect(out!.getTime()).toBe(open.getTime() + 30 * 60 * 60 * 1000)
    expect(computeProjectedRestorationAt(null, 1)).toBeNull()
    expect(computeProjectedRestorationAt(open, null)).toBeNull()
  })
})

describe('formatRestorationHoursLabel', () => {
  it('trata a API em horas (inteiro, decimal, null)', () => {
    expect(formatRestorationHoursLabel(47)).toBe('47 h')
    expect(formatRestorationHoursLabel(0)).toBe('0 h')
    expect(formatRestorationHoursLabel(1.5)).toBe('1,5 h')
    expect(formatRestorationHoursLabel(167)).toBe('167 h')
    expect(formatRestorationHoursLabel(null)).toBeNull()
  })
})

describe('formatPrevisaoEncerramentoDisplay', () => {
  it('prioriza horas (ETR); senão data', () => {
    const d = new Date('2026-01-02T15:30:00.000Z')
    expect(
      formatPrevisaoEncerramentoDisplay(d, 47),
    ).toBe('47 h')
    expect(formatPrevisaoEncerramentoDisplay(d, null)).toMatch(/02/)
    expect(
      formatPrevisaoEncerramentoDisplay(null, null),
    ).toBe('—')
  })
})

describe('normalizeDateTimeLocalString + parseDateTimeLocalToDate', () => {
  it('paddeia minutos/horas e parseia em fuso local', () => {
    expect(normalizeDateTimeLocalString('2026-04-30T10:0')).toBe('2026-04-30T10:00')
    const d = parseDateTimeLocalToDate('2026-04-30T9:5')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(3)
    expect(d!.getDate()).toBe(30)
    expect(d!.getHours()).toBe(9)
    expect(d!.getMinutes()).toBe(5)
  })
})

describe('formatMassivaListDateDisplay', () => {
  it('formata em pt-BR, trata null e Intl com falha', () => {
    const d = new Date('2026-01-02T15:30:00.000Z')
    expect(formatMassivaListDateDisplay(d)).toMatch(/02/)
    expect(formatMassivaListDateDisplay(null)).toBe('—')
    expect(formatMassivaListDateDisplay(new Date(Number.NaN))).toBe('—')

    const fmt = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('fail')
    })
    expect(formatMassivaListDateDisplay(new Date())).toBe('—')
    fmt.mockRestore()
  })
})
