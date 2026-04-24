import { getOidcAccessToken } from '@/app/auth/oidcAccessToken'
import { useSessionStore } from '@/features/session/store/sessionStore'

function readSessionToken(): string | null {
  const oidc = getOidcAccessToken()
  if (typeof oidc === 'string' && oidc.trim() !== '') return oidc

  const fallback = useSessionStore.getState().sessionToken
  if (typeof fallback === 'string' && fallback.trim() !== '') return fallback

  return null
}

/**
 * Wrapper de fetch para endpoints que exigem Bearer no browser.
 * Mantem compatibilidade com chamadas existentes e injeta Authorization quando houver token.
 */
export async function fetchWithSessionAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const token = readSessionToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(input, { ...init, headers })
}

