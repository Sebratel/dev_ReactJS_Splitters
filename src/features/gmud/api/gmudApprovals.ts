import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { GmudRecursoPapel } from '@/features/gmud/model/gmudForm'

/** GMUD pendente de aprovação — escopo completo (do nosso banco) para o Comitê avaliar. */
export type GmudPendingItem = {
  voalleProtocol: number | null
  assignmentId: number | null
  tipo: string | null
  assunto: string | null
  titulo: string | null
  descricao: string | null
  popSite: string | null
  solicitanteNome: string | null
  solicitanteEmail: string | null
  areaSolicitante: string | null
  riscoNaoImplementacao: string | null
  ambienteAfetado: string[] | null
  comunicaCliente: string | null
  impactoParada: string | null
  planoExecucao: string | null
  riscoExecucao: string | null
  recursosAdministrativos: Record<string, GmudRecursoPapel> | null
  planoRollback: string | null
  dataInicio: string | null
  horaInicio: string | null
  dataFim: string | null
  horaFim: string | null
  listaClientesCor: string | null
  statusComite: string | null
  statusExec: string | null
  dataCab: string | null
  rnc: string | null
  ellevenEncerradoEm: string | null
  ellevenEncerradoStatus: string | null
  createdByEmail: string | null
  createdAt: string | null
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

export async function fetchPendingGmuds(): Promise<GmudPendingItem[]> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/pending`)
  const data = await parse<{ items: GmudPendingItem[]; total: number }>(response, 'Falha ao carregar as GMUDs pendentes.')
  return data.items
}

export async function fetchPendingGmudCount(): Promise<number> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/pending-count`)
  const data = await parse<{ count: number }>(response, 'Falha ao contar GMUDs pendentes.')
  return data.count
}
