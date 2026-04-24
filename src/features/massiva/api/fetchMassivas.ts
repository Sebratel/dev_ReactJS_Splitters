import { fetchMassivaAfetadosCountsByProtocols } from '@/features/massiva/api/fetchMassivaAfetadosCounts'
import { extractMassivaListRows } from '@/features/massiva/lib/extractMassivaListRows'
import { mergeMassivaTicketsAfetados } from '@/features/massiva/lib/mergeMassivaTicketsAfetados'
import {
  parseMassivaTicketFromApi,
  type MassivaTicket,
} from '@/features/massiva/model/massivaTicket'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'

/**
 * GET listagem de massivas no BFF — paridade `MassivaGatewayService.fetchMassivas`.
 * Quando `VITE_MASSIVA_AFETADOS_PATH` está definido, para cada protocolo faz GET `{path}/protocol/{protocol}` e enriquece `affectedClients` na listagem.
 */
export async function fetchMassivas(): Promise<MassivaTicket[]> {
  const path = env.massivaListPath.trim()
  if (path === '') {
    throw new Error(
      'Listagem de massivas: defina VITE_MASSIVA_LIST_PATH no .env (path no BFF, ex. /api/v1/massivas/list).',
    )
  }

  const data: unknown = await bffClient.request({
    path: path.startsWith('/') ? path : `/${path}`,
    method: 'GET',
  })

  const rows = extractMassivaListRows(data)
  let tickets: MassivaTicket[] = rows.map((row) => parseMassivaTicketFromApi(row))

  if (env.massivaAfetadosPath.trim() === '') {
    return tickets
  }

  try {
    const protocols = tickets.map((t) => t.protocol)
    const byProtocol = await fetchMassivaAfetadosCountsByProtocols(protocols)
    tickets = mergeMassivaTicketsAfetados(tickets, byProtocol)
  } catch (e) {
    console.warn(
      '[Massiva] Enriquecimento por GET afetados/protocol falhou; exibindo totais vindos só da listagem.',
      e,
    )
  }

  return tickets
}
