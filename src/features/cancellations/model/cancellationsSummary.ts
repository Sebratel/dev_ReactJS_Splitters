/** Categorias de motivo de cancelamento (paridade com o BFF `cancellationsInsights`). */
export type CancellationCategory =
  | 'rede'
  | 'tecnico'
  | 'financeiro'
  | 'pre_instalacao'
  | 'mudanca'
  | 'operacional'
  | 'outros'

export type CancellationCategoryCounts = Record<CancellationCategory, number>

/** Uma linha de recorte (por AP, splitter, cidade ou mês) com a quebra por categoria. */
export type CancellationBucket = CancellationCategoryCounts & {
  key: string
  total: number
  /** Presente só no recorte por splitter. */
  slot?: number | null
  pon?: number | null
  accessPoint?: string | null
}

export type CancellationsSummary = {
  total: number
  totalsByCategory: CancellationCategoryCounts
  byAccessPoint: CancellationBucket[]
  bySplitter: CancellationBucket[]
  byCity: CancellationBucket[]
  /** Série mensal ordenada (key = YYYY-MM). */
  monthly: CancellationBucket[]
}

export const CANCELLATION_CATEGORY_LABELS: Record<CancellationCategory, string> = {
  rede: 'Rede / Qualidade',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
  pre_instalacao: 'Pré-instalação',
  mudanca: 'Mudança',
  operacional: 'Operacional',
  outros: 'Outros',
}

/** Ordem de exibição — "rede" primeiro (o churn que interessa ao planejamento). */
export const CANCELLATION_CATEGORY_ORDER: readonly CancellationCategory[] = [
  'rede',
  'tecnico',
  'financeiro',
  'pre_instalacao',
  'mudanca',
  'operacional',
  'outros',
]
