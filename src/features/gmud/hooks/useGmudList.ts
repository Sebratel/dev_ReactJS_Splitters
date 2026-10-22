import { useQuery } from '@tanstack/react-query'
import { fetchGmudList } from '@/features/gmud/api/fetchGmudList'
import type { GmudListFilter, GmudSort } from '@/features/gmud/model/gmud'

/** Painel de GMUDs: lista paginada (do Voalle) com busca opcional. */
export function useGmudList(params: { limit?: number; offset?: number; q?: string; filter?: GmudListFilter; sort?: GmudSort }) {
  return useQuery({
    queryKey: ['gmud', 'list', params.limit ?? null, params.offset ?? null, params.q ?? null, params.filter ?? 'todas', params.sort?.key ?? null, params.sort?.dir ?? null],
    queryFn: () => fetchGmudList(params),
    staleTime: 30_000,
  })
}
