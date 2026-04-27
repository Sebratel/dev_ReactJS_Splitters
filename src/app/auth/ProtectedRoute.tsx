import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { hasAuthParams, useAuth } from 'react-oidc-context'
import { signinRedirectWithReturnPath } from '@/app/auth/oidcReturnPath'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { isFirebaseAuthConfigured, isOidcConfigured } from '@/shared/config/env'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'

type ProtectedRouteProps = {
  children: ReactNode
}

function ProtectedRouteOidc({ children }: ProtectedRouteProps) {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (hasAuthParams()) return
    if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !auth.error) {
      void signinRedirectWithReturnPath(
        auth.signinRedirect,
        location.pathname,
        location.search,
      )
    }
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.activeNavigator,
    auth.error,
    auth.signinRedirect,
    location.pathname,
    location.search,
  ])

  switch (auth.activeNavigator) {
    case 'signinSilent':
    case 'signinRedirect':
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingState label="Autenticando..." />
        </div>
      )
    default:
      break
  }

  if (auth.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingState label="Autenticando..." />
      </div>
    )
  }

  if (auth.error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="max-w-md space-y-2 rounded-2xl border border-outline-variant/40 bg-surface-container-low/50 p-8">
          <h2 className="text-lg font-semibold text-on-surface">Erro de autenticação</h2>
          <p className="text-sm text-on-surface-variant">{auth.error.message}</p>
          <button
            type="button"
            onClick={() =>
              void signinRedirectWithReturnPath(
                auth.signinRedirect,
                location.pathname,
                location.search,
              )
            }
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (auth.isAuthenticated) {
    return <>{children}</>
  }

  return null
}

function ProtectedRouteFirebase({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const initialize = useAccessAuthStore((s) => s.initialize)
  const initialized = useAccessAuthStore((s) => s.initialized)
  const status = useAccessAuthStore((s) => s.status)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized || status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingState label="Validando acesso..." />
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <>{children}</>
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (isFirebaseAuthConfigured()) {
    return <ProtectedRouteFirebase>{children}</ProtectedRouteFirebase>
  }

  if (!isOidcConfigured()) {
    return <>{children}</>
  }

  return <ProtectedRouteOidc>{children}</ProtectedRouteOidc>
}
