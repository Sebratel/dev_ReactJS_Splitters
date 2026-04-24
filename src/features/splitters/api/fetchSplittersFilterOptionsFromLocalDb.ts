import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type SplittersFilterOptions = {
  streets: string[]
  cities: string[]
  condominiums: string[]
}

export async function fetchSplittersFilterOptionsFromLocalDb(): Promise<SplittersFilterOptions> {
  const url = `${env.localBffUrl}/api/splitters/filter-options`
  const response = await fetchWithSessionAuth(url)
  if (!response.ok) {
    throw new Error(
      `Erro ao consultar opções de filtro de splitters no BFF Local: ${response.status}`,
    )
  }

  const result = await response.json()
  const data = result?.data ?? {}
  if (!result?.success || typeof data !== 'object') {
    throw new Error('Formato de resposta inesperado ao listar opções de filtros.')
  }

  const toStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((item) => String(item ?? '').trim())
          .filter((item) => item !== '')
      : []

  return {
    streets: toStringArray((data as Record<string, unknown>).streets),
    cities: toStringArray((data as Record<string, unknown>).cities),
    condominiums: toStringArray((data as Record<string, unknown>).condominiums),
  }
}
