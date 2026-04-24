import { Outlet } from 'react-router-dom'
import { ProtectedRoute } from '@/app/auth/ProtectedRoute'

export function ProtectedAppLayout() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  )
}
