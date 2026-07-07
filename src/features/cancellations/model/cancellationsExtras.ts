import type { CancellationTipoLocal } from '@/features/cancellations/model/cancellationsSummary'

/** Base ativa (clientes conectados) por tipo de local e por condomínio — denominador da taxa. */
export type CancellationsActiveBase = {
  total: number
  byTipoLocal: { 'CONDOMÍNIO': number; UNIDADE: number }
  byCondominio: Record<string, number>
}

export const EMPTY_ACTIVE_BASE: CancellationsActiveBase = {
  total: 0,
  byTipoLocal: { 'CONDOMÍNIO': 0, UNIDADE: 0 },
  byCondominio: {},
}

/** Uma área em risco: massiva seguida de churn de rede na janela pós-evento. */
export type MassivaImpactRow = {
  splitterTitle: string
  tipoLocal: CancellationTipoLocal
  nomeCondominio: string | null
  eventAt: string | null
  eventsCount: number
  redeCount: number
  totalCount: number
}

export type MassivaImpact = {
  windowDays: number
  eventsCount: number
  /** false quando o histórico de massivas (MySQL) não pôde ser consultado. */
  massivaAvailable: boolean
  ranking: MassivaImpactRow[]
}

export const EMPTY_MASSIVA_IMPACT: MassivaImpact = {
  windowDays: 30,
  eventsCount: 0,
  massivaAvailable: false,
  ranking: [],
}
