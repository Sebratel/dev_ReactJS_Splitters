import { Link, useLocation } from 'react-router-dom'
import {
  Cpu,
  LayoutDashboard,
  AlertTriangle,
  BarChart2,
  ExternalLink,
  Users,
  LogOut,
} from 'lucide-react'
import operacaoSebratelMark from '@/assets/operacao-sebratel-mark.svg'
import { cn } from '@/shared/lib/utils'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { env, isFirebaseAuthConfigured } from '@/shared/config/env'

type SidebarProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
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
    ...(canAccessIntelligence ? [{ label: 'Painel da rede', icon: BarChart2, to: '/intelligence' }] : []),
    ...(canAccessMassiva
      ? [{ label: 'Massivas', icon: AlertTriangle, to: '/massiva', accent: 'danger' as const }]
      : []),
    ...(isAdmin
      ? [{ label: 'Usuários', icon: Users, to: '/usuarios' }]
      : []),
  ]

  return (
    <aside
      className={cn(
        'fixed left-6 top-6 bottom-6 rounded-4xl bg-white shadow-xl shadow-surface-container-low overflow-hidden flex flex-col transition-[width,padding,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]',
        collapsed ? 'w-24 p-4 shadow-lg shadow-surface-container-low/70' : 'w-80 p-8',
      )}
    >
      <div className="flex h-full flex-1 flex-col">
        <div
          className={cn(
            'mb-8 flex shrink-0',
            collapsed ? 'justify-center' : 'items-start',
          )}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Ocultar menu lateral'}
            className={cn(
              'group relative flex rounded-3xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              collapsed
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
            {!collapsed ? (
              <div>
                <h1 className="text-xl font-black tracking-tighter text-on-surface">
                  Operação
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  Dashboard Sebratel
                </p>
              </div>
            ) : null}
          </button>
        </div>

        <nav
          className={cn(
            'flex-1 overflow-y-auto no-scrollbar transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            collapsed ? 'space-y-4 pr-0' : 'space-y-8 pr-2',
          )}
        >
          <div>
            {!collapsed ? (
              <p className="px-4 mb-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                Navegação
              </p>
            ) : null}
            <ul className="space-y-2">
              {navigationItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex rounded-2xl transition-all duration-300 font-bold text-sm group',
                      collapsed
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
                    {!collapsed ? item.label : null}
                  </Link>
                </li>
              ))}
            </ul>

            {!collapsed ? (
              <div className="mt-4 px-2">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                  Links externos
                </p>
                <a
                  href={env.hubOrigin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-2xl border border-transparent px-4 py-3.5 text-sm font-bold text-on-surface-variant transition-all hover:border-primary/15 hover:bg-surface-container-low hover:text-on-surface"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                    <ExternalLink size={18} aria-hidden />
                  </span>
                  Hub Sebratel
                </a>
                {isFirebaseAuthConfigured() ? (
                  <button
                    type="button"
                    onClick={() => {
                      void signOutUser()
                    }}
                    className="mt-2 flex w-full items-center gap-4 rounded-2xl border border-transparent px-4 py-3.5 text-sm font-bold text-on-surface-variant transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                      <LogOut size={18} aria-hidden />
                    </span>
                    Sair
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-4">
                <a
                  href={env.hubOrigin}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Hub Sebratel"
                  className="flex justify-center rounded-2xl border border-transparent px-0 py-3.5 text-on-surface-variant transition-all hover:border-primary/15 hover:bg-surface-container-low hover:text-on-surface"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                    <ExternalLink size={18} aria-hidden />
                  </span>
                </a>
                {isFirebaseAuthConfigured() ? (
                  <button
                    type="button"
                    onClick={() => {
                      void signOutUser()
                    }}
                    title="Sair"
                    className="mt-2 flex w-full justify-center rounded-2xl border border-transparent px-0 py-3.5 text-on-surface-variant transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                      <LogOut size={18} aria-hidden />
                    </span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  )
}
