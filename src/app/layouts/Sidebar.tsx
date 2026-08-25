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
  LogOut,
  X,
} from 'lucide-react'
import operacaoSebratelMark from '@/assets/operacao-sebratel-mark.svg'
import { cn } from '@/shared/lib/utils'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { isFirebaseAuthConfigured } from '@/shared/config/env'
import { BREAKPOINT_PX } from '@/shared/lib/breakpoints'
import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { prefetchNetworkStats } from '@/features/dashboard/hooks/useNetworkStats'
import { prefetchIntelligenceSplittersCatalog } from '@/features/intelligence/hooks/useNetworkIntelligenceData'

type SidebarProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Drawer (&lt; xl): painel deslizante */
  mobileDrawerOpen: boolean
  onMobileDrawerClose: () => void
  /** Chamado ao navegar no drawer (fecha o painel). */
  onNavigate: () => void
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileDrawerOpen,
  onMobileDrawerClose,
  onNavigate,
}: SidebarProps) {
  const queryClient = useQueryClient()
  const isXl = useMediaQuery(`(min-width: ${BREAKPOINT_PX.xl}px)`)
  /** No telefone/tablet o drawer mostra sempre rótulos completos. */
  const navCollapsed = isXl && collapsed
  const currentPath = useLocation().pathname
  const canAccessMassiva = useAccessAuthStore((s) => s.hasPermission('canViewMassiva'))
  const canAccessIntelligence = useAccessAuthStore((s) => s.hasPermission('canViewIntelligence'))
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const signOutUser = useAccessAuthStore((s) => s.signOutUser)

  const isActive = (to: string) => {
    if (to === '/') return currentPath === '/'
    return currentPath.startsWith(to)
  }

  const navigationItems = [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
    { label: 'Splitters', icon: Cpu, to: '/splitters' },
    { label: 'Redistribuição', icon: ArrowRightLeft, to: '/redistribuicao-condominios' },
    { label: 'Sugestões', icon: Lightbulb, to: '/sugestoes' },
    ...(canAccessIntelligence ? [{ label: 'Painel da rede', icon: BarChart2, to: '/intelligence' }] : []),
    ...(canAccessMassiva
      ? [{ label: 'Massivas', icon: AlertTriangle, to: '/massiva', accent: 'danger' as const }]
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
        'fixed z-50 flex flex-col overflow-hidden bg-white transition-[width,padding,box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,transform]',
        'max-xl:inset-y-0 max-xl:left-0 max-xl:h-full max-xl:w-[min(20rem,90vw)] max-xl:rounded-none max-xl:border-r max-xl:border-neutral-200/70 max-xl:p-5 max-xl:shadow-2xl max-xl:shadow-neutral-900/10',
        mobileDrawerOpen ? 'max-xl:translate-x-0' : 'max-xl:-translate-x-full',
        'xl:left-6 xl:top-6 xl:bottom-6 xl:rounded-4xl xl:shadow-xl xl:shadow-surface-container-low',
        navCollapsed
          ? 'xl:w-24 xl:p-4 xl:shadow-lg xl:shadow-surface-container-low/70'
          : 'xl:w-80 xl:p-8',
      )}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 justify-end pb-2 xl:hidden">
          <button
            type="button"
            onClick={onMobileDrawerClose}
            className="flex size-11 items-center justify-center rounded-xl border border-neutral-200/90 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            aria-label="Fechar menu"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div
          className={cn(
            'mb-6 flex shrink-0 xl:mb-8',
            navCollapsed ? 'justify-center' : 'items-start',
          )}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={navCollapsed ? 'Expandir menu lateral' : 'Ocultar menu lateral'}
            className={cn(
              'group relative flex rounded-3xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              navCollapsed
                ? 'flex-col items-center gap-3 text-center'
                : 'items-center gap-4 px-2 text-left',
            )}
          >
            <div className="flex h-18 w-18 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-[1.03]">
              <img
                src={operacaoSebratelMark}
                alt=""
                className="h-12 w-12 object-contain animate-operacao-mark motion-reduce:animate-none"
                width={48}
                height={48}
                decoding="async"
              />
            </div>
            {!navCollapsed ? (
              <div>
                <h1 className="text-xl font-black tracking-tighter text-on-surface">
                  Monitoramento
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  de Splitters
                </p>
              </div>
            ) : null}
          </button>
        </div>

        <nav
          className={cn(
            'min-h-0 flex-1 overflow-y-auto no-scrollbar transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            navCollapsed ? 'space-y-4 pr-0' : 'space-y-8 pr-2',
          )}
        >
          <div>
            {!navCollapsed ? (
              <p className="px-4 mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                Navegação
              </p>
            ) : null}
            <ul className="space-y-2">
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
                      'flex min-h-[44px] rounded-2xl transition-all duration-300 font-bold text-sm group',
                      navCollapsed
                        ? 'justify-center px-0 py-4'
                        : 'items-center gap-4 px-4 py-4',
                      isActive(item.to)
                        ? item.accent === 'danger'
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                          : 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
                    )}
                  >
                    <item.icon
                      size={20}
                      className={cn(
                        'transition-colors',
                        isActive(item.to)
                          ? 'text-white'
                          : item.accent === 'danger'
                            ? 'text-red-600 group-hover:text-red-700'
                            : 'text-primary group-hover:text-primary',
                      )}
                    />
                    {!navCollapsed ? item.label : null}
                  </Link>
                </li>
              ))}
            </ul>

            {!navCollapsed && isFirebaseAuthConfigured() ? (
              <div className="mt-4 px-2">
                <button
                  type="button"
                  onClick={() => {
                    void signOutUser()
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border border-transparent px-4 py-3.5 text-sm font-bold text-on-surface-variant transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                    <LogOut size={18} aria-hidden />
                  </span>
                  Sair
                </button>
              </div>
            ) : null}

            {navCollapsed && isFirebaseAuthConfigured() ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    void signOutUser()
                  }}
                  title="Sair"
                  className="flex w-full justify-center rounded-2xl border border-transparent px-0 py-3.5 text-on-surface-variant transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                    <LogOut size={18} aria-hidden />
                  </span>
                </button>
              </div>
            ) : null}
          </div>
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
