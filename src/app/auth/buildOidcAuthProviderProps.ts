import type { AuthProviderProps } from 'react-oidc-context'
import { env } from '@/shared/config/env'

function normalizeRedirectPath(raw: string): string {
  const t = raw.trim()
  if (t === '') return '/callback'
  return t.startsWith('/') ? t : `/${t}`
}

/**
 * Configuração do AuthProvider (OIDC code + PKCE). `redirect_uri` e logout redirect
 * usam o origin atual do browser.
 */
export function buildOidcAuthProviderProps(): AuthProviderProps {
  const path = normalizeRedirectPath(env.oidcRedirectPath)
  const origin = window.location.origin
  const postLogout =
    env.oidcPostLogoutRedirectUri.trim() !== ''
      ? env.oidcPostLogoutRedirectUri.trim()
      : origin

  return {
    authority: env.oidcAuthority.trim(),
    client_id: env.oidcClientId.trim(),
    redirect_uri: `${origin}${path}`,
    post_logout_redirect_uri: postLogout,
    response_type: 'code',
    scope: env.oidcScope.trim() || 'openid profile email',
    automaticSilentRenew: true,
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, window.location.pathname)
    },
  }
}
