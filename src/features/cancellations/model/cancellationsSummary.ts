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

/** Tipo de local (condomínio × rua/unidade). */
export type CancellationTipoLocal = 'CONDOMÍNIO' | 'UNIDADE' | 'SEM_CLASSIFICACAO'

/** Uma linha de recorte (por AP, splitter, cidade ou mês) com a quebra por categoria. */
export type CancellationBucket = CancellationCategoryCounts & {
  key: string
  total: number
  /** Presente só no recorte por splitter. */
  slot?: number | null
  pon?: number | null
  accessPoint?: string | null
  tipoLocal?: CancellationTipoLocal
  nomeCondominio?: string | null
}

export type CancellationTipoLocalBucket = CancellationCategoryCounts & {
  key: CancellationTipoLocal
  total: number
}

/** Quebra do churn de rede: insatisfação com o serviço × migração para a concorrência. */
export type CancellationRedeSubmotives = {
  insatisfacao: number
  concorrencia: number
  outros: number
}

/** Concentração (Pareto) do churn de rede por área. */
export type CancellationConcentration = {
  redeTotal: number
  totalAreas: number
  areasFor80pct: number
  top5Share: number
  cumulative: Array<{ key: string; rede: number; cumPct: number }>
}

/** Tendência: janela recente vs. janela anterior de mesmo tamanho. */
export type CancellationTrend = {
  windowDays: number
  redeRecent: number
  redePrevious: number
  deltaPct: number
}

export type CancellationsSummary = {
  total: number
  totalsByCategory: CancellationCategoryCounts
  byAccessPoint: CancellationBucket[]
  bySplitter: CancellationBucket[]
  byCity: CancellationBucket[]
  /** Série mensal ordenada (key = YYYY-MM). */
  monthly: CancellationBucket[]
  byTipoLocal: CancellationTipoLocalBucket[]
  byCondominio: CancellationBucket[]
  redeSubmotives: CancellationRedeSubmotives
  concentration: CancellationConcentration
  trend: CancellationTrend
}

export const EMPTY_CANCELLATIONS_SUMMARY: CancellationsSummary = {
  total: 0,
  totalsByCategory: {
    rede: 0, tecnico: 0, financeiro: 0, pre_instalacao: 0,
    mudanca: 0, operacional: 0, outros: 0,
  },
  byAccessPoint: [],
  bySplitter: [],
  byCity: [],
  monthly: [],
  byTipoLocal: [],
  byCondominio: [],
  redeSubmotives: { insatisfacao: 0, concorrencia: 0, outros: 0 },
  concentration: { redeTotal: 0, totalAreas: 0, areasFor80pct: 0, top5Share: 0, cumulative: [] },
  trend: { windowDays: 30, redeRecent: 0, redePrevious: 0, deltaPct: 0 },
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
