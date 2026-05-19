/**
 * Títulos de catálogo considerados fluxo standard na operação.
 * Comparação em texto normalizado (trim, espaços únicos, minúsculas).
 */
export const EXPECTED_MASSIVA_CATALOG_TITLES = [
  'Registro Evento Massivo',
  'Registro Incidente de Rede',
] as const

export function normalizeMassivaCatalogTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

const NORMALIZED_EXPECTED_SET = new Set(
  EXPECTED_MASSIVA_CATALOG_TITLES.map((t) => normalizeMassivaCatalogTitle(t)),
)

/** `true` se o título bate exatamente (após normalizar) com um dos catálogos esperados. */
export function isExpectedMassivaCatalogTitle(title: string): boolean {
  if (!title.trim()) return false
  return NORMALIZED_EXPECTED_SET.has(normalizeMassivaCatalogTitle(title))
}

/** Precisa alerta visual / monitorização: fora dos dois registos esperados. */
export function isMassivaCatalogOutOfBand(title: string): boolean {
  return !isExpectedMassivaCatalogTitle(title)
}
