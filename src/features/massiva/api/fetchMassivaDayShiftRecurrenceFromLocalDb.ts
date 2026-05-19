import {
  mergeMassivaDayShiftRecurrenceCounts,
  type MassivaDayShiftRecurrenceCell,
} from '@/features/intelligence/lib/massivaDayShiftRecurrence'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export async function fetchMassivaDayShiftRecurrenceFromLocalDb(
  openedRange?: { start: Date; end: Date },
): Promise<MassivaDayShiftRecurrenceCell[]> {
  const body: Record<string, unknown> = {}
  if (openedRange) {
    body.openedAtFrom = openedRange.start.toISOString()
    body.openedAtTo = openedRange.end.toISOString()
  }

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/day-shift-recurrence`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) {
    throw new Error(`Erro ao agregar recorrência dia×turno no BFF: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado na recorrência dia×turno.')
  }

  const rows = parsed.data as Array<{ weekday?: unknown; shift?: unknown; count?: unknown }>
  return mergeMassivaDayShiftRecurrenceCounts(
    rows.map((row) => ({
      weekday: String(row.weekday ?? ''),
      shift: String(row.shift ?? ''),
      count: Number(row.count ?? 0),
    })),
  )
}
