import { env, isLocalDevHostname } from '@/shared/config/env'

/**
 * GeoGrid exige base + `api-key`; sem isso o hook não dispara fetch (estado `not-configured`).
 */
export function isGeogridConfigured(): boolean {
  if (isLocalDevHostname() && env.localBffUrl.trim().length > 0) {
    return true
  }

  return (
    env.geogridBaseUrl.trim().length > 0 && env.geogridApiKey.trim().length > 0
  )
}
