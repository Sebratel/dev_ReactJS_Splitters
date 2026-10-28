import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { mapConnectionRowsToSplitterBundle } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Mesmo limite do server (`ROTA_POR_PPPOE_MAX` em `server/lib/rotaPorPppoe.js`). */
export const AUTO_ISP_ROUTE_LOOKUP_MAX_USERNAMES = 500

/** Linha devolvida por `POST /api/splitters/rotas-por-pppoe`. Só topologia — sem dados pessoais. */
type RotaPorPppoeRow = {
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
 * Converte a linha do server para a forma de linha de conexões que o mapper do frontend já
 * entende (`mapConnectionRowsToSplitterBundle`) — a derivação de slot/PON continua a de sempre.
 */
export function rotaRowToConnectionRow(row: RotaPorPppoeRow): Record<string, unknown> {
  return {
    'ID CONEXAO[CLIENTE]': row.authenticationId,
    'USUÁRIO[CLIENTE]': row.pppoe,
    'SPLT.SECUNDARIO': row.splitterTitle,
    'CÓDIGO[SPLT.SECUNDARIO]': row.splitterCode,
    'PORTA SPLITTER[SPLT.SECUNDARIO]': row.splitterPort,
    'SLOT[SPLT.SECUNDARIO]': row.slot,
    'PORTA EXTRAÍDA[SPLT.SECUNDARIO]': row.portaExtraida,
    'PORTA[SPLT.PRIMARIO]': row.primaryPort,
    'PONTO DE ACESSO CODE': row.accessPointCode,
    'PONTO DE ACESSO': row.accessPointTitle,
    CONCENTRADOR: row.concentratorTitle,
  }
}

/**
 * Resolve a rota (AP/slot/porta/splitter) só dos PPPoE informados — os dos eventos em tela.
 * Substitui o download da base inteira (`GET /api/massiva/connections` sem filtro).
 */
export async function fetchAutoIspRoutesByPppoe(
  pppoeUsernames: string[],
): Promise<SplitterCliente[]> {
  if (pppoeUsernames.length === 0) return []

  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/splitters/rotas-por-pppoe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pppoes: pppoeUsernames }),
  })
  if (!response.ok) {
    throw new Error(`Erro ao consultar rotas por PPPoE no BFF Local: ${response.status}`)
  }

  const result = (await response.json()) as { success?: boolean; data?: unknown }
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('Formato de resposta inesperado do BFF Local (rotas por PPPoE).')
  }

  return mapConnectionRowsToSplitterBundle(
    (result.data as RotaPorPppoeRow[]).map(rotaRowToConnectionRow),
  ).clientes
}
