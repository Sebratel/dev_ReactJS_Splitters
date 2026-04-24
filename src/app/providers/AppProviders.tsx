import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/app/queryClient'
import { GoogleSessionBridge } from '@/features/session/ui/GoogleSessionBridge'
import { isOidcConfigured } from '@/shared/config/env'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {!isOidcConfigured() ? <GoogleSessionBridge /> : null}
      {children}
    </QueryClientProvider>
  )
}
