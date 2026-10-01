import { useQuery } from '@tanstack/react-query'
import { fetchGmudList } from '@/features/gmud/api/fetchGmudList'

/** Painel de GMUDs: lista paginada (do Voalle) com busca opcional. */
export function useGmudList(params: { limit?: number; offset?: number; q?: string }) {
  return useQuery({
    queryKey: ['gmud', 'list', params.limit ?? null, params.offset ?? null, params.q ?? null],
    queryFn: () => fetchGmudList(params),
    staleTime: 30_000,
  })
}
