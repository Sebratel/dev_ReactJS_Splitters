import { create } from 'zustand'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { firebaseAuth } from '@/shared/config/firebase'
import { env, isFirebaseAuthConfigured } from '@/shared/config/env'
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
          await signOut(firebaseAuth)
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
        })

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
      await signInWithPopup(firebaseAuth, googleProvider)
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
