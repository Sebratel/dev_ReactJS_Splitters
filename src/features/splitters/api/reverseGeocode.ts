import { env } from '@/shared/config/env'
import {
  isGeocodedAddressEmpty,
  parseGeocodedAddressFromReverseJson,
  type GeocodedAddress,
} from '@/features/splitters/model/geocodedAddress'
import {
  loadCachedGeocodedAddress,
  saveCachedGeocodedAddress,
} from '@/features/splitters/lib/splitterAddressCache'

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'
const FETCH_TIMEOUT_MS = 8000

function buildReverseUrl(lat: number, lng: number): string {
  const custom = env.reverseGeocodeEndpoint.trim()
  if (custom.length > 0) {
    const u = new URL(custom)
    u.searchParams.set('lat', String(lat))
    u.searchParams.set('lng', String(lng))
    u.searchParams.set('lon', String(lng))
    return u.toString()
  }
  const u = new URL(NOMINATIM_REVERSE)
  u.searchParams.set('format', 'json')
  u.searchParams.set('lat', String(lat))
  u.searchParams.set('lon', String(lng))
  u.searchParams.set('addressdetails', '1')
  return u.toString()
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController()
  const id = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error(`Geocoding falhou (HTTP ${response.status})`)
    }
    return await response.json()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Geocoding: tempo limite excedido')
    }
    if (e instanceof TypeError) {
      throw new Error('Geocoding: falha de rede ou CORS')
    }
    throw e
  } finally {
    window.clearTimeout(id)
  }
}

/**
 * Resolve endereço por lat/lng com cache por `splitterCode` (comportamento do `GeocodingService` Flutter).
 * Usa `VITE_REVERSE_GEOCODE_ENDPOINT` quando definido (evita CORS direto ao Nominatim no browser).
 */
export async function resolveGeocodedAddressForSplitter(input: {
  splitterCode: string
  lat: number
  lng: number
}): Promise<GeocodedAddress | null> {
  const { splitterCode, lat, lng } = input

  const cached = loadCachedGeocodedAddress(splitterCode)
  if (cached !== null && !isGeocodedAddressEmpty(cached)) {
    return cached
  }

  const url = buildReverseUrl(lat, lng)
  const json = await fetchJsonWithTimeout(url)
  const parsed = parseGeocodedAddressFromReverseJson(json)

  if (parsed === null || isGeocodedAddressEmpty(parsed)) {
    return null
  }

  saveCachedGeocodedAddress(splitterCode, parsed)
  return parsed
}
