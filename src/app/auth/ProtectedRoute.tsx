import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { hasAuthParams, useAuth } from 'react-oidc-context'
import { signinRedirectWithReturnPath } from '@/app/auth/oidcReturnPath'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { isOidcConfigured } from '@/shared/config/env'

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

/**
 * Com OIDC configurado, redireciona para o login do provedor. Sem OIDC, libera o conteúdo
 * (útil para desenvolvimento local sem IdP).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!isOidcConfigured()) {
    return <>{children}</>
  }
  return <ProtectedRouteOidc>{children}</ProtectedRouteOidc>
}
