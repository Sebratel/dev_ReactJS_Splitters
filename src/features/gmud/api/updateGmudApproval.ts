import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type GmudStatusComite = 'pendente' | 'aprovada' | 'negada'
export type GmudStatusExec = 'pendente' | 'em_execucao' | 'concluida'

export type GmudApprovalInput = {
  voalleProtocol: number
  statusComite?: GmudStatusComite
  statusExec?: GmudStatusExec
  dataCab?: string
  rnc?: string
}

/** Registra a decisão do Comitê + status de execução (só no nosso banco). Exige canApproveGmud. */
export async function updateGmudApproval(input: GmudApprovalInput): Promise<void> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message =
      (result && typeof result.message === 'string' && result.message) ||
      'Falha ao registrar a aprovação.'
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
}

export const GMUD_STATUS_COMITE_LABEL: Record<GmudStatusComite, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  negada: 'Negada',
}

export const GMUD_STATUS_EXEC_LABEL: Record<GmudStatusExec, string> = {
  pendente: 'Pendente',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
}
