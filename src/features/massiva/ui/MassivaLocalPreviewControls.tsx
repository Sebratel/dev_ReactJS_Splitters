import { useState } from 'react'
import type {
  MassivaRouteConnectionSelection,
  MassivaSelectedSplitter,
} from '@/features/massiva/model/massivaLocalPreview'
import { OLT_PON_LABEL, OLT_SLOT_LABEL } from '@/shared/lib/oltTopologyLabels'

type MassivaLocalPreviewControlsProps = {
  connections: MassivaRouteConnectionSelection[]
  apDisplayLabel: (code: string) => string
  apOptionsForConnection: (connection: MassivaRouteConnectionSelection) => string[]
  slotOptionsForConnection: (connection: MassivaRouteConnectionSelection) => number[]
  portOptionsForConnection: (connection: MassivaRouteConnectionSelection) => number[]
  searchSplitterOptionsForConnection: (
    connection: MassivaRouteConnectionSelection,
    search: string,
    limit?: number,
  ) => Array<{ code: string; label: string }>
  onAddConnection: () => void
  onRemoveConnection: (index: number) => void
  onSetConnectionAp: (index: number, apCode: string | null) => void
  onSetConnectionSlot: (index: number, slot: number | null) => void
  onSetConnectionPorta: (index: number, porta: number | null) => void
  onToggleConnectionSplitter: (index: number, splitter: MassivaSelectedSplitter) => void
  onClearConnectionSplitters: (index: number) => void
  onClearRoute: () => void
}

const selectClass =
  'w-full min-w-0 max-w-full appearance-none rounded-xl border border-neutral-200/90 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/90 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60'
const inputClass =
  'w-full min-w-0 max-w-full rounded-xl border border-neutral-200/90 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition placeholder:text-neutral-400 focus:border-amber-500/90 focus:outline-none focus:ring-2 focus:ring-amber-500/20'
const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-neutral-500'
const MAX_SPLITTER_SUGGESTIONS = 40

