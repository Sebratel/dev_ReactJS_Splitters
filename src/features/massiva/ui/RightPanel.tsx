import { useState } from 'react'
import { BotMessageSquare, ClipboardList } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { MassivaAutoIspSupportSection } from '@/features/massiva/ui/MassivaAutoIspSupportSection'
import { MassivaTicketsSection } from '@/features/massiva/ui/MassivaTicketsSection'

type RightPanelTab = 'autoisp' | 'protocolos'

export function AutoISPPanel() {
  return <MassivaAutoIspSupportSection />
}

export function ProtocolosPanel() {
  return <MassivaTicketsSection layout="embedded" />
}

export function RightPanel() {
  const [tab, setTab] = useState<RightPanelTab>('autoisp')

  return (
    <aside className="flex min-h-0 min-w-0 flex-col rounded-xl bg-neutral-50/80 px-3 py-3 ring-1 ring-neutral-200/70 sm:px-4 sm:py-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Apoio operacional
          </p>
          <h2 className="mt-1 text-base font-semibold text-neutral-900">
            {tab === 'autoisp' ? 'AutoISP' : 'Protocolos'}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {tab === 'autoisp'
              ? 'Sugestões de eventos e preenchimento assistido.'
              : 'Consulta e encerramento de protocolos existentes.'}
          </p>
        </div>
        <div
          className="flex w-full flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-neutral-200/80 sm:w-auto sm:flex-nowrap sm:rounded-full"
          role="tablist"
          aria-label="Abas do painel lateral"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'autoisp'}
            onClick={() => setTab('autoisp')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:flex-none',
              tab === 'autoisp'
                ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-200'
                : 'text-neutral-600 hover:bg-neutral-50',
            )}
          >
            <BotMessageSquare size={14} aria-hidden />
            AutoISP
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'protocolos'}
            onClick={() => setTab('protocolos')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:flex-none',
              tab === 'protocolos'
                ? 'bg-white text-neutral-900 ring-1 ring-neutral-200'
                : 'text-neutral-600 hover:bg-neutral-50',
            )}
          >
            <ClipboardList size={14} aria-hidden />
            Protocolos
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'autoisp' ? (
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
