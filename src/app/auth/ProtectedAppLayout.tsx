import { Outlet, useOutletContext } from 'react-router-dom'
import { ProtectedRoute } from '@/app/auth/ProtectedRoute'
import { useUsageTracking } from '@/features/analytics/hooks/useUsageTracking'

export function ProtectedAppLayout() {
  const layoutContext = useOutletContext<{
    sidebarCollapsed?: boolean
    mobileNavOpen?: boolean
  } | undefined>()

  // Radar de uso: registra os acessos aos módulos (best-effort, nunca bloqueia).
  useUsageTracking()

  return (
    <ProtectedRoute>
      <Outlet context={layoutContext} />
    </ProtectedRoute>
  )
}
