import { env } from '@/shared/config/env'
import { bffClient } from '@/shared/api/bffClient'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { mapConnectionRowsToSplitterBundle } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Mesmo limite do BFF e do splitters-service (`RotaPorPppoeService.MAX_PPPOES`). */
export const AUTO_ISP_ROUTE_LOOKUP_MAX_USERNAMES = 500

/** Rota do splitters-service, atrás do gateway (`POST`, corpo `{ pppoes }`). */
export const ROTAS_POR_PPPOE_PATH = '/api/v1/splitters/rotas-por-pppoe' as const

/** Resposta do splitters-service (`RotaPorPppoeDTO`). Só topologia — sem dados pessoais. */
type RotaPorPppoeDto = {
  pppoe?: string | null
  authenticationId?: number | null
  splitterCode?: string | null
  splitterTitle?: string | null
  splitterPort?: number | null
  primaryPort?: number | null
  slot?: number | null
  portaExtraida?: number | null
  accessPointCode?: string | null
  accessPointTitle?: string | null
  concentratorCode?: string | null
  concentratorTitle?: string | null
}

/**
 * Converte o DTO do splitters-service para a forma de linha de conexões que o mapper do frontend
 * já entende (`mapConnectionRowsToSplitterBundle`) — assim a derivação de slot/PON é a mesma de
 * sempre, qualquer que seja a origem dos dados.
 */
export function rotaDtoToConnectionRow(dto: RotaPorPppoeDto): Record<string, unknown> {
  return {
    'ID CONEXAO[CLIENTE]': dto.authenticationId,
    'USUÁRIO[CLIENTE]': dto.pppoe,
    'SPLT.SECUNDARIO': dto.splitterTitle,
    'CÓDIGO[SPLT.SECUNDARIO]': dto.splitterCode,
    'PORTA SPLITTER[SPLT.SECUNDARIO]': dto.splitterPort,
    'SLOT[SPLT.SECUNDARIO]': dto.slot,
    'PORTA EXTRAÍDA[SPLT.SECUNDARIO]': dto.portaExtraida,
    'PORTA[SPLT.PRIMARIO]': dto.primaryPort,
    'PONTO DE ACESSO CODE': dto.accessPointCode,
    'PONTO DE ACESSO': dto.accessPointTitle,
    CONCENTRADOR: dto.concentratorTitle,
  }
}

async function fetchFromGateway(pppoeUsernames: string[]): Promise<SplitterCliente[]> {
  const data: unknown = await bffClient.request({
    path: ROTAS_POR_PPPOE_PATH,
    method: 'POST',
    body: { pppoes: pppoeUsernames },
  })
  if (!Array.isArray(data)) {
    throw new Error('Resposta inesperada do gateway (rotas por PPPoE não é uma lista).')
  }
  return mapConnectionRowsToSplitterBundle(
    (data as RotaPorPppoeDto[]).map(rotaDtoToConnectionRow),
  ).clientes
}

async function fetchFromLocalBff(pppoeUsernames: string[]): Promise<SplitterCliente[]> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/connections/lookup-by-pppoe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pppoeUsernames }),
    },
  )
  if (!response.ok) {
    throw new Error(`Erro ao consultar rotas por PPPoE no BFF Local: ${response.status}`)
  }

  const result = (await response.json()) as { success?: boolean; data?: unknown }
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF Local (rotas por PPPoE).')
  }

  return mapConnectionRowsToSplitterBundle(result.data as Record<string, unknown>[]).clientes
}

/**
 * Resolve a rota (AP/slot/porta/splitter) só dos PPPoE informados — os dos eventos em tela.
 * Substitui o download da base inteira (`GET /api/massiva/connections` sem filtro).
 *
 * Com `VITE_AUTOISP_ROUTE_LOOKUP_VIA_GATEWAY=true` a consulta vai ao splitters-service pelo
 * gateway; se o gateway não tiver a rota (404), estiver fora ou falhar, cai no BFF local — o
 * painel não pode ficar sem correlação por causa de um deploy parcial.
 */
export async function fetchAutoIspRoutesByPppoe(
  pppoeUsernames: string[],
): Promise<SplitterCliente[]> {
  if (pppoeUsernames.length === 0) return []

  if (env.autoIspRouteLookupViaGateway) {
    try {
      return await fetchFromGateway(pppoeUsernames)
    } catch (error) {
      console.warn('AutoISP: rotas por PPPoE via gateway falharam; usando o BFF local.', error)
    }
  }
  return fetchFromLocalBff(pppoeUsernames)
}
