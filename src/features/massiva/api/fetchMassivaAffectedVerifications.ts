import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { env } from '@/shared/config/env'

export type MassivaAffectedVerificationRow = {
  protocol: number | null
  assignmentId: number | null
  accessPointCode: string
  title: string
  checkedAt: Date | null
  total: number
  stillOffline: number
  stillDegraded: number
  verifiedBy: string | null
}

/**
 * Massivas encerradas já verificadas (sob demanda, via "Verificar clientes") que ainda
 * têm clientes sem sinal. Fonte de dados do painel de parede — só lê resultados já
 * persistidos, nunca dispara uma verificação nova por conta própria.
 */
export async function fetchMassivaAffectedVerifications(
  limit = 20,
): Promise<MassivaAffectedVerificationRow[]> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/affected-verifications?limit=${encodeURIComponent(String(limit))}`,
  )
  if (!response.ok) {
    throw new Error(`Erro ao consultar verificações de clientes afetados: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado ao consultar verificações de clientes afetados.')
  }

  return parsed.data.map((row: Record<string, unknown>) => ({
    protocol: row.protocol == null ? null : Number(row.protocol),
    assignmentId: row.assignmentId == null ? null : Number(row.assignmentId),
    accessPointCode: String(row.accessPointCode ?? '').trim(),
    title: String(row.title ?? '').trim(),
    checkedAt: typeof row.checkedAt === 'string' && row.checkedAt !== '' ? new Date(row.checkedAt) : null,
    total: Number(row.total ?? 0),
    stillOffline: Number(row.stillOffline ?? 0),
    stillDegraded: Number(row.stillDegraded ?? 0),
    verifiedBy: row.verifiedBy != null && String(row.verifiedBy).trim() !== ''
      ? String(row.verifiedBy).trim()
      : null,
  }))
}
