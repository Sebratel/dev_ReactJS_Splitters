import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/app/queryClient'
import { GoogleSessionBridge } from '@/features/session/ui/GoogleSessionBridge'
import { isOidcConfigured } from '@/shared/config/env'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  /**
   * Com OIDC não usamos redirect Google. Com Firebase, o login interativo é na `/login`
   * (`GoogleAuthProvider`); o bridge continua montado para refresh silencioso (`prompt=none`)
   * do JWT Google esperado pelo gateway — não o ID token do Firebase.
   */
  const showGoogleSessionBridge = !isOidcConfigured()

  return (
    <QueryClientProvider client={queryClient}>
      {showGoogleSessionBridge ? <GoogleSessionBridge /> : null}
      {children}
    </QueryClientProvider>
  )
}
