import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { setOidcAccessToken } from '@/app/auth/oidcAccessToken'

/**
 * Mantém o access token OIDC em memória para o `bffClient` (fora da árvore React).
 */
export function OidcAccessTokenBridge() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) {
      setOidcAccessToken(null)
      return
    }
    // O BFF atual valida JWT no formato do Google ID token.
    // Se `id_token` existir, prioriza ele; caso contrário, usa access token.
    setOidcAccessToken(auth.user.id_token ?? auth.user.access_token ?? null)
  }, [auth.isAuthenticated, auth.user])

  return null
}
