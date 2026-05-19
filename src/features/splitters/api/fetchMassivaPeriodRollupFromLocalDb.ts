import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type IntelligenceMassivaPeriodRollup = {
  distinctMassivaCount: number
  affectedClientsDistinctSum: number
  openMassivasCount: number
  closedMassivasCount: number
}

/** `all_linked`: agrega no servidor sem lista de códigos (evita POST >100kb no painel da rede). */
export type MassivaPeriodRollupScope = 'by_codes' | 'all_linked'

export type FetchMassivaPeriodRollupOptions = {
  scope?: MassivaPeriodRollupScope
}

const EMPTY: IntelligenceMassivaPeriodRollup = {
  distinctMassivaCount: 0,
  affectedClientsDistinctSum: 0,
  openMassivasCount: 0,
  closedMassivasCount: 0,
}

function parseRollupResponse(parsed: unknown): IntelligenceMassivaPeriodRollup {
  const root = parsed as { success?: boolean; data?: Record<string, unknown> } | null
  const data = root?.data
  if (!root?.success || typeof data !== 'object' || data === null) {
    throw new Error('Formato de resposta inesperado no agregado de massivas do período.')
  }

  return {
    distinctMassivaCount: Math.round(Number(data.distinctMassivaCount ?? 0)),
    affectedClientsDistinctSum: Math.round(Number(data.affectedClientsDistinctSum ?? 0)),
    openMassivasCount: Math.round(Number(data.openMassivasCount ?? 0)),
    closedMassivasCount: Math.round(Number(data.closedMassivasCount ?? 0)),
  }
}

/** Agrega massivas distintas no período (afetados contados uma vez por ocorrência), para não repetir por splitter. */
export async function fetchMassivaPeriodRollupFromLocalDb(
  splitterCodes: readonly string[],
  openedRange?: { start: Date; end: Date },
  options?: FetchMassivaPeriodRollupOptions,
): Promise<IntelligenceMassivaPeriodRollup> {
  const scope = options?.scope ?? 'by_codes'
  const body: Record<string, unknown> = { scope }

  if (scope === 'by_codes') {
    const clean = [
      ...new Set(splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean)),
    ]
    if (clean.length === 0) return { ...EMPTY }
    body.splitterCodes = clean
  }

  if (openedRange) {
    body.openedAtFrom = openedRange.start.toISOString()
    body.openedAtTo = openedRange.end.toISOString()
  }

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/period-rollup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) {
    throw new Error(`Erro ao agregar massivas do período no BFF: ${response.status}`)
  }

  const parsed = await response.json()
  return parseRollupResponse(parsed)
}
