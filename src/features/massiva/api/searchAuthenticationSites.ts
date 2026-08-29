import { bffClient } from '@/shared/api/bffClient'

export type AuthenticationSiteOption = {
  id: number | null
  /** Título do site — é também o código que vai em authenticationSiteCode (sites de POP/DC). */
  title: string
  city: string | null
  neighborhood: string | null
}

/**
 * Busca sites cadastrados no ERP (via gateway) por título (contém), para o seletor de Site
 * usado na abertura de protocolo de infraestrutura do tipo Backbone.
 * Resposta do BFF: `{ success, data: [{ id, title, city, neighborhood }] }`.
 */
export async function searchAuthenticationSites(
  query: string,
  signal?: AbortSignal,
): Promise<AuthenticationSiteOption[]> {
  const q = query.trim()
  if (q === '') return []

  const data = await bffClient.request<Record<string, unknown>>({
    path: `/api/v1/sites/search?q=${encodeURIComponent(q)}`,
    method: 'GET',
    signal,
  })

  const rows = Array.isArray(data?.data) ? (data.data as Array<Record<string, unknown>>) : []
  return rows
    .map((row) => ({
      id: row.id == null ? null : Number(row.id),
      title: String(row.title ?? '').trim(),
      city: row.city != null && String(row.city).trim() !== '' ? String(row.city).trim() : null,
      neighborhood:
        row.neighborhood != null && String(row.neighborhood).trim() !== ''
          ? String(row.neighborhood).trim()
          : null,
    }))
    .filter((s) => s.title !== '')
}
