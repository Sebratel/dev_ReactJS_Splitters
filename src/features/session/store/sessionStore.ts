import { create } from 'zustand'
import { fetchHubSessionProfile } from '@/features/session/api/fetchHubSessionProfile'
import {
  decodeGoogleIdToken,
  getGoogleIdTokenExpiryMs,
  isGoogleIdTokenExpired,
} from '@/features/session/lib/googleToken'
import { mapHubPayloadToUser } from '@/features/session/lib/mapHubPayloadToUser'
import type { AuthStatus, SessionUser } from '@/features/session/model/session.types'
import { defaultLocalSessionUser } from '@/features/session/model/session.types'
import {
  SESSION_STORAGE_KEY,
  clearPersistedSession,
  parsePersistedSessionJson,
  persistSessionToken,
  type PersistedSession,
} from '@/shared/lib/storage'
import { isGoogleIdentityConfigured, isLocalDevHostname } from '@/shared/config/env'

/** Em localhost o Hub pode não expor `/api/hub/session`; usa claims do JWT + defaults locais. */
function sessionUserFallbackLocalWithGoogleToken(token: string): SessionUser {
  try {
    const p = decodeGoogleIdToken(token)
    const email = String(p.email ?? '').trim()
    const name = typeof p.name === 'string' ? p.name.trim() : null
    return {
      ...defaultLocalSessionUser,
      // Evita "nome certo + protocolo no usuário errado":
      // força resolução real de personId pelo e-mail no BFF.
      personId: null,
      email: email !== '' ? email : defaultLocalSessionUser.email,
      name: name !== '' ? name : defaultLocalSessionUser.name,
    }
  } catch {
    return defaultLocalSessionUser
  }
}

type SessionState = {
  status: AuthStatus
  sessionToken: string | null
  tokenExpiresAtMs: number | null
  user: SessionUser | null
  setSessionToken: (token: string | null) => void
  setSessionTokenWithExpiry: (token: string | null, tokenExpiresAtMs?: number | null) => void
  setAuthStatus: (status: AuthStatus) => void
  hydrateSession: () => Promise<void>
  setSessionFromPersisted: (data: PersistedSession) => void
  acceptSessionToken: (token: string) => Promise<void>
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  sessionToken: null,
  tokenExpiresAtMs: null,
  user: null,

  setSessionToken: (sessionToken) => set({ sessionToken }),
  setSessionTokenWithExpiry: (sessionToken, tokenExpiresAtMs = null) =>
    set({ sessionToken, tokenExpiresAtMs }),
  setAuthStatus: (status) => set({ status }),

  hydrateSession: async () => {
    const token = get().sessionToken
    const googleConfigured = isGoogleIdentityConfigured()

    if (token && isGoogleIdTokenExpired(token)) {
      get().clearSession()
      return
    }

    if (isLocalDevHostname() && !token && !googleConfigured) {
      set({ status: 'loading' })
      set({
        status: 'authenticated',
        user: defaultLocalSessionUser,
      })
      return
    }

    if (!token) {
      set({ status: 'unauthenticated', user: null })
      return
    }

    set({ status: 'loading' })

    try {
      const payload = await fetchHubSessionProfile()
      const user = mapHubPayloadToUser(payload)
      set({
        status: 'authenticated',
        user,
      })
    } catch (error: unknown) {
      if (isLocalDevHostname()) {
        // Não apagar o token: o BFF remoto usa o Bearer Google e o GoogleSessionBridge
        // redirecionaria em loop se `sessionToken` ficasse vazio após falha do Hub local.
        set({
          status: 'authenticated',
          user: sessionUserFallbackLocalWithGoogleToken(token),
        })
        return
      }

      const maybeApiError = error as { status?: number }
      if (maybeApiError?.status === 401) {
        set({ status: 'invalid-session', user: null })
      } else {
        set({ status: 'unauthenticated', user: null })
      }
    }
  },

  setSessionFromPersisted: (data) => {
    set({
      sessionToken: data.token,
      tokenExpiresAtMs:
        typeof data.expiresAt === 'number'
          ? data.expiresAt
          : getGoogleIdTokenExpiryMs(data.token),
      status: 'idle',
    })
    void get().hydrateSession()
  },

  acceptSessionToken: async (token) => {
    const trimmed = token.trim()
    if (!trimmed) {
      get().clearSession()
      return
    }

    const tokenExpiresAtMs = getGoogleIdTokenExpiryMs(trimmed)
    persistSessionToken(trimmed, tokenExpiresAtMs)
    set({ sessionToken: trimmed, tokenExpiresAtMs, status: 'idle' })
    await get().hydrateSession()
  },

  clearSession: () => {
    clearPersistedSession()
    set({
      sessionToken: null,
      tokenExpiresAtMs: null,
      user: null,
      status: 'unauthenticated',
    })
  },
}))

function handleCrossTabStorageEvent(event: StorageEvent): void {
  if (event.storageArea !== localStorage) return
  if (event.key !== SESSION_STORAGE_KEY) return

  if (event.newValue === null || event.newValue === '') {
    useSessionStore.getState().clearSession()
    return
  }

  const parsed = parsePersistedSessionJson(event.newValue)
  if (parsed === null) {
    clearPersistedSession()
    useSessionStore.getState().clearSession()
    return
  }

  useSessionStore.getState().setSessionFromPersisted(parsed)
}

let crossTabListenerRegistered = false

export function initSessionCrossTabSync(): void {
  if (typeof window === 'undefined' || crossTabListenerRegistered) return
  crossTabListenerRegistered = true
  window.addEventListener('storage', handleCrossTabStorageEvent)
}
