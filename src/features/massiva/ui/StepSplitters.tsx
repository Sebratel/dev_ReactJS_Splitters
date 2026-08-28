import { useState } from 'react'
import type {
  MassivaRouteConnectionSelection,
  MassivaSelectedSplitter,
} from '@/features/massiva/model/massivaLocalPreview'
import { formatOltTopologySegment } from '@/shared/lib/oltTopologyLabels'

type StepSplittersProps = {
  connections: MassivaRouteConnectionSelection[]
  onToggleConnectionSplitter: (index: number, splitter: MassivaSelectedSplitter) => void
  searchSplitterOptionsForConnection: (
    connection: MassivaRouteConnectionSelection,
    search: string,
    limit?: number,
  ) => Array<{ code: string; label: string }>
}

const searchClass =
  'w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface shadow-sm transition placeholder:text-on-surface-variant/60 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20'

export function StepSplitters({
  connections,
  onToggleConnectionSplitter,
  searchSplitterOptionsForConnection,
}: StepSplittersProps) {
  const [searchByRoute, setSearchByRoute] = useState<Record<number, string>>({})

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-on-surface">Splitters</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Busque e selecione splitters por rota. Sem filtro manual, a rota usa todos os splitters
          daquele AP/slot/PON.
        </p>
      </div>

      <div className="space-y-4">
        {connections.map((connection, index) => {
          const search = searchByRoute[index] ?? ''
          const selectedIds = new Set(connection.splitters.map((splitter) => splitter.id))
          const routeReady =
            connection.apId.trim() !== '' &&
            connection.slot !== null &&
            connection.porta !== null
          const suggestions =
            routeReady && search.trim() !== ''
              ? searchSplitterOptionsForConnection(connection, search, 30)
              : []

          return (
            <section
              key={`splitter-route-${index}`}
              className="space-y-3 rounded-lg bg-surface-container-lowest/80 px-4 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.05)] ring-1 ring-neutral-200/70 dark:ring-white/10"
            >
              <div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Rota {index + 1}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {routeReady
                      ? `${connection.apLabel.trim() || connection.apId} / ${formatOltTopologySegment(connection.slot ?? 0, connection.porta ?? 0)}`
                      : 'Complete a rota para restringir melhor os splitters'}
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Buscar splitter
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => {
                    const value = event.target.value
                    setSearchByRoute((current) => ({ ...current, [index]: value }))
                  }}
                  placeholder="Buscar por código ou nome..."
                  className={searchClass}
                  aria-label={`Buscar splitter da rota ${index + 1}`}
                />
              </label>

              {connection.splitters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {connection.splitters.map((splitter) => (
                    <button
                      key={splitter.id}
                      type="button"
                      onClick={() => onToggleConnectionSplitter(index, splitter)}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 text-xs font-medium text-sky-950 dark:text-sky-100 ring-1 ring-sky-200 dark:ring-sky-800/50"
                      title="Remover splitter"
                    >
                      <span className="font-mono">{splitter.id}</span>
                      <span className="max-w-56 truncate">{splitter.label}</span>
                      <span aria-hidden>x</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 ring-1 ring-amber-100"
                  role="note"
                  aria-live="polite"
                >
                  <p className="font-semibold">Nenhum splitter selecionado manualmente.</p>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-200">
                    Todos os splitters da rota serao considerados automaticamente.
                  </p>
                </div>
              )}

              {search.trim() !== '' ? (
                <div className="overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-neutral-200/80 dark:ring-white/10">
                  {suggestions.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-on-surface-variant">
                      Nenhum splitter encontrado para "{search}".
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-200/80 dark:divide-white/10">
                      {suggestions.map((splitter) => {
                        const selected = selectedIds.has(splitter.code)
                        return (
                          <li key={splitter.code}>
                            <button
                              type="button"
                              onClick={() =>
                                onToggleConnectionSplitter(index, {
                                  id: splitter.code,
                                  label: splitter.label,
                                })
                              }
                              disabled={selected}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="font-mono text-xs text-on-surface-variant">
                                {splitter.code}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-on-surface">
                                {splitter.label}
                              </span>
                              <span className="text-[11px] font-semibold text-on-surface-variant">
                                {selected ? 'Selecionado' : 'Adicionar'}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
