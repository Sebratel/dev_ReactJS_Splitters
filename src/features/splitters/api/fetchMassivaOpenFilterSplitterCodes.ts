import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { env } from '@/shared/config/env'

export async function fetchMassivaOpenFilterSplitterCodes(input: {
  protocols: readonly number[]
  accessPointCodes: readonly string[]
  ticketSplitterCodes: readonly string[]
}): Promise<string[]> {
  const params = new URLSearchParams()
  const protocols = [...new Set(input.protocols.filter((p) => p > 0))]
  const apCodes = [
    ...new Set(
      input.accessPointCodes.map((code) => String(code ?? '').trim()).filter(Boolean),
    ),
  ]
  const ticketSplitterCodes = [
    ...new Set(
      input.ticketSplitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean),
    ),
  ]

  if (protocols.length > 0) params.set('protocols', protocols.join(','))
  if (apCodes.length > 0) params.set('apCodes', apCodes.join(','))
  if (ticketSplitterCodes.length > 0) {
    params.set('ticketSplitterCodes', ticketSplitterCodes.join(','))
  }

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/open-filter-splitter-codes?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error(
      `Erro ao resolver splitters para filtro de massiva aberta: ${response.status}`,
    )
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error(
      'Formato de resposta inesperado ao resolver splitters para filtro de massiva aberta.',
    )
  }

  return parsed.data
    .map((item: unknown) => String(item ?? '').trim())
    .filter((item: string) => item !== '')
}
