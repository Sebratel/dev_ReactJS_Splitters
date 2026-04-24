import { Outlet } from 'react-router-dom'
import { SessionGate } from '@/features/session/ui/SessionGate'

/**
 * Agrupa rotas que exigem sessão válida (ou ambiente local de desenvolvimento).
 */
export function SessionProtectedLayout() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  )
}
