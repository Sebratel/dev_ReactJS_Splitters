import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Moon, PanelLeft, Sun } from 'lucide-react'
import operacaoSebratelMark from '@/assets/operacao-sebratel-mark.svg'
import { cn } from '@/shared/lib/utils'
import { getPreferredTheme, toggleTheme, type ThemeMode } from '@/shared/lib/theme'
import { NotificationsBell } from '@/app/layouts/topbar/NotificationsBell'
import { ProfileMenu } from '@/app/layouts/topbar/ProfileMenu'

function ThemeToggleIcon() {
  const [mode, setMode] = useState<ThemeMode>(() => getPreferredTheme())
  const isDark = mode === 'dark'
  return (
    <button
      type="button"
      onClick={() => setMode(toggleTheme())}
      aria-label={isDark ? 'Tema claro' : 'Tema escuro'}
      className="flex size-10 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {isDark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  )
}

type TopbarProps = {
  /** No desktop recolhe/expande a sidebar; no mobile abre o drawer. */
  onMenuClick: () => void
  isDesktop: boolean
}

export function Topbar({ onMenuClick, isDesktop }: TopbarProps) {
  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest/95 px-3 backdrop-blur-md sm:px-4',
        'supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] supports-[padding:max(0px)]:h-[calc(3.5rem+env(safe-area-inset-top))]',
      )}
    >
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={isDesktop ? 'Recolher menu' : 'Abrir menu'}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        {isDesktop ? <PanelLeft className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Ir para o início">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary shadow-sm shadow-primary/20 dark:shadow-primary/10">
          <img src={operacaoSebratelMark} alt="" className="size-6 object-contain" width={24} height={24} decoding="async" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-black tracking-tight text-on-surface">Monitoramento</span>
          <span className="block truncate text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/70">
            de Splitters
          </span>
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <ThemeToggleIcon />
        <NotificationsBell />
        <ProfileMenu />
      </div>
    </header>
  )
}
