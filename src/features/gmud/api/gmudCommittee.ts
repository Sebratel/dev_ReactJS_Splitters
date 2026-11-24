import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

/** Situação do Comitê da GMUD para quem está logado. */
export type GmudCommitteeInfo = {
  /** Id do item fixo "Comitê" (usado para gerir os membros em Configurações). */
  itemId: number | null
  /** Quantos membros o Comitê tem. 0 = ninguém consegue decidir. */
  membersCount: number
  /** O usuário atual é membro do Comitê (pode aprovar/negar). */
  isMember: boolean
}

export async function fetchGmudCommittee(): Promise<GmudCommitteeInfo> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/committee`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message =
      (result && typeof result.message === 'string' && result.message) || 'Falha ao carregar o Comitê.'
    throw new Error(message)
  }
  return result.data as GmudCommitteeInfo
}
