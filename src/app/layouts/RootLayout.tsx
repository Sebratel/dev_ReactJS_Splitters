import { useEffect, useLayoutEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Topbar } from '@/app/layouts/Topbar'
import { useAppUiStore } from '@/shared/store/appUiStore'
import { BREAKPOINT_PX } from '@/shared/lib/breakpoints'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { Sidebar } from './Sidebar'

export function RootLayout() {
  const globalLoading = useAppUiStore((s) => s.globalLoading)
  const globalError = useAppUiStore((s) => s.globalError)
  const setGlobalError = useAppUiStore((s) => s.setGlobalError)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { pathname } = useLocation()

  const isDesktopLayout = useMediaQuery(`(min-width: ${BREAKPOINT_PX.xl}px)`)

  /**
   * Leaflet (arrasto do mapa) pode deixar `leaflet-dragging` / `pointer-events` no body.
   * Isso intercepta cliques em toda a app (sidebar, links, voltar). Limpa a cada mudança de rota.
   */
  useLayoutEffect(() => {
    document.body.classList.remove('leaflet-dragging')
    document.body.style.removeProperty('pointer-events')
    document.querySelectorAll('.leaflet-drag-target').forEach((el) => {
      el.classList.remove('leaflet-drag-target')
    })
  }, [pathname])

  useEffect(() => {
    if (isDesktopLayout) setMobileNavOpen(false)
  }, [isDesktopLayout])

  useEffect(() => {
    if (isDesktopLayout || !mobileNavOpen) {
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isDesktopLayout, mobileNavOpen])

  const closeMobileNav = () => setMobileNavOpen(false)

  return (
    <div className="flex min-h-dvh bg-surface text-on-surface">
      <Topbar
        isDesktop={isDesktopLayout}
        onMenuClick={() =>
          isDesktopLayout ? setSidebarCollapsed((value) => !value) : setMobileNavOpen(true)
        }
      />

      {!isDesktopLayout && mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-neutral-950/25 backdrop-blur-[1px] xl:hidden"
          aria-label="Fechar menu"
          onClick={closeMobileNav}
        />
      ) : null}

      <Sidebar
        collapsed={sidebarCollapsed}
        mobileDrawerOpen={mobileNavOpen}
        onMobileDrawerClose={closeMobileNav}
        onNavigate={closeMobileNav}
      />

      <div
        className={
          sidebarCollapsed
            ? 'ml-0 flex min-h-0 min-w-0 flex-1 flex-col transition-[margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] xl:ml-20'
            : 'ml-0 flex min-h-0 min-w-0 flex-1 flex-col transition-[margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] xl:ml-[15.5rem]'
        }
      >
        {globalLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/40 backdrop-blur-sm">
            <LoadingState label="Processando sistema..." />
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-x-hidden px-4 pb-6 pt-[calc(3.5rem+env(safe-area-inset-top)+0.75rem)] sm:px-6 sm:pb-8 xl:px-10 xl:pb-10 xl:pt-[4.75rem]">
          {globalError && (
            <div className="mb-6 xl:mb-10">
              <ErrorState
                message={globalError}
                onRetry={() => setGlobalError(null)}
              />
            </div>
          )}
          <Outlet context={{ sidebarCollapsed, mobileNavOpen }} />
        </main>
      </div>
    </div>
  )
}
