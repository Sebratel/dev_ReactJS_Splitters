import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isPrevisaoEncerramentoAjustadaExplicata,
  recordMassivaPrevisaoEncerramentoEdit,
  resolveExpectedCloseAtForDisplay,
} from '@/features/massiva/lib/massivaPrevisaoLocalEditor'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const base: MassivaTicket = {
  protocol: 1,
  assignmentId: null,
  title: '',
  description: '',
  apCode: '',
  splitterCode: '',
  team: '',
  createdBy: '',
  responsible: '',
  status: 'aberta',
  openedAt: new Date(2026, 3, 23, 10, 0, 0),
  expectedCloseAt: new Date(2026, 3, 25, 3, 5, 0),
  previsaoEncerramentoAtualizadaPor: '',
  estimateTimeOfRestoration: 12,
  closedAt: null,
  affectedClients: 0,
  usedFallback: false,
}

describe('resolveExpectedCloseAtForDisplay', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('se o último Salvar local difere do BFF, mostra a data do Salvar', () => {
    const salvo = new Date(2026, 3, 30, 10, 0, 0)
    recordMassivaPrevisaoEncerramentoEdit(1, { closeAt: salvo })
    const out = resolveExpectedCloseAtForDisplay(base)
    expect(out?.getTime()).toBe(salvo.getTime())
  })

  it('quando BFF alinha com o Salvar, usa a do ticket', () => {
    const t = new Date(2026, 3, 30, 10, 0, 0)
    recordMassivaPrevisaoEncerramentoEdit(1, { closeAt: t })
    const out = resolveExpectedCloseAtForDisplay({
      ...base,
      expectedCloseAt: t,
    })
    expect(out?.getTime()).toBe(t.getTime())
  })
})

describe('isPrevisaoEncerramentoAjustadaExplicata', () => {
  it('BFF a expor auditor marca legenda Ajustado', () => {
    const d = new Date(2026, 3, 25, 3, 5, 0)
    expect(
      isPrevisaoEncerramentoAjustadaExplicata(
        { ...base, previsaoEncerramentoAtualizadaPor: 'X' },
        { matchesSla: true, hasValidProjection: true, effectiveCloseAt: d },
      ),
    ).toBe(true)
  })

  it('fim de prazo difere da projeção (abertura+ETR) marca ajuste', () => {
    const d = new Date(2026, 3, 25, 3, 5, 0)
    expect(
      isPrevisaoEncerramentoAjustadaExplicata(base, {
        matchesSla: false,
        hasValidProjection: true,
        effectiveCloseAt: d,
      }),
    ).toBe(true)
  })

  it('não assinalha sem data de fim', () => {
    expect(
      isPrevisaoEncerramentoAjustadaExplicata(
        { ...base, expectedCloseAt: null },
        { matchesSla: false, hasValidProjection: true, effectiveCloseAt: null },
      ),
    ).toBe(false)
  })

  it('quando a projeção coincide com o SLA e não há BFF, não força ajuste', () => {
    const open = new Date(2026, 3, 23, 10, 0, 0)
    const etrH = 12
    const close = new Date(open.getTime() + etrH * 60 * 60 * 1000)
    expect(
      isPrevisaoEncerramentoAjustadaExplicata(
        {
          ...base,
          openedAt: open,
          expectedCloseAt: close,
          estimateTimeOfRestoration: etrH,
        },
        { matchesSla: true, hasValidProjection: true, effectiveCloseAt: close },
      ),
    ).toBe(false)
  })

  it('Salvar local diferente do BFF: marca ajuste mesmo com listagem antiga', () => {
    localStorage.clear()
    const salvo = new Date(2026, 3, 30, 10, 0, 0)
    recordMassivaPrevisaoEncerramentoEdit(1, { closeAt: salvo })
    const effective = resolveExpectedCloseAtForDisplay(base)
    expect(
      isPrevisaoEncerramentoAjustadaExplicata(base, {
        matchesSla: false,
        hasValidProjection: true,
        effectiveCloseAt: effective,
      }),
    ).toBe(true)
  })
})
