import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Menu, Moon, PanelLeft, Sun } from 'lucide-react'
import operacaoSebratelMark from '@/assets/operacao-sebratel-mark.svg'
import { cn } from '@/shared/lib/utils'
import { getPreferredTheme, toggleTheme, type ThemeMode } from '@/shared/lib/theme'
import { NotificationsBell } from '@/app/layouts/topbar/NotificationsBell'
import { ProfileMenu } from '@/app/layouts/topbar/ProfileMenu'
import { MassivaAlertsControl } from '@/features/massiva/ui/MassivaAlertsControl'

const PAGE_TITLES: ReadonlyArray<{ test: (p: string) => boolean; title: string }> = [
  { test: (p) => p === '/', title: 'Dashboard' },
  { test: (p) => p.startsWith('/splitters/'), title: 'Detalhe do splitter' },
  { test: (p) => p.startsWith('/splitters'), title: 'Splitters' },
  { test: (p) => p.startsWith('/redistribuicao'), title: 'Redistribuição de Condomínios' },
  { test: (p) => p.startsWith('/sugestoes'), title: 'Sugestões' },
  { test: (p) => p.startsWith('/intelligence'), title: 'Painel da rede' },
  { test: (p) => p.startsWith('/massiva'), title: 'Massivas' },
  { test: (p) => p.startsWith('/usuarios'), title: 'Usuários' },
  { test: (p) => p.startsWith('/isa-config'), title: 'Configuração da ISA' },
  { test: (p) => p.startsWith('/clientes/'), title: 'Cliente' },
]
function usePageTitle(): string {
  const { pathname } = useLocation()
  return PAGE_TITLES.find((e) => e.test(pathname))?.title ?? 'Monitoramento'
}

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
  const pageTitle = usePageTitle()

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest/95 px-3 backdrop-blur-md sm:gap-3 sm:px-4',
        'supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] supports-[padding:max(0px)]:h-[calc(3.5rem+env(safe-area-inset-top))]',
      )}
    >
      {/* Menu + marca + trilha (breadcrumb: app › página) */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={isDesktop ? 'Recolher menu' : 'Abrir menu'}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {isDesktop ? <PanelLeft className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>

        <Link
          to="/"
          aria-label="Ir para o início"
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary shadow-sm shadow-primary/20 dark:shadow-primary/10"
        >
          <img src={operacaoSebratelMark} alt="" className="size-6 object-contain" width={24} height={24} decoding="async" />
        </Link>

        <nav aria-label="Você está em" className="flex min-w-0 items-center gap-1.5">
          <Link
            to="/"
            className="hidden shrink-0 text-sm font-semibold text-on-surface-variant transition hover:text-on-surface md:inline"
          >
            Monitoramento
          </Link>
          <ChevronRight className="hidden size-4 shrink-0 text-on-surface-variant/40 md:block" aria-hidden />
          <span className="truncate text-[15px] font-bold tracking-tight text-on-surface">{pageTitle}</span>
        </nav>
      </div>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <ThemeToggleIcon />
        <MassivaAlertsControl />
        <NotificationsBell />
        <ProfileMenu />
      </div>
    </header>
  )
}
