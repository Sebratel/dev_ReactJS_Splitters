import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAppUiStore } from '@/shared/store/appUiStore'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { Sidebar } from './Sidebar'

export function RootLayout() {
  const globalLoading = useAppUiStore((s) => s.globalLoading)
  const globalError = useAppUiStore((s) => s.globalError)
  const setGlobalError = useAppUiStore((s) => s.setGlobalError)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-dvh bg-surface text-on-surface">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />

      <div
        className={
          sidebarCollapsed
            ? 'ml-28 flex min-h-0 min-w-0 flex-1 flex-col transition-[margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
            : 'ml-80 flex min-h-0 min-w-0 flex-1 flex-col transition-[margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
        }
      >
        {globalLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/40 backdrop-blur-sm">
            <LoadingState label="Processando sistema..." />
          </div>
        )}

        <main className="min-h-0 flex-1 p-10 pt-8">
          {globalError && (
            <div className="mb-10">
              <ErrorState
                message={globalError}
                onRetry={() => setGlobalError(null)}
              />
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
