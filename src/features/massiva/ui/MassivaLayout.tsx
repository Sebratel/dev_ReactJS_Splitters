import { NavLink, Outlet } from 'react-router-dom'
import { Sparkles, MonitorPlay } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { cn } from '@/shared/lib/utils'

const TAB_ITEMS = [
  { to: '/massiva', label: 'Operacional', end: true },
  { to: '/massiva/dashboard', label: 'Dashboard', end: false },
] as const

/**
 * Layout raiz do módulo de massivas.
 * Cabeçalho, navegação por abas e `<Outlet />` para a rota ativa.
 */
export function MassivaLayout() {
  return (
    <div className="mx-auto max-w-[1720px] animate-in fade-in pt-0 duration-500">
      <AppPageHeader
        icon={Sparkles}
        badge="Centro de operação"
        title="Operação de Massivas"
        description="Fluxo guiado de abertura com preview de rota, formulário e apoio do AutoISP — tudo organizado em painéis claros."
        primaryAction={{ to: '/splitters', label: 'Voltar aos Splitters' }}
      />

      {/* Navegação por abas */}
      <div className="mt-5 flex items-center border-b border-neutral-200/80">
        {TAB_ITEMS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}

        {/* Botão Monitor de Parede — abre /massiva/monitor em nova aba (TV CGR/COR) */}
        <a
          href="/massiva/monitor"
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir monitor de parede (CGR/COR)"
          className={cn(
            'ml-auto mb-1 flex items-center gap-1.5 rounded-md px-3 py-1.5',
            'text-xs font-medium text-neutral-500 transition-colors duration-200',
            'hover:bg-neutral-100 hover:text-neutral-800',
          )}
        >
          <MonitorPlay size={15} />
          Monitor
        </a>
      </div>

      {/* Conteúdo da rota ativa */}
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  )
}
