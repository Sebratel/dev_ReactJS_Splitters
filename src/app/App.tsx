import { useMemo } from 'react'
import { AuthProvider } from 'react-oidc-context'
import { RouterProvider } from 'react-router-dom'
import { buildOidcAuthProviderProps } from '@/app/auth/buildOidcAuthProviderProps'
import { OidcAccessTokenBridge } from '@/app/auth/OidcAccessTokenBridge'
import { AppProviders } from '@/app/providers/AppProviders'
import { router } from '@/app/router'
import { isOidcConfigured } from '@/shared/config/env'

/**
 * Raiz da aplicação: TanStack Query + roteador.
 * O bootstrap de sessão roda em main.tsx antes do primeiro paint.
 */
function AppInner() {
  return (
    <AppProviders>
      {isOidcConfigured() ? <OidcAccessTokenBridge /> : null}
      <RouterProvider router={router} />
    </AppProviders>
  )
}

export default function App() {
  const oidcProps = useMemo(() => buildOidcAuthProviderProps(), [])

  if (!isOidcConfigured()) {
    return <AppInner />
  }

  return (
    <AuthProvider {...oidcProps}>
      <AppInner />
    </AuthProvider>
  )
}
