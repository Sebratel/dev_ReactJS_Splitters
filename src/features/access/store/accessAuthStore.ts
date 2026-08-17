import { create } from 'zustand'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import {
  beginGoogleLoginRedirect,
  clearSilentRefreshFailure,
  shouldBackoffSilentRefresh,
} from '@/features/session/lib/googleIdentity'
import {
  isGoogleIdTokenExpired,
  isSessionTokenAlignedWithGatewayGoogleAudience,
} from '@/features/session/lib/googleToken'
import { useSessionStore } from '@/features/session/store/sessionStore'
import { firebaseAuth } from '@/shared/config/firebase'
import { env, isFirebaseAuthConfigured, isGoogleIdentityConfigured } from '@/shared/config/env'
import {
  ensureSplittersUserProfile,
  getSplittersUserProfile,
} from '@/features/access/api/firestoreUsers'
import {
  defaultSplittersPermissions,
  type SplittersPermissionSet,
  type SplittersUserProfile,
} from '@/features/access/model/access.types'

type AccessAuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type AccessAuthState = {
  status: AccessAuthStatus
  initialized: boolean
  user: User | null
  profile: SplittersUserProfile | null
  error: string | null
  initialize: () => void
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasPermission: (permission: keyof SplittersPermissionSet) => boolean
}

function displayNameFromFirebaseUser(user: User): string {
  const fromProfile = (user.displayName ?? '').trim()
  if (fromProfile !== '') return fromProfile
  const fromEmail = (user.email ?? '').trim()
  if (fromEmail !== '') return fromEmail.split('@')[0] ?? fromEmail
  return 'Usuario'
}

let unsubscribeAuthListener: null | (() => void) = null
const googleProvider = new GoogleAuthProvider()

function isAllowedFirebaseEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? '').trim().toLowerCase()
  if (normalized === '') return false

  const allowed = env.accessAllowedEmails
  if (allowed.length > 0 && allowed.includes(normalized)) return true

  const allowedDomain = env.accessAllowedEmailDomain
  if (allowedDomain !== '') {
    const domain = allowedDomain.startsWith('@') ? allowedDomain : `@${allowedDomain}`
    return normalized.endsWith(domain)
  }

  return allowed.length === 0
}

/**
 * O gateway (BFF via proxy) valida JWT no formato **Google ID token** (`aud` = Web client),
 * não o ID token emitido por `getIdToken()` do Firebase. Sem token válido em memória,
 * dispara OAuth implícito `prompt=none` para repor o Bearer antes das chamadas ao BFF.
 */
function beginSilentGoogleBffTokenRefreshIfNeeded(): void {
  if (!isFirebaseAuthConfigured()) return

  // Rotas standalone (ex.: monitor de parede em nova aba) não devem disparar um
  // hard-redirect OAuth — o token BFF não é essencial nessas telas e o redirect
  // quebraria a sessão ao redirecionar a aba para o Google e depois para a raiz.
  const STANDALONE_ROUTES = ['/massiva/monitor']
  if (STANDALONE_ROUTES.includes(window.location.pathname)) return

  const { sessionToken } = useSessionStore.getState()
  const st = typeof sessionToken === 'string' ? sessionToken.trim() : ''
  const aligned =
    st !== '' &&
    isSessionTokenAlignedWithGatewayGoogleAudience(st, env.googleClientId)
  if (aligned && !isGoogleIdTokenExpired(st)) {
    return
  }
  if (!isGoogleIdentityConfigured()) return
  if (shouldBackoffSilentRefresh()) return

  try {
    clearSilentRefreshFailure()
    beginGoogleLoginRedirect('silent')
  } catch {
    // Client ID inválido ou ambiente sem `window`
  }
}

