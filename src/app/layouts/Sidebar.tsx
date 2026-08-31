import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Cpu,
  LayoutDashboard,
  AlertTriangle,
  BarChart2,
  Bot,
  Lightbulb,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { useHomeDashboardMassivaOpen } from '@/features/massiva/hooks/useHomeDashboardMassivaOpen'
import { BREAKPOINT_PX } from '@/shared/lib/breakpoints'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { prefetchNetworkStats } from '@/features/dashboard/hooks/useNetworkStats'
import { prefetchIntelligenceSplittersCatalog } from '@/features/intelligence/hooks/useNetworkIntelligenceData'

type SidebarProps = {
  collapsed: boolean
  /** Drawer (&lt; xl): painel deslizante */
  mobileDrawerOpen: boolean
  onMobileDrawerClose: () => void
  /** Chamado ao navegar no drawer (fecha o painel). */
  onNavigate: () => void
}

export function Sidebar({ collapsed, mobileDrawerOpen, onMobileDrawerClose, onNavigate }: SidebarProps) {
  const queryClient = useQueryClient()
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINT_PX.xl}px)`)
  /** No telefone/tablet o drawer mostra sempre rótulos completos. */
  const navCollapsed = isXl && collapsed
  const currentPath = useLocation().pathname
  const canAccessMassiva = useAccessAuthStore((s) => s.hasPermission('canViewMassiva'))
  const canAccessIntelligence = useAccessAuthStore((s) => s.hasPermission('canViewIntelligence'))
  const canAccessRedistribution = useAccessAuthStore((s) => s.hasPermission('canViewRedistribution'))
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const { openCount } = useHomeDashboardMassivaOpen()

  const isActive = (to: string) => {
    if (to === '/') return currentPath === '/'
    return currentPath.startsWith(to)
  }

  const navigationItems = [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
    { label: 'Splitters', icon: Cpu, to: '/splitters' },
    ...(isAdmin || canAccessRedistribution
      ? [{ label: 'Redistribuição', icon: ArrowRightLeft, to: '/redistribuicao-condominios' }]
      : []),
    { label: 'Sugestões', icon: Lightbulb, to: '/sugestoes' },
    ...(canAccessIntelligence ? [{ label: 'Painel da rede', icon: BarChart2, to: '/intelligence' }] : []),
    ...(canAccessMassiva
      ? [
          {
            label: 'Massivas',
            icon: AlertTriangle,
            to: '/massiva',
            accent: 'danger' as const,
            badge: openCount > 0 ? openCount : undefined,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          { label: 'Usuários', icon: Users, to: '/usuarios' },
          { label: 'Config. ISA', icon: Bot, to: '/isa-config' },
        ]
      : []),
  ]

  return (
    <aside
      id="splitters-app-sidebar"
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden bg-surface-container-lowest transition-[width,padding,box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,transform]',
        'max-xl:inset-y-0 max-xl:left-0 max-xl:h-full max-xl:w-[min(20rem,90vw)] max-xl:rounded-none max-xl:border-r max-xl:border-neutral-200/70 dark:max-xl:border-white/10 max-xl:p-5 max-xl:shadow-2xl max-xl:shadow-neutral-900/10',
        mobileDrawerOpen ? 'max-xl:translate-x-0' : 'max-xl:-translate-x-full',
        'xl:left-6 xl:top-[4.75rem] xl:bottom-6 xl:rounded-4xl xl:shadow-xl xl:shadow-surface-container-low',
        navCollapsed ? 'xl:w-24 xl:p-4 xl:shadow-lg xl:shadow-surface-container-low/70' : 'xl:w-80 xl:p-6',
      )}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 justify-end pb-2 xl:hidden">
          <button
            type="button"
            onClick={onMobileDrawerClose}
            className="flex size-11 items-center justify-center rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant shadow-sm transition hover:bg-surface-container-low"
            aria-label="Fechar menu"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <nav
          className={cn(
            'min-h-0 flex-1 overflow-y-auto no-scrollbar transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            navCollapsed ? 'pr-0' : 'pr-1',
          )}
        >
          {!navCollapsed ? (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
              Navegação
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  title={navCollapsed ? item.label : undefined}
                  onClick={() => onNavigate()}
                  onMouseEnter={() => {
                    if (item.to === '/intelligence') {
                      void prefetchNetworkStats(queryClient)
                      void prefetchIntelligenceSplittersCatalog(queryClient)
                    }
                  }}
                  className={cn(
                    'group relative flex min-h-[46px] rounded-2xl text-sm font-bold transition-all duration-300',
                    navCollapsed ? 'justify-center px-0 py-3.5' : 'items-center gap-3.5 px-3.5 py-3',
                    isActive(item.to)
                      ? item.accent === 'danger'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
                  )}
                >
                  <span className="relative shrink-0">
                    <item.icon
                      size={20}
                      className={cn(
                        'transition-colors',
                        isActive(item.to)
                          ? 'text-white'
                          : item.accent === 'danger'
                            ? 'text-red-600 dark:text-red-300 group-hover:text-red-700 dark:group-hover:text-red-200'
                            : 'text-primary',
                      )}
                    />
                    {/* Badge como pontinho quando recolhido */}
                    {navCollapsed && item.badge ? (
                      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-surface-container-lowest">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    ) : null}
                  </span>
                  {!navCollapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                  {!navCollapsed && item.badge ? (
                    <span
                      className={cn(
                        'flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                        isActive(item.to) ? 'bg-white/20 text-white' : 'bg-red-500 text-white',
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {!navCollapsed ? (
          <div className="mt-4 shrink-0 px-2">
            <div
              id="splitters-sidebar-fab-dock"
              className="mt-3 flex min-h-[6.5rem] items-end justify-center"
              aria-hidden
            />
          </div>
        ) : null}
      </div>
    </aside>
  )
}
