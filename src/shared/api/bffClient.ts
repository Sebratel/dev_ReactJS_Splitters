import { createBffClient } from '@/shared/api/httpClient'

/**
 * Cliente HTTP do BFF (api-gateway-bff).
 * Ex.: `bffClient.request({ path: '/api/v1/foo', method: 'POST', body: { a: 1 } })`
 * Testes podem mockar `fetch` ou injetar um client alternativo quando necessário.
 */
export const bffClient = createBffClient()
