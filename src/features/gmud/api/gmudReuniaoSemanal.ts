import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { GmudReuniaoSemanal, GmudReuniaoSemanas } from '@/features/gmud/lib/gmudReuniaoSemana'

/** Reunião semanal: o que foi feito numa semana e o que vem na outra (só GMUDs registradas na plataforma). */
export async function fetchGmudReuniaoSemanal(semanas: GmudReuniaoSemanas): Promise<GmudReuniaoSemanal> {
  const qs = new URLSearchParams(semanas).toString()
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/reuniao-semanal?${qs}`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message =
      (result && typeof result.message === 'string' && result.message) || 'Falha ao carregar a reunião semanal de GMUDs.'
    throw new Error(message)
  }
  const data = result.data as Partial<GmudReuniaoSemanal> | null
  return { feito: Array.isArray(data?.feito) ? data.feito : [], vem: Array.isArray(data?.vem) ? data.vem : [] }
}

export function useGmudReuniaoSemanal(semanas: GmudReuniaoSemanas) {
  return useQuery({
    queryKey: ['gmud', 'reuniao-semanal', semanas.feitoDe, semanas.feitoAte, semanas.vemDe, semanas.vemAte],
    queryFn: () => fetchGmudReuniaoSemanal(semanas),
    // Ao trocar de semana, a semana anterior fica na tela até a nova chegar (sem piscar).
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
