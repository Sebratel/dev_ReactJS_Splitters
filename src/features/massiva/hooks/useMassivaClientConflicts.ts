import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMassivaClientConflicts } from '@/features/massiva/api/fetchMassivaClientConflicts'
import { collectMapeableAfetadosClientes } from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'
import {
  EMPTY_MASSIVA_CLIENT_CONFLICTS,
  type MassivaClientConflicts,
} from '@/features/massiva/model/massivaClientConflicts'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Hash curto (FNV-1a) só para compor a chave de cache sem uma string enorme de contratos. */
function hashIds(ids: readonly number[]): string {
  let h = 0x811c9dc5
  for (const id of ids) {
    h ^= id
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

/**
 * Quais clientes da seleção já estão em OUTRO evento aberto. Só leitura; falha silenciosa
 * (sem aviso) — nunca bloqueia a abertura.
 */
export function useMassivaClientConflicts(
  clientes: readonly SplitterCliente[],
  enabled: boolean,
): { conflicts: MassivaClientConflicts; isLoading: boolean } {
  const contractIds = useMemo(
    () =>
      [...new Set(collectMapeableAfetadosClientes([...clientes]).map((c) => c.contract!.id))].sort(
        (a, b) => a - b,
      ),
    [clientes],
  )
  const cacheKey = contractIds.length === 0 ? '' : `${contractIds.length}:${hashIds(contractIds)}`

  const query = useQuery({
    queryKey: ['massiva', 'client-conflicts', cacheKey],
    queryFn: ({ signal }) => fetchMassivaClientConflicts(contractIds, signal),
    enabled: enabled && contractIds.length > 0,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: false,
  })

  return {
    conflicts: query.data ?? EMPTY_MASSIVA_CLIENT_CONFLICTS,
    isLoading: query.isLoading,
  }
}
