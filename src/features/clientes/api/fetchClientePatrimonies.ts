import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { ClientePatrimony } from '@/features/clientes/model/clientePatrimony'

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseClientePatrimony(raw: Record<string, unknown>): ClientePatrimony {
  return {
    clientId: toNum(raw.clientId),
    contractId: toNum(raw.contractId),
    contractNumber: toText(raw.contractNumber),
    contractTypeTitle: toText(raw.contractTypeTitle),
    contractStatus: toText(raw.contractStatus),
    patrimonyTitle: toText(raw.patrimonyTitle),
    serialNumber: toText(raw.serialNumber),
    tagNumber: toText(raw.tagNumber),
    mac: toText(raw.mac),
  }
}

/**
 * Patrimônios (equipamentos) do cliente pelo `clientId` (= cliente.clientId).
 * Retorna lista vazia quando não há equipamentos.
 */
export async function fetchClientePatrimonies(
  clientId: number,
  signal?: AbortSignal,
): Promise<ClientePatrimony[]> {
  const url = `${env.localBffUrl}/api/clientes/${encodeURIComponent(String(clientId))}/patrimonios`
  const response = await fetchWithSessionAuth(url, { signal })

  if (response.status === 404) return []
  if (!response.ok) {
    throw new Error(`Erro ao consultar patrimônios do cliente: ${response.status}`)
  }

  const result = await response.json()
  if (!result?.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF (patrimônios).')
  }

  return (result.data as Array<Record<string, unknown>>).map(parseClientePatrimony)
}
