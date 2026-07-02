import type {
  CancellationCategory,
  CancellationCategoryCounts,
} from '@/features/cancellations/model/cancellationsSummary'

/** Uma ocorrência de cancelamento (deduplicada por contrato) na timeline do splitter. */
export type SplitterCancellationEvent = {
  canceledAt: string
  category: CancellationCategory
  city: string | null
}

/** Série mensal do splitter (key = YYYY-MM) com a quebra por categoria. */
export type SplitterCancellationMonth = CancellationCategoryCounts & {
  key: string
  total: number
}

/** Correlação com a última massiva: churn na janela de N dias após o evento. */
export type SplitterCancellationPostEvent = {
  at: string
  windowDays: number
  redeCount: number
  totalCount: number
}

export type SplitterCancellations = {
  total: number
  totalsByCategory: CancellationCategoryCounts
  monthly: SplitterCancellationMonth[]
  timeline: SplitterCancellationEvent[]
  /** Presente só quando um `eventAt` (última massiva) foi informado. */
  postEvent: SplitterCancellationPostEvent | null
}

export const EMPTY_SPLITTER_CANCELLATIONS: SplitterCancellations = {
  total: 0,
  totalsByCategory: {
    rede: 0, tecnico: 0, financeiro: 0, pre_instalacao: 0,
    mudanca: 0, operacional: 0, outros: 0,
  },
  monthly: [],
  timeline: [],
  postEvent: null,
}
