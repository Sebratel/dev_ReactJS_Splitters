/**
 * Paridade com `SplitterModel` — coordenadas como texto, inclusive com vírgula decimal.
 */

function parseCoordinate(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  if (normalized === '') return null
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

export function parseSplitterLatLng(
  latitude: string,
  longitude: string,
): { lat: number; lng: number } | null {
  const lat = parseCoordinate(latitude)
  const lng = parseCoordinate(longitude)
  if (lat === null || lng === null) return null
  return { lat, lng }
}
