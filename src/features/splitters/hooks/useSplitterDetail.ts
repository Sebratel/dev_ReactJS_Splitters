import { useQuery } from '@tanstack/react-query'
import { fetchSplitterByCode } from '@/features/splitters/api/fetchSplitterByCode'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import type { Splitter } from '@/features/splitters/model/splitter'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/**
 * Busca os dados completos de um splitter pelo seu código via endpoint dedicado.
 *
 * Anteriormente usava a query da listagem (limit: 1000) e buscava em memória,
 * o que causava "Splitter não encontrado" para splitters além da posição 1000
 * ou quando nenhuma página estava em cache.
 *
 * Agora usa GET /api/splitters-by-code/:code — query direta, sem paginação.
 */
export type SplitterDetailViewState =
  | { status: 'invalid-param' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'not-found' }
  | { status: 'ready'; splitter: Splitter }

function normalizeRouteCodeParam(codeParam: string | undefined): string {
  const raw = (codeParam ?? '').trim()
  if (raw === '') return ''
  try {
    return decodeURIComponent(raw).trim()
  } catch {
    return raw
  }
}

export function useSplitterDetail(codeParam: string | undefined): {
  state: SplitterDetailViewState
  refetch: () => void
} {
  const code = normalizeRouteCodeParam(codeParam)

  const query = useQuery({
    queryKey: [...splittersKeys.detail(code)],
    queryFn: () => fetchSplitterByCode(code),
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
    enabled: code.length > 0,
    refetchOnMount: 'always',
  })

  const refetch = () => {
    void query.refetch()
  }

  if (code.length === 0) {
    return { state: { status: 'invalid-param' }, refetch }
  }

  if (query.isPending) {
    return { state: { status: 'loading' }, refetch }
  }

  if (query.isError) {
    return {
      state: { status: 'error', error: query.error },
      refetch,
    }
  }

  if (query.data === null || query.data === undefined) {
    return { state: { status: 'not-found' }, refetch }
  }

  return {
    state: { status: 'ready', splitter: query.data },
    refetch,
  }
}
