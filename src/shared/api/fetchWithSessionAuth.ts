import { getOidcAccessToken } from '@/app/auth/oidcAccessToken'
import { useSessionStore } from '@/features/session/store/sessionStore'

function readSessionToken(): string | null {
  const oidc = getOidcAccessToken()
  if (typeof oidc === 'string' && oidc.trim() !== '') return oidc

  const fallback = useSessionStore.getState().sessionToken
  if (typeof fallback === 'string' && fallback.trim() !== '') return fallback

  return null
}

/** Timeout padrão para chamadas ao BFF local (Node/MySQL). */
const LOCAL_BFF_TIMEOUT_MS = 30_000

/**
 * Wrapper de fetch para endpoints que exigem Bearer no browser.
 * Inclui timeout de 30s para evitar hang indefinido quando o BFF local estiver indisponível.
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

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), LOCAL_BFF_TIMEOUT_MS)

  const externalSignal = init?.signal as AbortSignal | undefined
  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    return await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeoutId)
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort)
    }
  }
}

