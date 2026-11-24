import { useQuery } from '@tanstack/react-query'
import { fetchMassivaConferenciaStatus } from '@/features/massiva/api/fetchMassivaConferenciaStatus'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'

/** A conferência roda a cada poucos minutos; 60 s mantém a tela fresca sem sobrecarregar o backend. */
export const CONFERENCIA_STATUS_REFETCH_MS = 60_000
const CONFERENCIA_STATUS_STALE_MS = 30_000

/** Estado da conferência com o Elleven (usado na aba Qualidade e no cartão Saúde das APIs). */
export function useMassivaConferenciaStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: massivaKeys.conferenciaStatus(),
    queryFn: fetchMassivaConferenciaStatus,
    enabled: options?.enabled ?? true,
    staleTime: CONFERENCIA_STATUS_STALE_MS,
    refetchInterval: CONFERENCIA_STATUS_REFETCH_MS,
    retry: 1,
  })
}
