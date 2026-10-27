import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type TeamApprover = {
  id: number
  userEmail: string
  userDisplayName: string | null
}

/** Mapa de pessoas avisadas por areaId (ID da área em gmud_config_lists). */
export type TeamApproversMap = Record<number, TeamApprover[]>

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

export async function fetchTeamApprovers(): Promise<TeamApproversMap> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/team-approvers`)
  return parse<TeamApproversMap>(response, 'Falha ao carregar aprovadores.')
}

export async function addTeamApprover(
  areaId: number,
  userEmail: string,
  userDisplayName: string | null,
): Promise<TeamApprover & { areaId: number }> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/team-approvers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areaId, userEmail, userDisplayName }),
  })
  return parse<TeamApprover & { areaId: number }>(response, 'Falha ao adicionar aprovador.')
}

export async function removeTeamApprover(id: number): Promise<void> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/team-approvers/${id}`,
    { method: 'DELETE' },
  )
  await parse<{ id: number }>(response, 'Falha ao remover aprovador.')
}
