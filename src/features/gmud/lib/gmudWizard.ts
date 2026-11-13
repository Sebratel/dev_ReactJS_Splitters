import type { GmudPendencia } from '@/features/gmud/model/gmudForm'

export type WizardCategoria = 'rede_externa' | 'sistemas_internos' | 'sistemas_externos'

export type WizardStep = {
  key: 'identificacao' | 'oQueSeraFeito' | 'impacto' | 'aprovadores' | 'revisao'
  label: string
  /** Títulos dos cartões (seções) que aparecem nesta etapa, na ordem da tela. A revisão não tem seções. */
  sections: string[]
}

const FINAL: WizardStep = { key: 'revisao', label: 'Revisão', sections: [] }
const APROVADORES: WizardStep = {
  key: 'aprovadores',
  label: 'Aprovadores e janela',
  sections: ['Recursos administrativos', 'Janela de mudança', 'Observações (opcional)'],
}

/** As cinco etapas do formulário de GMUD; o miolo muda conforme a categoria. */
export function wizardSteps(categoria: WizardCategoria): WizardStep[] {
  const ident: WizardStep = { key: 'identificacao', label: 'Identificação', sections: ['Identificação'] }
  if (categoria === 'sistemas_internos') {
    return [
      ident,
      { key: 'oQueSeraFeito', label: 'O que será feito', sections: ['Sistema', 'Descrição'] },
      { key: 'impacto', label: 'Impacto e execução', sections: ['Impacto', 'Execução'] },
      APROVADORES,
      FINAL,
    ]
  }
  if (categoria === 'sistemas_externos') {
    return [
      ident,
      { key: 'oQueSeraFeito', label: 'O que será feito', sections: ['Sistema e fornecedor', 'Mudança prevista'] },
      { key: 'impacto', label: 'Impacto e contingência', sections: ['Impacto', 'Contingência'] },
      APROVADORES,
      FINAL,
    ]
  }
  return [
    ident,
    { key: 'oQueSeraFeito', label: 'O que será feito', sections: ['Atividade', 'Ambiente afetado'] },
    { key: 'impacto', label: 'Impacto e execução', sections: ['Impacto', 'Execução'] },
    APROVADORES,
    FINAL,
  ]
}

/** Pendências que pertencem às seções de uma etapa. */
export function pendenciasDaEtapa(pendencias: GmudPendencia[], step: WizardStep): GmudPendencia[] {
  return pendencias.filter((p) => step.sections.includes(p.section))
}

/** Índice da primeira etapa com pendência, ou -1 se não houver. */
export function primeiraEtapaPendente(steps: WizardStep[], pendencias: GmudPendencia[]): number {
  return steps.findIndex((s) => pendenciasDaEtapa(pendencias, s).length > 0)
}

export type WizardState = 'done' | 'current' | 'pending' | 'attention'

/**
 * Estado de cada etapa na linha do tempo: a atual em destaque; as já visitadas completas ou com atenção
 * (voltou e deixou pendência); as que ainda não foram alcançadas ficam pendentes.
 */
export function wizardStates(steps: WizardStep[], current: number, maxReached: number, pendencias: GmudPendencia[]): WizardState[] {
  return steps.map((s, i) => {
    if (i === current) return 'current'
    if (i > maxReached) return 'pending'
    if (s.key === 'revisao') return 'pending'
    return pendenciasDaEtapa(pendencias, s).length > 0 ? 'attention' : 'done'
  })
}
