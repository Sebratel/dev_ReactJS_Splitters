import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'
import {
  pathAfterOidcSignIn,
  signinRedirectRetryPreserveStored,
} from '@/app/auth/oidcReturnPath'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { isOidcConfigured } from '@/shared/config/env'

function OidcCallbackRedirectHome() {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate('/', { replace: true })
  }, [navigate])
  return null
}

function OidcCallbackPageInner() {
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth.isLoading) return
    if (auth.isAuthenticated && auth.user) {
      const next = pathAfterOidcSignIn(auth.user.state)
      void navigate(next, { replace: true })
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, navigate])

  if (auth.error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <div className="max-w-md space-y-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-lg">
          <h2 className="text-lg font-semibold text-on-surface">Erro no retorno do login</h2>
          <p className="text-sm text-on-surface-variant">{auth.error.message}</p>
          <button
            type="button"
            onClick={() => void signinRedirectRetryPreserveStored(auth.signinRedirect)}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface">
      <LoadingState label="Finalizando login..." />
    </div>
  )
}

/**
 * Rota de `redirect_uri` OIDC. Deve estar registrada no cliente do IdP com o mesmo path.
 */
export function OidcCallbackPage() {
  if (!isOidcConfigured()) {
    return <OidcCallbackRedirectHome />
  }
  return <OidcCallbackPageInner />
}
