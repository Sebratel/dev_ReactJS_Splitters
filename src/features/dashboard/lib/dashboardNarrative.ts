import { formatBrazilCompactDateTimeDisplay } from '@/shared/lib/formatBrazilDisplayDate'

/** Chaves alinhadas aos KPIs do dashboard — microcopy para tendências diárias (`vs. última captura`). */
export type DashboardTrendKey =
  | 'occupiedPorts'
  | 'activeSplitters'
  | 'oltCount'
  | 'massivaOpen'
  | 'massivaAffected'

const EPS = 0.05

/** Uma linha curta que interpreta o delta % em linguagem operacional (português). */
export function interpretTrendDelta(
  key: DashboardTrendKey,
  pct: number | null | undefined,
): string | undefined {
  if (pct == null || !Number.isFinite(pct)) return undefined
  if (Math.abs(pct) < EPS) return 'Estável face ao último snapshot diário.'

  const up = pct > 0
  switch (key) {
    case 'occupiedPorts':
      return up
        ? 'Mais portas ocupadas que no snapshot anterior.'
        : 'Menos portas ocupadas que no snapshot anterior.'
    case 'activeSplitters':
      return up
        ? 'Catálogo com mais splitters que no snapshot anterior.'
        : 'Catálogo com menos splitters que no snapshot anterior.'
    case 'oltCount':
      return up
        ? 'Mais OLTs ativas que no snapshot anterior.'
        : 'Menos OLTs ativas que no snapshot anterior.'
    case 'massivaOpen':
      return up
        ? 'Mais massivas abertas que no snapshot anterior.'
        : 'Menos massivas abertas que no snapshot anterior.'
    case 'massivaAffected':
      return up
        ? 'Mais clientes afetados em massivas abertas vs. snapshot anterior.'
        : 'Menos clientes afetados em massivas abertas vs. snapshot anterior.'
    default:
      return undefined
  }
}

export type DashboardStatusLineInput = {
  isLoadingStats: boolean
  massivaKpisPending: boolean
  openMassivas: number
  affectedClients: number
  /** `null` quando não há capacidade total no BFF. */
  networkCapacityPercent: number | null
}

/** Resumo de uma linha para o hero — prioriza incidentes e complementa com ocupação global quando existir. */
export function buildDashboardStatusLine(input: DashboardStatusLineInput): string {
  const {
    isLoadingStats,
    massivaKpisPending,
    openMassivas,
    affectedClients,
    networkCapacityPercent,
  } = input

  if (isLoadingStats && massivaKpisPending) {
    return 'A sincronizar indicadores com o serviço de estatísticas…'
  }

  const incidentParts: string[] = []
  if (openMassivas > 0) {
    incidentParts.push(
      `${openMassivas} massiva${openMassivas === 1 ? '' : 's'} aberta${openMassivas === 1 ? '' : 's'}`,
    )
    incidentParts.push(
      `${affectedClients.toLocaleString('pt-BR')} cliente${affectedClients === 1 ? '' : 's'} com impacto em aberto`,
    )
  } else {
    incidentParts.push('Nenhuma massiva aberta no momento')
  }

  if (
    networkCapacityPercent != null &&
    !isLoadingStats &&
    Number.isFinite(networkCapacityPercent)
  ) {
    const pctLabel = networkCapacityPercent.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    incidentParts.push(
      `ocupação da rede ${pctLabel}% da capacidade declarada no catálogo`,
    )
  }

  return incidentParts.join(' · ')
}

/** Nota curta com horário da última resposta bem-sucedida do React Query para `/api/stats`. */
export function formatNetworkStatsRefreshNote(dataUpdatedAt: number | undefined): string | null {
  if (dataUpdatedAt == null || dataUpdatedAt <= 0) return null
  const formatted = formatBrazilCompactDateTimeDisplay(dataUpdatedAt, '')
  if (!formatted) return null
  return `Dados agregados da rede atualizados às ${formatted}.`
}

export type HeroChipAccent = 'live' | 'warn' | 'calm' | 'meta'

export type DashboardHeroChip = {
  id: string
  text: string
  accent: HeroChipAccent
}

/** Segmentos curtos para pills no hero — substitui o parágrafo único denso. */
export function buildDashboardHeroChips(input: DashboardStatusLineInput): DashboardHeroChip[] {
  const {
    isLoadingStats,
    massivaKpisPending,
    openMassivas,
    affectedClients,
    networkCapacityPercent,
  } = input

  if (isLoadingStats && massivaKpisPending) {
    return [{ id: 'sync', text: 'A sincronizar indicadores…', accent: 'meta' }]
  }

  const chips: DashboardHeroChip[] = []

  if (openMassivas > 0) {
    chips.push({
      id: 'massivas',
      text: `${openMassivas} massiva${openMassivas === 1 ? '' : 's'} aberta${openMassivas === 1 ? '' : 's'}`,
      accent: 'warn',
    })
    chips.push({
      id: 'impact',
      text: `${affectedClients.toLocaleString('pt-BR')} cliente${affectedClients === 1 ? '' : 's'} em impacto`,
      accent: 'warn',
    })
  } else {
    chips.push({ id: 'calm', text: 'Sem massivas abertas', accent: 'calm' })
  }

  if (
    networkCapacityPercent != null &&
    !isLoadingStats &&
    Number.isFinite(networkCapacityPercent)
  ) {
    const pctLabel = networkCapacityPercent.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    chips.push({
      id: 'capacity',
      text: `Ocupação global ${pctLabel}%`,
      accent: 'live',
    })
  }

  return chips
}

/** Uma linha discreta só com data/hora da última atualização dos dados agregados. */
export function formatRefreshChipShort(dataUpdatedAt: number | undefined): string | null {
  if (dataUpdatedAt == null || dataUpdatedAt <= 0) return null
  const formatted = formatBrazilCompactDateTimeDisplay(dataUpdatedAt, '')
  if (!formatted) return null
  return `Atualizado ${formatted}`
}
