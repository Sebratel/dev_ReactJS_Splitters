import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type GmudConfigItem = { id: number; label: string }
export type GmudConfigLists = {
  areas: GmudConfigItem[]
  equipes: GmudConfigItem[]
  processos: GmudConfigItem[]
  sistemas_internos: GmudConfigItem[]
  sistemas_externos: GmudConfigItem[]
  [key: string]: GmudConfigItem[]
}

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

export async function fetchGmudConfigLists(): Promise<GmudConfigLists> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/config-lists`)
  return parse<GmudConfigLists>(response, 'Falha ao carregar listas de configuração.')
}

export async function addGmudConfigItem(
  listKey: string,
  label: string,
): Promise<GmudConfigItem> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/config-lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listKey, label }),
  })
  return parse<GmudConfigItem>(response, 'Falha ao adicionar item.')
}

export async function removeGmudConfigItem(id: number): Promise<void> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/config-lists/${id}`,
    { method: 'DELETE' },
  )
  await parse<{ id: number }>(response, 'Falha ao remover item.')
}
