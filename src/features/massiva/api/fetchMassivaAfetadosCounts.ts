import type { MassivaAfetadoProtocolEnrichment } from '@/features/massiva/lib/mergeMassivaTicketsAfetados'
import { parseMassivaAfetadoProtocolEnrichment } from '@/features/massiva/lib/parseMassivaAfetadoProtocolResponse'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'

function massivaAfetadosBasePath(): string {
  const p = env.massivaAfetadosPath.trim().replace(/\/$/, '')
  if (p === '') return ''
  return p.startsWith('/') ? p : `/${p}`
}

/** Path do GET `…/afetados/protocol/{protocol}` (base = `VITE_MASSIVA_AFETADOS_PATH`). */
export function massivaAfetadosProtocolRequestPath(protocol: number): string {
  const base = massivaAfetadosBasePath()
  if (base === '' || !Number.isFinite(protocol) || protocol <= 0) return ''
  return `${base}/protocol/${Math.trunc(protocol)}`
}

export type { MassivaAfetadoProtocolEnrichment }

/**
 * Resposta do GET de afetados por protocolo (total e ETR, que muitas vezes só vêm neste call).
 */
export async function fetchMassivaAfetadoEnrichmentForProtocol(
  protocol: number,
): Promise<MassivaAfetadoProtocolEnrichment> {
  const path = massivaAfetadosProtocolRequestPath(protocol)
  if (path === '') {
    return { count: null, estimateTimeOfRestoration: null }
  }
  const data: unknown = await bffClient.request({ path, method: 'GET' })
  const e = parseMassivaAfetadoProtocolEnrichment(data)
  if (import.meta.env.DEV && e.count === null && e.estimateTimeOfRestoration === null) {
    console.warn(
      `[Massiva] GET ${path}: não extraí contagem nem ETR. Estrutura da resposta:`,
      data,
    )
  }
  return e
}

export async function fetchMassivaAfetadoCountForProtocol(
  protocol: number,
): Promise<number | null> {
  return (await fetchMassivaAfetadoEnrichmentForProtocol(protocol)).count
}

/**
 * Para cada protocolo distinto, GET `{VITE_MASSIVA_AFETADOS_PATH}/protocol/{id}`.
 * Falhas por protocolo são ignoradas (mantém o total da listagem para esse item).
 */
export async function fetchMassivaAfetadosCountsByProtocols(
  protocols: number[],
): Promise<Map<number, MassivaAfetadoProtocolEnrichment>> {
  if (env.massivaAfetadosPath.trim() === '') return new Map()

  const unique = [...new Set(protocols.filter((p) => Number.isFinite(p) && p > 0).map(Math.trunc))]
  if (unique.length === 0) return new Map()

  const entries = await Promise.all(
    unique.map(async (protocol) => {
      try {
        const e = await fetchMassivaAfetadoEnrichmentForProtocol(protocol)
        if (e.count === null && e.estimateTimeOfRestoration === null) {
          return null
        }
        if (e.count !== null && e.count < 0) return null
        return [protocol, e] as const
      } catch (err) {
        console.warn(`[Massiva] GET afetados/protocol/${protocol} falhou`, err)
        return null
      }
    }),
  )

  const map = new Map<number, MassivaAfetadoProtocolEnrichment>()
  for (const e of entries) {
    if (e !== null) map.set(e[0], e[1])
  }
  return map
}
