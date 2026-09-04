import { describe, expect, it } from 'vitest'
import {
  listRecentMonths,
  parseMonthValue,
  resolveMassivaPeriod,
  toMonthValue,
} from '@/features/massiva/lib/massivaPeriod'

const NOW = new Date('2026-06-15T10:00:00')

describe('resolveMassivaPeriod', () => {
  it('custom usa o intervalo De/Até informado', () => {
    const r = resolveMassivaPeriod('custom', null, NOW, { start: '2026-06-01', end: '2026-06-05' })
    expect(r.start.getDate()).toBe(1)
    expect(r.end.getDate()).toBe(5)
    expect(r.spanDays).toBe(5)
    expect(r.label).toBe('01/jun – 05/jun')
  })

  it('custom inverte datas trocadas e não projeta além de hoje', () => {
    const r = resolveMassivaPeriod('custom', null, NOW, { start: '2026-06-30', end: '2026-06-10' })
    expect(r.start.getDate()).toBe(10)
    expect(r.end.getDate()).toBe(15) // limitado a hoje (15/06)
  })

  it('custom inválido cai em 30d', () => {
    const r = resolveMassivaPeriod('custom', null, NOW, { start: '', end: '' })
    expect(r.spanDays).toBe(30)
  })

  it('30d usa bucket diário e janela de 30 dias', () => {
    const r = resolveMassivaPeriod('30d', null, NOW)
    expect(r.bucket).toBe('day')
    expect(r.spanDays).toBe(30)
    expect(r.start.getDate()).toBe(17) // 15/06 - 29 dias = 17/05
    expect(r.start.getMonth()).toBe(4) // maio
  })

  it('90d usa bucket semanal', () => {
    expect(resolveMassivaPeriod('90d', null, NOW).bucket).toBe('week')
  })

  it('6m e 12m usam bucket mensal', () => {
    expect(resolveMassivaPeriod('6m', null, NOW).bucket).toBe('month')
    expect(resolveMassivaPeriod('12m', null, NOW).bucket).toBe('month')
  })

  it('mês específico delimita início e fim do mês e calcula mês anterior', () => {
    const r = resolveMassivaPeriod('month', '2026-05', NOW)
    expect(r.bucket).toBe('day')
    expect(r.start.getMonth()).toBe(4) // maio
    expect(r.start.getDate()).toBe(1)
    expect(r.end.getMonth()).toBe(4)
    expect(r.end.getDate()).toBe(31)
    expect(r.previousStart.getMonth()).toBe(3) // abril
    expect(r.label).toBe('mai/2026')
  })

  it('mês corrente não projeta além de hoje', () => {
    const r = resolveMassivaPeriod('month', '2026-06', NOW)
    expect(r.end.getDate()).toBe(15)
    expect(r.end.getMonth()).toBe(5)
  })

  it('mês inválido cai no mês corrente', () => {
    const r = resolveMassivaPeriod('month', 'xx', NOW)
    expect(r.start.getMonth()).toBe(5) // junho
  })

  it('janela anterior é do mesmo tamanho e imediatamente antes', () => {
    const r = resolveMassivaPeriod('30d', null, NOW)
    expect(r.previousEnd.getTime()).toBeLessThan(r.start.getTime())
    const cur = r.end.getTime() - r.start.getTime()
    const prev = r.previousEnd.getTime() - r.previousStart.getTime()
    expect(Math.abs(cur - prev)).toBeLessThan(2000)
  })
})

describe('listRecentMonths / month value', () => {
  it('lista do mais recente ao mais antigo', () => {
    const months = listRecentMonths(NOW, 3)
    expect(months.map((m) => m.value)).toEqual(['2026-06', '2026-05', '2026-04'])
    expect(months[0]?.label).toBe('jun/2026')
  })

  it('toMonthValue / parseMonthValue são inversos', () => {
    const d = new Date(2026, 0, 1)
    expect(toMonthValue(d)).toBe('2026-01')
    expect(parseMonthValue('2026-01')?.getMonth()).toBe(0)
    expect(parseMonthValue('2026-13')).toBeNull()
    expect(parseMonthValue('abc')).toBeNull()
  })
})
