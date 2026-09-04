import { describe, expect, it } from 'vitest'
import { buildUsageCsv } from './exportUsageCsv'
import type { UsageSummary } from '@/features/analytics/model/usageSummary'

const BOM = '﻿'

function makeSummary(): UsageSummary {
  return {
    range: { start: '', end: '' },
    totals: { events: 0, activeUsers: 0, sessions: 0 },
    byModule: [],
    byUser: [],
    byUserModule: [
      { email: 'ana@sebratel.com.br', name: 'Ana; Silva', module: 'massiva', events: 10 },
      { email: 'ana@sebratel.com.br', name: 'Ana; Silva', module: 'splitters', events: 3 },
      { email: 'bruno@sebratel.com.br', name: 'Bruno', module: 'massiva', events: 7 },
    ],
    byHour: [],
    byDay: [],
    byAction: [],
  }
}

describe('buildUsageCsv', () => {
  it('gera cabeçalho + linhas usuário×módulo com rótulo amigável', () => {
    const csv = buildUsageCsv(makeSummary())
    const lines = csv.replace(new RegExp(`^${BOM}`), '').split('\r\n')
    expect(lines[0]).toBe('Usuário;E-mail;Módulo;Acessos')
    // Ordenado por e-mail: ana antes de bruno
    expect(lines[1]).toContain('ana@sebratel.com.br')
    expect(lines[1]).toContain('Massivas')
    expect(lines[3]).toContain('bruno@sebratel.com.br')
  })

  it('escapa campos com o separador (;) entre aspas', () => {
    const csv = buildUsageCsv(makeSummary())
    expect(csv).toContain('"Ana; Silva"')
  })

  it('inclui BOM para o Excel', () => {
    expect(buildUsageCsv(makeSummary()).startsWith(BOM)).toBe(true)
  })
})
