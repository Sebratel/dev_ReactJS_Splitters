import { describe, expect, it, vi } from 'vitest'
import {
  computeProjectedRestorationAt,
  formatMassivaListDateDisplay,
  formatPrevisaoEncerramentoDisplay,
  formatRestorationHoursLabel,
  normalizeDateTimeLocalString,
  parseDateTimeLocalToDate,
  pickRestorationHoursForDisplay,
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

  it('ignora ETR absurdo quando abertura e previsão batem (~3 h)', () => {
    const opened = new Date(2026, 5, 8, 15, 42, 0)
    const close = new Date(2026, 5, 8, 18, 42, 0)
    expect(
      formatPrevisaoEncerramentoDisplay(close, 1420, opened),
    ).toBe('3 h')
  })
})

describe('pickRestorationHoursForDisplay', () => {
  it('prefere diferença entre datas quando ETR do Elleven diverge', () => {
    const opened = new Date(2026, 5, 8, 14, 0, 0)
    const close = new Date(2026, 5, 8, 17, 0, 0)
    expect(pickRestorationHoursForDisplay(opened, close, 1419)).toBe(3)
    expect(pickRestorationHoursForDisplay(opened, close, 3)).toBe(3)
  })

  it('recalcula horas quando a previsão foi ajustada manualmente (Editar)', () => {
    const opened = new Date(2026, 5, 8, 17, 22, 0)
    const closeOriginal = new Date(2026, 5, 8, 20, 19, 0)
    const etr = 2.95
    expect(pickRestorationHoursForDisplay(opened, closeOriginal, etr)).toBeCloseTo(etr, 2)

    const closeExtended = new Date(2026, 5, 8, 22, 0, 0)
    expect(pickRestorationHoursForDisplay(opened, closeExtended, etr)).toBeCloseTo(4.633, 2)

    const closeShortened = new Date(2026, 5, 8, 18, 0, 0)
    expect(pickRestorationHoursForDisplay(opened, closeShortened, etr)).toBeCloseTo(0.633, 2)
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
