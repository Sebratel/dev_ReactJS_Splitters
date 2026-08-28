import { useEffect, useState } from 'react'
import { BotMessageSquare, ClipboardList } from 'lucide-react'
import { MassivaAutoIspSupportSection } from '@/features/massiva/ui/MassivaAutoIspSupportSection'
import { MassivaTicketsSection } from '@/features/massiva/ui/MassivaTicketsSection'
import { cn } from '@/shared/lib/utils'

type RightPanelTab = 'autoisp' | 'protocolos'

const MASSIVA_RIGHT_PANEL_UI_STATE_KEY = 'nexaview.massiva.right-panel.ui.v1'

function readRightPanelUiState(): { tab: RightPanelTab } {
  if (typeof window === 'undefined') {
    return { tab: 'autoisp' }
  }

  try {
    const raw = window.sessionStorage.getItem(MASSIVA_RIGHT_PANEL_UI_STATE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Partial<{ tab: RightPanelTab }>
    return {
      tab: parsed.tab === 'protocolos' ? 'protocolos' : 'autoisp',
    }
  } catch {
    return { tab: 'autoisp' }
  }
}

export function AutoISPPanel() {
  return <MassivaAutoIspSupportSection />
}

export function ProtocolosPanel() {
  return <MassivaTicketsSection layout="embedded" />
}

type RightPanelProps = {
  showProtocolsTab?: boolean
}

export function RightPanel({ showProtocolsTab = true }: RightPanelProps) {
  const [uiState, setUiState] = useState(readRightPanelUiState)
  const { tab } = uiState
  const activeTab: RightPanelTab = showProtocolsTab ? tab : 'autoisp'

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      MASSIVA_RIGHT_PANEL_UI_STATE_KEY,
      JSON.stringify(uiState),
    )
  }, [uiState])

  return (
    <aside className="flex min-h-0 min-w-0 flex-col rounded-xl bg-surface-container-low/80 px-3 py-3 ring-1 ring-neutral-200/70 dark:ring-white/10 sm:px-4 sm:py-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Apoio operacional
          </p>
          <h2 className="mt-1 text-base font-semibold text-on-surface">
            {activeTab === 'autoisp' ? 'AutoISP' : 'Protocolos'}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {activeTab === 'autoisp'
              ? 'Sugestoes de eventos e preenchimento assistido.'
              : 'Consulta e encerramento de protocolos existentes.'}
          </p>
        </div>
        {showProtocolsTab ? (
          <div
            className="grid w-full grid-cols-1 gap-1 rounded-2xl bg-surface-container-lowest p-1 shadow-sm ring-1 ring-neutral-200/80 dark:ring-white/10 sm:w-auto sm:grid-cols-2 sm:rounded-full"
            role="tablist"
            aria-label="Abas do painel lateral"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'autoisp'}
              onClick={() => setUiState({ tab: 'autoisp' })}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                tab === 'autoisp'
                  ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-1 ring-sky-200'
                  : 'text-on-surface-variant hover:bg-surface-container-low',
              )}
            >
              <BotMessageSquare size={14} aria-hidden />
              AutoISP
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'protocolos'}
              onClick={() => setUiState({ tab: 'protocolos' })}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                tab === 'protocolos'
                  ? 'bg-surface-container-lowest text-on-surface ring-1 ring-neutral-200 dark:ring-white/10'
                  : 'text-on-surface-variant hover:bg-surface-container-low',
              )}
            >
              <ClipboardList size={14} aria-hidden />
              Protocolos
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'autoisp' ? (
          <div role="tabpanel" aria-label="Painel do AutoISP">
            <AutoISPPanel />
          </div>
        ) : (
          <div role="tabpanel" aria-label="Painel de protocolos">
            <ProtocolosPanel />
          </div>
        )}
      </div>
    </aside>
  )
}
