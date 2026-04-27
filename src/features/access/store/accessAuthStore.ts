import { create } from 'zustand'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { firebaseAuth } from '@/shared/config/firebase'
import { isFirebaseAuthConfigured } from '@/shared/config/env'
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
  signIn: (email: string, password: string) => Promise<void>
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

  signIn: async (email, password) => {
    if (!firebaseAuth) {
      throw new Error('Firebase Auth nao configurado.')
    }

    set({ status: 'loading', error: null })

    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password)

      const current = firebaseAuth.currentUser
      if (!current) {
        throw new Error('Nao foi possivel validar o usuario autenticado.')
      }

      const profile = await getSplittersUserProfile(current.uid)
      if (profile && profile.isActive === false) {
        await signOut(firebaseAuth)
        throw new Error('Seu usuario esta inativo. Contate um administrador.')
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
    // Liberação temporária do módulo de massivas para todos os usuários.
    if (permission === 'canViewMassiva' || permission === 'canOpenMassiva') {
      return true
    }

    if (!isFirebaseAuthConfigured()) {
      return true
    }

    const profile = get().profile
    if (!profile || !profile.isActive) return false

    const permissions = profile.permissions ?? defaultSplittersPermissions
    return Boolean(permissions[permission])
  },
}))
