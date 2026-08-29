import { NavLink, Outlet } from 'react-router-dom'
import { Sparkles, MonitorPlay, Wrench, BarChart3, type LucideIcon } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { cn } from '@/shared/lib/utils'
import { useSessionStore } from '@/features/session/store/sessionStore'
import { persistSessionToken } from '@/shared/lib/storage'

const TAB_ITEMS: ReadonlyArray<{ to: string; label: string; end: boolean; icon: LucideIcon }> = [
  { to: '/massiva', label: 'Operacional', end: true, icon: Wrench },
  { to: '/massiva/dashboard', label: 'Dashboard', end: false, icon: BarChart3 },
]

/**
 * Layout raiz do modulo de massivas.
 * Cabecalho, navegacao por abas e `<Outlet />` para a rota ativa.
 */
export function MassivaLayout() {
  return (
    <div className="mx-auto max-w-[1720px] animate-in fade-in pt-0 duration-500">
      <AppPageHeader
        icon={Sparkles}
        badge="Centro de operacao"
        title="Operacao de Massivas"
        description="Fluxo guiado de abertura com preview de rota, formulario e apoio do AutoISP — tudo organizado em paineis claros."
        primaryAction={{ to: '/splitters', label: 'Voltar aos Splitters' }}
      />

      {/* Navegação por abas */}
      <div className="mt-5 flex items-center gap-2 border-b border-neutral-200/80 px-1">
        <div className="flex gap-1 rounded-lg bg-neutral-100/80 p-1">
          {TAB_ITEMS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/80'
                    : 'text-neutral-500 hover:bg-white/50 hover:text-neutral-700',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon
                    size={15}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-amber-500' : 'text-neutral-400 group-hover:text-neutral-500',
                    )}
                  />
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Botão Monitor de Parede — abre /massiva/monitor em nova aba (TV CGR/COR).
            Estratégia dupla para garantir o token na nova aba:
            1) Passa o token no hash #id_token=<token> — bootstrapSession() já lê este
               parâmetro (mesmo mecanismo do callback OAuth) e o remove da URL logo após.
               Garante o token mesmo que localStorage esteja vazio.
            2) Persiste no localStorage como fallback para F5 na aba do monitor.
            O store Zustand é in-memory e não é compartilhado entre abas. */}
        <button
          type="button"
          title="Abrir monitor de parede (CGR/COR)"
          onClick={() => {
            const { sessionToken, tokenExpiresAtMs } = useSessionStore.getState()
            if (sessionToken) {
              persistSessionToken(sessionToken, tokenExpiresAtMs)
              window.open(
                `/massiva/monitor#id_token=${encodeURIComponent(sessionToken)}`,
                '_blank',
                'noopener,noreferrer',
              )
            } else {
              window.open('/massiva/monitor', '_blank', 'noopener,noreferrer')
            }
          }}
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-3 py-2',
            'text-xs font-medium text-neutral-500 shadow-sm transition-all duration-200',
            'hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700',
          )}
        >
          <MonitorPlay size={15} />
          Monitor
        </button>
      </div>

      {/* Conteúdo da rota ativa */}
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  )
}
