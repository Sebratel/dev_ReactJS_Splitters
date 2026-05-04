import { initSessionCrossTabSync, useSessionStore } from '@/features/session/store/sessionStore'
import {
  readHashParam,
  readQueryParam,
  stripHashParams,
  stripQueryParams,
} from '@/features/session/lib/urlParams'
import { readGoogleIdTokenFromCallback } from '@/features/session/lib/googleIdentity'
import {
  getGoogleIdTokenExpiryMs,
  isFirebaseAuthIdTokenJwt,
} from '@/features/session/lib/googleToken'
import { loadPersistedSession, persistSessionToken, clearPersistedSession } from '@/shared/lib/storage'
import { env, isLocalDevHostname, isOidcConfigured } from '@/shared/config/env'

export function bootstrapSession(): void {
  const store = useSessionStore.getState()

  let callbackToken: string | null = null
  let callbackExpiresAt: number | null = null
  try {
    const callback = readGoogleIdTokenFromCallback()
    if (callback?.kind === 'token') {
      callbackToken = callback.token
      callbackExpiresAt = callback.expiresAtMs
    } else if (callback?.kind === 'error') {
      stripHashParams('error', 'error_subtype', 'state', 'authuser', 'prompt')
    }
  } catch {
    callbackToken = null
  }

  const fromUrl =
    callbackToken ??
    readHashParam('id_token') ??
    readQueryParam('token') ??
    readQueryParam('googleIdToken') ??
    null
  const cached = loadPersistedSession()

  if (fromUrl) {
    const expiresAt = callbackExpiresAt ?? getGoogleIdTokenExpiryMs(fromUrl)
    persistSessionToken(fromUrl, expiresAt)
    store.setSessionTokenWithExpiry(fromUrl, expiresAt)
    stripQueryParams('token', 'googleIdToken')
    stripHashParams('id_token', 'state', 'authuser', 'prompt')
  } else if (cached) {
    if (isFirebaseAuthIdTokenJwt(cached.token)) {
      clearPersistedSession()
    } else {
      store.setSessionTokenWithExpiry(
        cached.token,
        typeof cached.expiresAt === 'number'
          ? cached.expiresAt
          : getGoogleIdTokenExpiryMs(cached.token),
      )
    }
  } else if (isLocalDevHostname() && !isOidcConfigured()) {
    const dev = env.devSessionToken.trim()
    if (dev) {
      store.setSessionTokenWithExpiry(dev, getGoogleIdTokenExpiryMs(dev))
    }
  }

  void store.hydrateSession()
  initSessionCrossTabSync()
}
