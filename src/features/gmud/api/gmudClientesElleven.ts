import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { GmudClienteSemSplitterTipo } from '@/features/gmud/model/gmudClientesSemSplitter'

/** Cliente corporativo encontrado no Elleven (só o necessário para escolher e identificar). */
export type GmudClienteElleven = {
  contractId: number
  nome: string
  pppoe: string
  pontoAcesso: string
  produtos: string[]
  /** Já está numa porta de splitter: entra pela abrangência quando a rota o alcança. */
  emSplitter: boolean
  tipoSugerido: GmudClienteSemSplitterTipo
}

/** Busca clientes corporativos do Elleven por nome, contrato ou usuário (mínimo 3 letras; número = contrato). */
export async function searchGmudClientesElleven(q: string): Promise<GmudClienteElleven[]> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/clientes-elleven?q=${encodeURIComponent(q.trim())}`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error((result && typeof result.message === 'string' && result.message) || 'Falha ao buscar clientes no Elleven.')
  }
  return result.data as GmudClienteElleven[]
}
