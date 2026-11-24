import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type GmudPopSite = {
  id: number | null
  title: string
  city: string | null
  neighborhood: string | null
}

/** POPs/Sites ativos (poucas dezenas), para o campo abrir já com as opções. */
export async function fetchGmudPopSites(signal?: AbortSignal): Promise<GmudPopSite[]> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/pop-sites`, { signal })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success || !Array.isArray(result.data)) {
    throw new Error((result && typeof result.message === 'string' && result.message) || 'Falha ao listar os POPs/Sites.')
  }
  return (result.data as Array<Record<string, unknown>>)
    .map((r) => ({
      id: r.id == null ? null : Number(r.id),
      title: String(r.title ?? '').trim(),
      city: r.city ? String(r.city).trim() : null,
      neighborhood: r.neighborhood ? String(r.neighborhood).trim() : null,
    }))
    .filter((s) => s.title !== '')
}
