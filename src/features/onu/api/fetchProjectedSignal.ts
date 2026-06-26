import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  normalizeClientName,
  type ProjectedSignal,
} from '@/features/onu/model/projectedSignal'
import { pickProjected, type GeogridRegistro } from './geogridUtils'

/**
 * Sinal projetado da porta para um cliente, casado por **nome** normalizado.
 *
 * Segurança: `pickProjected` não usa fallback para outros registros — se o
 * nome não casar exatamente, retorna null. Se houver homônimo (mesmo nome com
 * `potenciaFinal` diferente), retorna com `ambiguous: true` para que a UI
 * exiba aviso em vez de disparar um alarme possivelmente falso.
 */
export async function fetchProjectedSignal(
  clientName: string,
): Promise<ProjectedSignal | null> {
  const name = clientName.trim()
  if (!name) return null

  const params = new URLSearchParams({
    nomes: name,
    pagina: '1',
    // Um mesmo nome pode retornar vários registros (homônimos / múltiplos
    // atendimentos, alguns vazios). 100 cobre com folga sem truncar a projeção.
    registrosPorPagina: '100',
  })
  const url = `${env.localBffUrl}/api/geogrid/clientesAtendimentos?${params.toString()}`
  const response = await fetchWithSessionAuth(url)

  if (response.status === 502 || response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Erro ao consultar sinal projetado (GeoGrid): ${response.status}`)
  }

  const body = await response.json()
  const registros: GeogridRegistro[] = Array.isArray(body?.registros) ? body.registros : []
  if (registros.length === 0) return null

  return pickProjected(registros, normalizeClientName(name))
}
