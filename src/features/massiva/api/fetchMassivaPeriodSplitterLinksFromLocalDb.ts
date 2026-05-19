import type { MassivaPeriodSplitterLink } from '@/features/massiva/lib/lifecycleMassivaBuckets'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export async function fetchMassivaPeriodSplitterLinksFromLocalDb(
  openedRange?: { start: Date; end: Date },
): Promise<MassivaPeriodSplitterLink[]> {
  const body: Record<string, unknown> = {}
  if (openedRange) {
    body.openedAtFrom = openedRange.start.toISOString()
    body.openedAtTo = openedRange.end.toISOString()
  }

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/period-links`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) {
    throw new Error(`Erro ao listar vínculos de massivas do período no BFF: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado nos vínculos de massivas do período.')
  }

  const rows = parsed.data as Array<{ massivaHistoryId?: unknown; splitterCodes?: unknown }>
  const out: MassivaPeriodSplitterLink[] = []

  for (const row of rows) {
    const massivaHistoryId = Number(row.massivaHistoryId)
    if (!Number.isFinite(massivaHistoryId) || massivaHistoryId <= 0) continue
    const splitterCodes = Array.isArray(row.splitterCodes)
      ? row.splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean)
      : []
    out.push({ massivaHistoryId, splitterCodes })
  }

  return out
}
