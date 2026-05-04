import { useEffect, useRef } from 'react'
import {
  beginGoogleLoginRedirect,
  clearInteractiveLoginFailure,
  clearSilentRefreshFailure,
  shouldBackoffInteractiveLogin,
  shouldBackoffSilentRefresh,
} from '@/features/session/lib/googleIdentity'
import {
  getGoogleTokenRefreshDelayMs,
  shouldRefreshGoogleIdToken,
} from '@/features/session/lib/googleToken'
import { useSessionStore } from '@/features/session/store/sessionStore'
import { isFirebaseAuthConfigured, isGoogleIdentityConfigured } from '@/shared/config/env'

export function GoogleSessionBridge() {
  const status = useSessionStore((s) => s.status)
  const sessionToken = useSessionStore((s) => s.sessionToken)
  const tokenExpiresAtMs = useSessionStore((s) => s.tokenExpiresAtMs)
  const attemptedRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isGoogleIdentityConfigured()) return
    /**
     * Com Firebase Auth, o login interativo é só na `/login` — evita redirect OAuth extra ao
     * abrir o app. O refresh silencioso do JWT Google (outro `useEffect`) continua ativo.
     */
    if (isFirebaseAuthConfigured()) return
    if (typeof sessionToken === 'string' && sessionToken.trim() !== '') return
    if (status === 'loading') return
    if (attemptedRef.current) return
    if (shouldBackoffInteractiveLogin()) return

    attemptedRef.current = true
    try {
      clearInteractiveLoginFailure()
      clearSilentRefreshFailure()
      beginGoogleLoginRedirect('interactive')
    } catch {
      attemptedRef.current = false
    }
  }, [sessionToken, status])

  useEffect(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    if (!isGoogleIdentityConfigured()) return
    if (typeof sessionToken !== 'string' || sessionToken.trim() === '') return

    if (shouldRefreshGoogleIdToken(sessionToken)) {
      if (!shouldBackoffSilentRefresh()) {
        try {
          beginGoogleLoginRedirect('silent')
        } catch {
          // noop
        }
      }
      return
    }

    const delayMs = getGoogleTokenRefreshDelayMs(sessionToken)
    if (delayMs === null) return

    refreshTimerRef.current = window.setTimeout(() => {
      if (shouldBackoffSilentRefresh()) return
      try {
        beginGoogleLoginRedirect('silent')
      } catch {
        // noop
      }
    }, delayMs)

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [sessionToken, tokenExpiresAtMs])

  return null
}
