import { useState } from 'react'
import { MapPin, FileEdit } from 'lucide-react'
import { useMassivaLocalPreview } from '@/features/massiva/hooks/useMassivaLocalPreview'
import { MassivaLocalPreviewControls } from '@/features/massiva/ui/MassivaLocalPreviewControls'
import { MassivaLocalPreviewResult } from '@/features/massiva/ui/MassivaLocalPreviewResult'
import { MassivaOpeningPreparationPanel } from '@/features/massiva/ui/MassivaOpeningPreparationPanel'
import { MassivaOpenReadinessSection } from '@/features/massiva/ui/MassivaOpenReadinessSection'
import { cn } from '@/shared/lib/utils'
import { massivaTabPillTrack } from '@/features/massiva/ui/massivaScreen.tokens'

type WorkspaceTab = 'rota' | 'abertura'

export function MassivaLocalPreviewSection() {
  const [workspace, setWorkspace] = useState<WorkspaceTab>('rota')
  const {
    view,
    openingPreparation,
    selection,
    addConnection,
    removeConnection,
    setConnectionAp,
    setConnectionSlot,
    setConnectionPorta,
    toggleConnectionSplitter,
    clearConnectionSplitters,
    clearRoute,
    apOptionsForConnection,
    slotOptionsForConnection,
    portOptionsForConnection,
    searchSplitterOptionsForConnection,
    apDisplayLabel,
    refetchConnections,
    previewDebug,
  } = useMassivaLocalPreview()

  return (
    <div className="space-y-5" aria-labelledby="massiva-local-preview-heading">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-gradient-to-b from-white dark:from-surface-container-lowest to-neutral-50/40 dark:to-white/5 px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:py-3.5">
        <div className="min-w-0 space-y-0.5">
          <h2
            id="massiva-local-preview-heading"
            className="text-sm font-semibold tracking-tight text-on-surface"
          >
            Preview e protocolo
          </h2>
          <p className="text-[11px] leading-relaxed text-on-surface-variant">
            Alterne entre a rota e o formulário — menos rolagem, mais foco.
          </p>
        </div>
        <div className={massivaTabPillTrack} role="tablist" aria-label="Área de trabalho">
          <button
            type="button"
            role="tab"
            aria-selected={workspace === 'rota'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/45',
              workspace === 'rota'
                ? 'bg-surface-container-lowest text-amber-950 shadow-sm ring-1 ring-amber-200/80'
                : 'text-on-surface-variant hover:bg-surface-container-lowest/70 hover:text-on-surface',
            )}
            onClick={() => setWorkspace('rota')}
          >
            <MapPin size={14} aria-hidden />
            Rota e conexões
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspace === 'abertura'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45',
              workspace === 'abertura'
                ? 'bg-surface-container-lowest text-violet-950 shadow-sm ring-1 ring-violet-200/80'
                : 'text-on-surface-variant hover:bg-surface-container-lowest/70 hover:text-on-surface',
            )}
            onClick={() => setWorkspace('abertura')}
          >
            <FileEdit size={14} aria-hidden />
            Formulário e abertura
          </button>
        </div>
      </div>

      {workspace === 'rota' ? (
        <div
          className="space-y-4"
          role="tabpanel"
          aria-label="Seleção de rota e preview"
        >
          <div className="rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest p-4 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03]">
            <MassivaLocalPreviewControls
              connections={selection.connections}
              apDisplayLabel={apDisplayLabel}
              apOptionsForConnection={apOptionsForConnection}
              slotOptionsForConnection={slotOptionsForConnection}
              portOptionsForConnection={portOptionsForConnection}
              searchSplitterOptionsForConnection={searchSplitterOptionsForConnection}
              onAddConnection={addConnection}
              onRemoveConnection={removeConnection}
              onSetConnectionAp={setConnectionAp}
              onSetConnectionSlot={setConnectionSlot}
              onSetConnectionPorta={setConnectionPorta}
              onToggleConnectionSplitter={toggleConnectionSplitter}
              onClearConnectionSplitters={clearConnectionSplitters}
              onClearRoute={clearRoute}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-emerald-200/50 dark:border-emerald-800/50 bg-gradient-to-b from-white dark:from-surface-container-lowest to-emerald-50/25 dark:to-emerald-950/20 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100/40">
              <div className="flex items-center gap-2 border-b border-emerald-100/80 bg-emerald-50/40 dark:bg-emerald-950/40 px-4 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-900/90">
                  Afetados (preview)
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 xl:max-h-[min(280px,34vh)]">
                <MassivaLocalPreviewResult
                  view={view}
                  onRetryConnections={refetchConnections}
                  previewDebug={previewDebug}
                />
              </div>
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-violet-200/55 dark:border-violet-800/50 bg-gradient-to-b from-white dark:from-surface-container-lowest via-violet-50/20 dark:via-violet-950/20 to-violet-50/35 dark:to-violet-950/20 shadow-[0_4px_20px_-6px_rgba(109,40,217,0.12)] ring-1 ring-violet-200/30">
              <div className="flex items-center gap-2 border-b border-violet-100/90 bg-violet-50/50 dark:bg-violet-950/40 px-4 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.22)]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-900/90">
                  Resumo da rota
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 xl:max-h-[min(280px,34vh)]">
                <MassivaOpeningPreparationPanel
                  preparation={openingPreparation}
                  onRetryConnections={refetchConnections}
                />
              </div>
            </div>
          </div>

          <p className="text-center text-[11px] text-on-surface-variant">
            Pronto?{' '}
            <button
              type="button"
              className="font-semibold text-violet-700 dark:text-violet-200 underline decoration-violet-300/70 underline-offset-[3px] transition hover:text-violet-900 dark:hover:text-violet-200"
              onClick={() => setWorkspace('abertura')}
            >
              Ir para formulário e abertura
            </button>
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-violet-200/40 dark:border-violet-800/50 bg-gradient-to-b from-violet-50/30 dark:from-violet-950/20 to-neutral-50/40 dark:to-white/5 p-4 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] ring-1 ring-violet-100/50"
          role="tabpanel"
          aria-label="Formulário e envio"
        >
          <MassivaOpenReadinessSection openingPreparation={openingPreparation} />
        </div>
      )}
    </div>
  )
}
