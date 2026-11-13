import { useQuery } from '@tanstack/react-query'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

/** Números dos indicadores do topo do painel; cada um é igual ao total do filtro de mesmo nome. */
export type GmudListSummary = {
  abertas: number
  vencidas: number
  vencemSemana: number
  comitePendente: number
}

export async function fetchGmudListSummary(): Promise<GmudListSummary> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/list-summary`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message =
      (result && typeof result.message === 'string' && result.message) || 'Falha ao carregar o resumo das GMUDs.'
    throw new Error(message)
  }
  return result.data as GmudListSummary
}

export function useGmudListSummary() {
  return useQuery({
    queryKey: ['gmud', 'list-summary'],
    queryFn: fetchGmudListSummary,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
}