export const useAccessAuthStore = create<AccessAuthState>((set, get) => ({
  status: isFirebaseAuthConfigured() ? 'loading' : 'unauthenticated',
  initialized: false,
  user: null,
  profile: null,
  error: null,

  initialize: () => {
    if (!isFirebaseAuthConfigured() || !firebaseAuth) {
      set({ initialized: true, status: 'unauthenticated' })
      return
    }

    if (unsubscribeAuthListener !== null) return

    unsubscribeAuthListener = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        set({
          initialized: true,
          status: 'unauthenticated',
          user: null,
          profile: null,
          error: null,
        })
        return
      }

      try {
        if (!isAllowedFirebaseEmail(firebaseUser.email)) {
          if (firebaseAuth) {
            await signOut(firebaseAuth)
          }
          useSessionStore.getState().clearSession()
          set({
            initialized: true,
            status: 'unauthenticated',
            user: null,
            profile: null,
            error: 'Seu e-mail não está liberado para acesso nesta fase.',
          })
          return
        }

        const profile = await ensureSplittersUserProfile({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: displayNameFromFirebaseUser(firebaseUser),
          photoURL: firebaseUser.photoURL ?? null,
        })

        if (profile.isActive) {
          beginSilentGoogleBffTokenRefreshIfNeeded()
        }

        set({
          initialized: true,
          status: profile.isActive ? 'authenticated' : 'unauthenticated',
          user: firebaseUser,
          profile,
          error: profile.isActive ? null : 'Seu usuario esta inativo. Contate um administrador.',
        })
      } catch (error) {
        set({
          initialized: true,
          status: 'unauthenticated',
          user: null,
          profile: null,
          error: error instanceof Error ? error.message : 'Falha ao carregar perfil de acesso.',
        })
      }
    })
  },

  signInWithGoogle: async () => {
    if (!firebaseAuth) {
      throw new Error('Firebase Auth nao configurado.')
    }

    set({ status: 'loading', error: null })

    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider)
      const cred = GoogleAuthProvider.credentialFromResult(result)
      const fromOAuth =
        typeof cred?.idToken === 'string' && cred.idToken.trim() !== ''
          ? cred.idToken.trim()
          : ''
      if (fromOAuth !== '') {
        if (isSessionTokenAlignedWithGatewayGoogleAudience(fromOAuth, env.googleClientId)) {
          await useSessionStore.getState().acceptSessionToken(fromOAuth)
        } else if (isGoogleIdentityConfigured() && !shouldBackoffSilentRefresh()) {
          clearSilentRefreshFailure()
          beginGoogleLoginRedirect('silent')
          return
        } else {
          // Fallback: mantém sessão com o id_token do popup (pode dar 401 no gateway se aud ≠ .env).
          await useSessionStore.getState().acceptSessionToken(fromOAuth)
        }
      } else if (isGoogleIdentityConfigured() && !shouldBackoffSilentRefresh()) {
        clearSilentRefreshFailure()
        beginGoogleLoginRedirect('silent')
        return
      } else {
        throw new Error(
          'Nao foi possivel obter o token Google para o gateway. Confirme VITE_GOOGLE_CLIENT_ID e tente de novo.',
        )
      }
      set({ error: null })
    } catch (error) {
      set({
        status: 'unauthenticated',
        error: error instanceof Error ? error.message : 'Nao foi possivel autenticar.',
      })
      throw error
    }
  },

  signOutUser: async () => {
    if (!firebaseAuth) return
    await signOut(firebaseAuth)
    useSessionStore.getState().clearSession()
    set({ status: 'unauthenticated', user: null, profile: null, error: null })
  },

  refreshProfile: async () => {
    const current = get().user
    if (!current) return

    const profile = await getSplittersUserProfile(current.uid)
    set({
      profile,
      status: profile && profile.isActive ? 'authenticated' : 'unauthenticated',
      error: profile && !profile.isActive
        ? 'Seu usuario esta inativo. Contate um administrador.'
        : null,
    })
  },

  hasPermission: (permission) => {
    if (!isFirebaseAuthConfigured()) {
      return true
    }

    const profile = get().profile
    if (!profile || !profile.isActive) return false

    const permissions = profile.permissions ?? defaultSplittersPermissions
    return Boolean(permissions[permission])
  },
}))
