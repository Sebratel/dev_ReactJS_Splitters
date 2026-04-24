/**
 * Equivalente a `AddressModel` em `lib/models/address_model.dart` (resultado do reverse geocode).
 */

import { isJsonObject } from '@/shared/lib/typeGuards'

export type GeocodedAddress = {
  street: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

function pickOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

/**
 * Extrai o bloco `address` da resposta Nominatim (ou proxy compatível), como no `GeocodingService` Flutter.
 */
export function parseGeocodedAddressFromReverseJson(
  json: unknown,
): GeocodedAddress | null {
  if (!isJsonObject(json)) return null
  const address = json.address
  if (!isJsonObject(address)) return null

  return {
    street: pickOptionalString(address.road ?? address.pedestrian),
    neighborhood: pickOptionalString(
      address.suburb ?? address.neighbourhood,
    ),
    city: pickOptionalString(address.city ?? address.town),
    state: pickOptionalString(address.state),
    postalCode: pickOptionalString(address.postcode),
  }
}

export function isGeocodedAddressEmpty(address: GeocodedAddress): boolean {
  return ![address.street, address.neighborhood, address.city, address.state, address.postalCode].some(
    (v) => v != null && String(v).trim() !== '',
  )
}

export function geocodedAddressToCacheRecord(
  address: GeocodedAddress,
): Record<string, string | null> {
  return {
    street: address.street,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  }
}

export function geocodedAddressFromCacheRecord(
  raw: Record<string, unknown>,
): GeocodedAddress {
  return {
    street: pickOptionalString(raw.street),
    neighborhood: pickOptionalString(raw.neighborhood),
    city: pickOptionalString(raw.city),
    state: pickOptionalString(raw.state),
    postalCode: pickOptionalString(raw.postalCode),
  }
}
