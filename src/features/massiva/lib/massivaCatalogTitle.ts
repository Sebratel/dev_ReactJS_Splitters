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

/**
 * Monitoração Elleven: título preenchido e diferente dos dois registos NexaView.
 * Título vazio não entra aqui (segue fluxo padrão no painel).
 */
export function isMassivaMonitoringOutOfCatalogTitle(title: string): boolean {
  if (!title.trim()) return false
  return !isExpectedMassivaCatalogTitle(title)
}

/** Fluxo padrão no painel (catálogo NexaView + BFF sem título). */
export function isMassivaStandardFlowCatalogTitle(title: string): boolean {
  return !isMassivaMonitoringOutOfCatalogTitle(title)
}

/** Precisa alerta visual / monitorização: fora dos dois registos esperados. */
export function isMassivaCatalogOutOfBand(title: string): boolean {
  return isMassivaMonitoringOutOfCatalogTitle(title)
}
