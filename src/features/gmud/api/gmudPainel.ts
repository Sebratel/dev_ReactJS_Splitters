import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { queryDaApi, type GmudPainelApiParams } from '@/features/gmud/lib/gmudPainelFiltros'
import type { GmudListResult, GmudSort } from '@/features/gmud/model/gmud'

/** Contagem de cada aba do painel (com os filtros ativos) e das canceladas na aba atual. */
export type GmudPainelContagens = { todas: number; minhas: number; aguardando: number; vencidas: number; semana: number; canceladas: number }

async function ler<T>(caminho: string, falha: string): Promise<T> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}${caminho}`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error((result && typeof result.message === 'string' && result.message) || falha)
  }
  return result.data as T
}

export function fetchGmudPainelLista(input: { api: GmudPainelApiParams; limit: number; offset: number; sort: GmudSort }): Promise<GmudListResult> {
  const extra: Record<string, string> = { limit: String(input.limit), sort: input.sort.key, dir: input.sort.dir }
  if (input.offset > 0) extra.offset = String(input.offset)
  return ler<GmudListResult>(`/api/gmud/list?${queryDaApi(input.api, extra)}`, 'Falha ao carregar as GMUDs.')
}

export function fetchGmudPainelContagens(api: GmudPainelApiParams): Promise<GmudPainelContagens> {
  return ler<GmudPainelContagens>(`/api/gmud/list-counts?${queryDaApi(api)}`, 'Falha ao carregar as contagens das GMUDs.')
}

export async function fetchGmudSolicitantes(): Promise<string[]> {
  const data = await ler<{ items?: unknown }>('/api/gmud/list-solicitantes', 'Falha ao carregar os solicitantes das GMUDs.')
  return Array.isArray(data.items) ? data.items.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : []
}

const ATUALIZACAO = { staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 60_000 } as const

/** Lista do painel: mantém a página anterior na tela enquanto a nova carrega (sem piscar). */
export function useGmudPainelLista(input: { api: GmudPainelApiParams; limit: number; offset: number; sort: GmudSort }) {
  return useQuery({
    queryKey: ['gmud', 'list', 'painel', input.api, input.limit, input.offset, input.sort.key, input.sort.dir],
    queryFn: () => fetchGmudPainelLista(input),
    placeholderData: keepPreviousData,
    ...ATUALIZACAO,
  })
}

export function useGmudPainelContagens(api: GmudPainelApiParams) {
  return useQuery({
    queryKey: ['gmud', 'list', 'contagens', api],
    queryFn: () => fetchGmudPainelContagens(api),
    placeholderData: keepPreviousData,
    ...ATUALIZACAO,
  })
}

/** Nomes para o filtro "Solicitante"; só busca quando o filtro é aberto. */
export function useGmudSolicitantes(enabled: boolean) {
  return useQuery({ queryKey: ['gmud', 'list', 'solicitantes'], queryFn: fetchGmudSolicitantes, staleTime: 5 * 60_000, enabled })
}
