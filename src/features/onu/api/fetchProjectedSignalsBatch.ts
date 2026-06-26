import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  normalizeClientName,
  type ProjectedSignal,
} from '@/features/onu/model/projectedSignal'
import { toNum, toText, atToProjected, type GeogridAtendimento, type GeogridRegistro } from './geogridUtils'

/**
 * Sinal projetado em lote para a lista de clientes, casado por nome normalizado.
 *
 * Conservador contra ambiguidade: se um nome tiver mais de um valor de
 * `potenciaFinal` distinto (homônimos / múltiplos enlaces), ele é OMITIDO do
 * mapa — o card cai na heurística da Fase 1 em vez de exibir um alerta
 * possivelmente errado. O comparativo definitivo fica no detalhe do cliente.
 */
export async function fetchProjectedSignalsBatch(
  names: readonly string[],
): Promise<Map<string, ProjectedSignal>> {
  const result = new Map<string, ProjectedSignal>()

  // Nomes com vírgula quebrariam o split do proxy (nomes=a,b,c) — descarta.
  const clean = Array.from(
    new Set(
      names
        .map((n) => String(n ?? '').trim())
        .filter((n) => n.length > 0 && !n.includes(',')),
    ),
  )
  if (clean.length === 0) return result

  const params = new URLSearchParams({
    nomes: clean.join(','),
    pagina: '1',
    // Generoso: um nome pode retornar vários registros (atendimentos).
    registrosPorPagina: String(Math.min(2000, Math.max(200, clean.length * 30))),
  })
  const url = `${env.localBffUrl}/api/geogrid/clientesAtendimentos?${params.toString()}`
  const response = await fetchWithSessionAuth(url)

  if (response.status === 502 || response.status === 404) return result
  if (!response.ok) {
    throw new Error(`Erro ao consultar sinais projetados (GeoGrid): ${response.status}`)
  }

  const body = await response.json()
  const registros: GeogridRegistro[] = Array.isArray(body?.registros) ? body.registros : []

  // Agrupa atendimentos com potência válida por nome normalizado.
  const validByName = new Map<string, ProjectedSignal[]>()
  for (const reg of registros) {
    const nome = toText(reg.nome)
    if (!nome) continue
    const key = normalizeClientName(nome)
    const ats = Array.isArray(reg.atendimentos) ? reg.atendimentos : []
    for (const at of ats) {
      if (toNum(at?.potencia?.potenciaFinal) === null) continue
      const arr = validByName.get(key) ?? []
      arr.push(atToProjected(nome, at as GeogridAtendimento))
      validByName.set(key, arr)
    }
  }

  for (const [key, projections] of validByName) {
    const distinct = new Set(projections.map((p) => p.projectedRxPower))
    // Só usa quando o projetado é inequívoco para aquele nome.
    if (distinct.size === 1) result.set(key, projections[0])
  }

  return result
}
