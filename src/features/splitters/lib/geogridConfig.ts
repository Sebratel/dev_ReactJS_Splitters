import { env, isLocalDevHostname } from '@/shared/config/env'

/**
 * GeoGrid é sempre consultado via BFF (`/api/geogrid`), que injeta a `api-key` no
 * backend. O front só usa `VITE_GEOGRID_BASE_URL` como sinal de "habilitado" (não é
 * segredo); sem ele, o hook não dispara (estado `not-configured`).
 */
export function isGeogridConfigured(): boolean {
  if (isLocalDevHostname() && env.localBffUrl.trim().length > 0) {
    return true
  }

  return env.geogridBaseUrl.trim().length > 0
}
