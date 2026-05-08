import { Outlet, useOutletContext } from 'react-router-dom'
import { ProtectedRoute } from '@/app/auth/ProtectedRoute'

export function ProtectedAppLayout() {
  const layoutContext = useOutletContext<{
    sidebarCollapsed?: boolean
    mobileNavOpen?: boolean
  } | undefined>()

  return (
    <ProtectedRoute>
      <Outlet context={layoutContext} />
    </ProtectedRoute>
  )
}
