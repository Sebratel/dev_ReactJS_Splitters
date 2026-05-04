import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { SplittersFetchParams } from '@/features/splitters/api/fetchSplittersFromLocalDb'
import type {
  SplitterMassivaStats,
  SplitterOperationalScore,
} from '@/features/splitters/model/splitterOperationalInsights'

export type OperationalPriorityApiRow = {
  splitter: {
    code: string
    title: string
    busyCount: number
    outPorts: number
  }
  massivaStats: SplitterMassivaStats
  operationalScore: SplitterOperationalScore
}

export type OperationalPriorityApiResponse = {
  success: boolean
  totalCount: number
  scannedCount: number
  truncated: boolean
  massivaSource?: string
  data: OperationalPriorityApiRow[]
}

/**
 * Uma única chamada ao BFF: prioridade operacional sobre todo o universo filtrado.
 * O servidor pagina internamente e usa histórico MySQL de massivas (quando configurado).
 */
export async function fetchSplittersOperationalPriorityFromLocalDb(
  params: Omit<SplittersFetchParams, 'page' | 'limit'>,
): Promise<OperationalPriorityApiResponse> {
  const queryParams = new URLSearchParams({
    search: params.search ?? '',
  })

  const olts = params.olts ?? []
  if (olts.length > 0) queryParams.append('olts', olts.join(','))
  const primarySplitters = params.primarySplitters ?? []
  if (primarySplitters.length > 0) {
    queryParams.append('primarySplitters', primarySplitters.join(','))
  }
  const statuses = params.statuses ?? []
  if (statuses.length > 0) queryParams.append('statuses', statuses.join(','))
  const streets = params.streets ?? []
  if (streets.length > 0) queryParams.append('streets', streets.join(','))
  const cities = params.cities ?? []
  if (cities.length > 0) queryParams.append('cities', cities.join(','))
  const condominiums = params.condominiums ?? []
  if (condominiums.length > 0) queryParams.append('condominiums', condominiums.join(','))
  if (params.withOpenMassiva !== undefined) {
    queryParams.append('withOpenMassiva', params.withOpenMassiva ? '1' : '0')
  }
  const openMassivaSplitterCodes = params.openMassivaSplitterCodes ?? []
  if (openMassivaSplitterCodes.length > 0) {
    queryParams.append('openMassivaSplitterCodes', openMassivaSplitterCodes.join(','))
  }
  const corporate = params.corporateClientFilter ?? 'all'
  if (corporate === 'with-corporate') queryParams.append('corporateClients', 'with')
  else if (corporate === 'without-corporate') queryParams.append('corporateClients', 'without')

  if (params.withMaintenance !== undefined) {
    queryParams.append('withMaintenance', params.withMaintenance ? '1' : '0')
  }
  const maintenanceSplitterCodes = params.maintenanceSplitterCodes ?? []
  if (maintenanceSplitterCodes.length > 0) {
    queryParams.append('maintenanceSplitterCodes', maintenanceSplitterCodes.join(','))
  }

  const url = `${env.localBffUrl}/api/splitters/operational-priority?${queryParams.toString()}`
  const response = await fetchWithSessionAuth(url)
  if (!response.ok) {
    throw new Error(`Erro ao consultar prioridade operacional: ${response.status}`)
  }
  const result = (await response.json()) as OperationalPriorityApiResponse
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF (prioridade operacional).')
  }
  return result
}
