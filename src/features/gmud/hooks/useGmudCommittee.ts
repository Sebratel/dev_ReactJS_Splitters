import { useQuery } from '@tanstack/react-query'
import { fetchGmudCommittee } from '@/features/gmud/api/gmudCommittee'

export const GMUD_COMMITTEE_QUERY_KEY = ['gmud', 'committee'] as const

/** Comitê da GMUD (membro? quantos membros?). Quem não vê o módulo recebe erro e cai em "não membro". */
export function useGmudCommittee() {
  return useQuery({
    queryKey: GMUD_COMMITTEE_QUERY_KEY,
    queryFn: fetchGmudCommittee,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })
}

/** O usuário atual pode decidir como Comitê? (falso enquanto carrega ou em erro). */
export function useIsGmudCommitteeMember(): boolean {
  const { data } = useGmudCommittee()
  return data?.isMember === true
}
