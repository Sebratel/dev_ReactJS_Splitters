/**
 * Cache local por código de splitter — paridade com `AddressCacheService` + Hive no Flutter.
 */

import {
  geocodedAddressFromCacheRecord,
  geocodedAddressToCacheRecord,
  type GeocodedAddress,
} from '@/features/splitters/model/geocodedAddress'
import { isJsonObject } from '@/shared/lib/typeGuards'

const STORAGE_PREFIX = 'nexaview.address.v1:'

function storageKey(splitterCode: string): string {
  return `${STORAGE_PREFIX}${splitterCode}`
}

export function loadCachedGeocodedAddress(
  splitterCode: string,
): GeocodedAddress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(splitterCode))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isJsonObject(parsed)) return null
    return geocodedAddressFromCacheRecord(parsed)
  } catch {
    return null
  }
}

export function saveCachedGeocodedAddress(
  splitterCode: string,
  address: GeocodedAddress,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      storageKey(splitterCode),
      JSON.stringify(geocodedAddressToCacheRecord(address)),
    )
  } catch {
    // quota / private mode — ignora silenciosamente como o Flutter faria com falha Hive
  }
}
