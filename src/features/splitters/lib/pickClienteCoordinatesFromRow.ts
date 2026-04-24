/**
 * Colunas opcionais na consulta SQL do BFF local — inclua no SELECT com um desses aliases.
 * Ex.: `auth_contract.lat AS "LATITUDE_CLIENTE", auth_contract.lng AS "LONGITUDE_CLIENTE"`
 */
export const CLIENT_LATITUDE_ROW_KEYS = [
  'LATITUDE_CLIENTE',
  'LATITUDE[CLIENTE]',
  'LATITUDE CLIENTE',
  'LAT_CLIENTE',
  'latitude_cliente',
  'latitude',
  'LATITUDE',
  'lat',
] as const

export const CLIENT_LONGITUDE_ROW_KEYS = [
  'LONGITUDE_CLIENTE',
  'LONGITUDE[CLIENTE]',
  'LONGITUDE CLIENTE',
  'LNG_CLIENTE',
  'longitude_cliente',
  'longitude',
  'LONGITUDE',
  'lng',
  'LON',
] as const

export function pickOptionalCoordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const s = String(value).replace(',', '.').trim()
  if (s === '') return null
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export function pickCoordinateFromRow(
  row: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue
    const v = pickOptionalCoordinate(row[key])
    if (v !== null) return v
  }
  return null
}