export function MassivaLocalPreviewControls({
  connections,
  apDisplayLabel,
  apOptionsForConnection,
  slotOptionsForConnection,
  portOptionsForConnection,
  searchSplitterOptionsForConnection,
  onAddConnection,
  onRemoveConnection,
  onSetConnectionAp,
  onSetConnectionSlot,
  onSetConnectionPorta,
  onToggleConnectionSplitter,
  onClearConnectionSplitters,
  onClearRoute,
}: MassivaLocalPreviewControlsProps) {
  const [splitterSearchByRoute, setSplitterSearchByRoute] = useState<Record<number, string>>({})

  const splitterSearch = (index: number): string => splitterSearchByRoute[index] ?? ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Rotas selecionadas</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            Você pode começar por AP/slot/PON ou pelo splitter. A seleção é bidirecional.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-10 rounded-xl border border-amber-200/90 bg-amber-50 px-3 text-xs font-semibold text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
            onClick={onAddConnection}
          >
            Adicionar rota
          </button>
          <button
            type="button"
            className="h-10 rounded-xl border border-neutral-200/90 bg-white px-4 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
            onClick={onClearRoute}
          >
            Limpar rota
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {connections.map((connection, index) => {
          const apValue = connection.apId
          const slotValue = connection.slot === null ? '' : String(connection.slot)
          const portaValue = connection.porta === null ? '' : String(connection.porta)

          const apOptions = apOptionsForConnection(connection)
          const slotOptions = slotOptionsForConnection(connection)
          const portaOptions = portOptionsForConnection(connection)

          const search = splitterSearch(index)
          const splitterSuggestions = searchSplitterOptionsForConnection(
            connection,
            search,
            MAX_SPLITTER_SUGGESTIONS,
          )

          const selectedIds = new Set(connection.splitters.map((splitter) => splitter.id))
          const canSearchSplitters =
            apOptions.length > 0 || slotOptions.length > 0 || portaOptions.length > 0

          return (
            <section
              key={`route-${index}`}
              className="rounded-2xl border border-neutral-200/80 bg-neutral-50/30 p-3.5 shadow-[0_1px_4px_rgba(15,23,42,0.04)]"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                  Rota {index + 1}
                </p>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
                  disabled={connections.length <= 1}
                  onClick={() => onRemoveConnection(index)}
                >
                  Remover
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                  <span className={labelClass}>Ponto de acesso</span>
                  <select
                    className={selectClass}
                    value={apValue}
                    onChange={(event) => {
                      const next = event.target.value
                      onSetConnectionAp(index, next === '' ? null : next)
                    }}
                  >
                    <option value="">Selecione...</option>
                    {apOptions.map((code) => (
                      <option key={code} value={code}>
                        {apDisplayLabel(code)} ({code})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                  <span className={labelClass}>{OLT_SLOT_LABEL}</span>
                  <select
                    className={selectClass}
                    value={slotValue}
                    onChange={(event) => {
                      const next = event.target.value
                      onSetConnectionSlot(index, next === '' ? null : Number.parseInt(next, 10))
                    }}
                  >
                    <option value="">-</option>
                    {slotOptions.map((slotOption) => (
                      <option key={slotOption} value={String(slotOption)}>
                        {slotOption}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                  <span className={labelClass}>{OLT_PON_LABEL}</span>
                  <select
                    className={selectClass}
                    value={portaValue}
                    onChange={(event) => {
                      const next = event.target.value
                      onSetConnectionPorta(index, next === '' ? null : Number.parseInt(next, 10))
                    }}
                  >
                    <option value="">-</option>
                    {portaOptions.map((portaOption) => (
                      <option key={portaOption} value={String(portaOption)}>
                        {portaOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={labelClass}>Splitters</span>
                  <button
                    type="button"
                    className="rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                    onClick={() => onClearConnectionSplitters(index)}
                  >
                    Todos da rota
                  </button>
                </div>

                <input
                  type="text"
                  className={inputClass}
                  value={search}
                  onChange={(event) => {
                    const value = event.target.value
                    setSplitterSearchByRoute((current) => ({
                      ...current,
                      [index]: value,
                    }))
                  }}
                  placeholder="Digite para buscar splitter (código ou nome)..."
                  disabled={!canSearchSplitters}
                />

                {connection.splitters.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {connection.splitters.map((splitter) => (
                      <button
                        key={splitter.id}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200/90 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950"
                        onClick={() => onToggleConnectionSplitter(index, splitter)}
                        title="Remover splitter"
                      >
                        <span className="font-mono">{splitter.id}</span>
                        <span className="truncate max-w-52">{splitter.label}</span>
                        <span aria-hidden>x</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Sem restrição de splitter nesta rota.
                  </p>
                )}

                {search.trim() !== '' ? (
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-neutral-200/80 bg-white p-2">
                    {splitterSuggestions.map((splitter) => {
                      const alreadySelected = selectedIds.has(splitter.code)
                      return (
                        <button
                          key={splitter.code}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={alreadySelected}
                          onClick={() =>
                            onToggleConnectionSplitter(index, {
                              id: splitter.code,
                              label: splitter.label,
                            })
                          }
                        >
                          <span className="font-mono text-[11px] text-neutral-600">{splitter.code}</span>
                          <span className="truncate">{splitter.label}</span>
                          {alreadySelected ? (
                            <span className="ml-auto text-[10px] font-semibold text-amber-700">
                              Selecionado
                            </span>
                          ) : null}
                        </button>
                      )
                    })}

                    {splitterSuggestions.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-neutral-500">
                        Nenhum splitter encontrado para "{search}".
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    Digite ao menos 1 caractere para buscar splitters sem travar a tela.
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <details className="group rounded-xl border border-neutral-200/80 bg-neutral-50/50 text-xs text-neutral-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <summary className="cursor-pointer select-none list-none px-3 py-2.5 font-medium text-neutral-700 marker:content-none [&::-webkit-details-marker]:hidden">
          Dica: seleção múltipla
        </summary>
        <p className="border-t border-neutral-200/50 px-3 py-2.5 leading-relaxed text-neutral-600">
          Cada bloco representa uma rota. Você pode começar pelos splitters e depois fechar AP,
          slot e PON, ou fazer o caminho inverso.
        </p>
      </details>
    </div>
  )
}
