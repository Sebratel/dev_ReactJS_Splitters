import { normalizeStreetForRelief } from '@/features/splitters/lib/splitterStreetRelief'

export type StreetAggInput = {
  street: string | null | undefined
  currentUsagePercent: number
}

export type AggregatedStreetRow = {
  /** Chave normalizada (mesma regra do mapa / alívio por rua). */
  streetKey: string
  /** Rótulo exibido — variante mais frequente no cadastro. */
  nome: string
  splitters: number
  criticalSplitters: number
}

function pickStreetDisplayLabel(displayCounts: ReadonlyMap<string, number>): string {
  let bestLabel = ''
  let bestCount = -1
  for (const [label, count] of displayCounts) {
    if (
      count > bestCount ||
      (count === bestCount && label.length > bestLabel.length)
    ) {
      bestLabel = label
      bestCount = count
    }
  }
  return bestLabel
}

/**
 * Agrupa ruas pela mesma normalização do mapa operacional (`normalizeStreetForRelief`).
 * Fonte: texto de cadastro/caixa (`RUA[SPLT.SECUNDARIO]`); sem reverse geocode.
 */
export function buildTopStreetsByNormalizedStreet(
  rows: readonly StreetAggInput[],
  limit = 6,
): AggregatedStreetRow[] {
  const streets = new Map<
    string,
    { displayCounts: Map<string, number>; splitters: number; criticalSplitters: number }
  >()

  for (const row of rows) {
    const raw = row.street?.trim() ?? ''
    if (raw === '') continue

    const streetKey = normalizeStreetForRelief(raw)
    if (streetKey === null) continue

    const bucket = streets.get(streetKey) ?? {
      displayCounts: new Map<string, number>(),
      splitters: 0,
      criticalSplitters: 0,
    }
    bucket.splitters += 1
    bucket.displayCounts.set(raw, (bucket.displayCounts.get(raw) ?? 0) + 1)
    if (row.currentUsagePercent >= 95) bucket.criticalSplitters += 1
    streets.set(streetKey, bucket)
  }

  return [...streets.entries()]
    .map(([streetKey, bucket]) => ({
      streetKey,
      nome: pickStreetDisplayLabel(bucket.displayCounts),
      splitters: bucket.splitters,
      criticalSplitters: bucket.criticalSplitters,
    }))
    .sort(
      (a, b) =>
        b.criticalSplitters - a.criticalSplitters || b.splitters - a.splitters,
    )
    .slice(0, limit)
}
