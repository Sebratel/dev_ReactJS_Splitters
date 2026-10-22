import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type GmudMassivaLink = { massivaProtocol: number; createdAt: string | null }

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message = (result && typeof result.message === 'string' && result.message) || fallback
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return result.data as T
}

export async function fetchGmudLinks(gmudProtocol: number): Promise<GmudMassivaLink[]> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/${gmudProtocol}/links`)
  const data = await parse<{ links: GmudMassivaLink[] }>(response, 'Falha ao carregar os vínculos.')
  return data.links
}

/** Vincula uma massiva existente a uma GMUD. */
export async function linkMassivaToGmud(gmudProtocol: number, massivaProtocol: number): Promise<void> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gmudProtocol, massivaProtocol }),
  })
  await parse(response, 'Falha ao vincular a massiva.')
}

export type GmudBulkLinkResult = {
  linked: number[]
  failed: { massivaProtocol: number; message: string }[]
}

/**
 * Vincula várias massivas de uma vez (seleção múltipla). Envia em sequência para não
 * concorrer no MySQL e devolve o que vinculou e o que falhou, sem abortar no primeiro erro.
 */
export async function linkMassivasToGmud(
  gmudProtocol: number,
  massivaProtocols: number[],
): Promise<GmudBulkLinkResult> {
  const result: GmudBulkLinkResult = { linked: [], failed: [] }
  for (const massivaProtocol of massivaProtocols) {
    try {
      await linkMassivaToGmud(gmudProtocol, massivaProtocol)
      result.linked.push(massivaProtocol)
    } catch (error) {
      result.failed.push({
        massivaProtocol,
        message: error instanceof Error ? error.message : 'Falha ao vincular a massiva.',
      })
    }
  }
  return result
}

export async function unlinkMassivaFromGmud(gmudProtocol: number, massivaProtocol: number): Promise<void> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/link`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gmudProtocol, massivaProtocol }),
  })
  await parse(response, 'Falha ao desvincular a massiva.')
}
