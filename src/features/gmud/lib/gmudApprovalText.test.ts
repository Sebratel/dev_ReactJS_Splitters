import { describe, expect, it } from 'vitest'
import { committeeLabelOverride, describeAreasSummary, executionLabelOverride } from '@/features/gmud/lib/gmudApprovalText'

describe('describeAreasSummary', () => {
  it('não diz mais que a GMUD é aprovada só pelas áreas', () => {
    const t = describeAreasSummary({ statusAreas: 'pendente', statusComite: 'pendente', closed: false })
    expect(t).not.toMatch(/automaticamente/)
    expect(t).toMatch(/áreas e o Comitê/)
  })
  it('áreas aprovadas: depende do Comitê', () => {
    expect(describeAreasSummary({ statusAreas: 'aprovada', statusComite: 'pendente', closed: false })).toMatch(/Falta a decisão do Comitê/)
    expect(describeAreasSummary({ statusAreas: 'aprovada', statusComite: 'aprovada', closed: false })).toMatch(/está liberada/)
  })
  it('área negou', () => {
    expect(describeAreasSummary({ statusAreas: 'negada', statusComite: 'pendente', closed: false })).toMatch(/negou/)
  })
  it('protocolo encerrado com áreas pendentes não pede mais aprovação', () => {
    expect(describeAreasSummary({ statusAreas: 'pendente', statusComite: 'pendente', closed: true })).toMatch(/não são mais necessárias/)
  })
  it('encerrado mas com áreas já decididas mantém o texto da decisão', () => {
    expect(describeAreasSummary({ statusAreas: 'negada', statusComite: 'pendente', closed: true })).toMatch(/negou/)
  })
})

describe('committeeLabelOverride', () => {
  it('Pré-aprovada aprovada', () => {
    expect(committeeLabelOverride({ tipo: 'Pré-aprovada', statusComite: 'aprovada', closed: false })).toBe('Pré-aprovada (sem aprovação)')
  })
  it('encerrada com Comitê pendente', () => {
    expect(committeeLabelOverride({ tipo: 'Programada', statusComite: 'pendente', closed: true })).toBe('Encerrada sem decisão')
  })
  it('caso normal não sobrescreve', () => {
    expect(committeeLabelOverride({ tipo: 'Programada', statusComite: 'pendente', closed: false })).toBeNull()
    expect(committeeLabelOverride({ tipo: 'Programada', statusComite: 'aprovada', closed: true })).toBeNull()
  })
})

describe('executionLabelOverride', () => {
  it('cancelada sem execução', () => {
    expect(executionLabelOverride({ statusExec: 'pendente', encerradaStatus: 'cancelada', closed: true })).toBe('Não executada (cancelada)')
    expect(executionLabelOverride({ statusExec: null, encerradaStatus: 'negada', closed: true })).toBe('Não executada (negada)')
  })
  it('concluída ou em execução não muda', () => {
    expect(executionLabelOverride({ statusExec: 'concluida', encerradaStatus: 'concluida', closed: true })).toBeNull()
    expect(executionLabelOverride({ statusExec: 'pendente', encerradaStatus: 'cancelada', closed: false })).toBeNull()
  })
})
