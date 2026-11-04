import { useQuery } from '@tanstack/react-query'
import { fetchGmudList } from '@/features/gmud/api/fetchGmudList'
import type { GmudListFilter, GmudSort } from '@/features/gmud/model/gmud'

/** Painel de GMUDs: lista paginada (do Voalle) com busca opcional. */
export function useGmudList(params: { limit?: number; offset?: number; q?: string; filter?: GmudListFilter; sort?: GmudSort }) {
  return useQuery({
    queryKey: ['gmud', 'list', params.limit ?? null, params.offset ?? null, params.q ?? null, params.filter ?? 'todas', params.sort?.key ?? null, params.sort?.dir ?? null],
    queryFn: () => fetchGmudList(params),
    // A lista precisa refletir cancelamento/aprovação/conclusão feitos em outras telas ou por outra pessoa:
    // sempre rebusca ao voltar para a tela, ao focar a aba e a cada 60s (só com a aba visível).
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
}
