import { useMemo, useState } from 'react'
import { Filter, Network, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useSplittersFiltersStore } from '@/features/splitters/store/useSplittersFiltersStore'
import { useAccessPointsForFilters } from '@/features/splitters/hooks/useAccessPointsForFilters'
import { usePrimarySplittersForFilters } from '@/features/splitters/hooks/usePrimarySplittersForFilters'
import { useSplittersFilterOptions } from '@/features/splitters/hooks/useSplittersFilterOptions'
import {
  SPLITTER_STATUS_LABEL,
  SPLITTER_STATUS_ORDER,
} from '@/features/splitters/model/splitterStatus'

type SplittersFiltersDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/70">
      {children}
    </h3>
  )
}

export function SplittersFiltersDrawer({
  open,
  onOpenChange,
}: SplittersFiltersDrawerProps) {
  const {
    state,
    toggleOltCode,
    togglePrimarySplitterTitle,
    toggleSplitterStatus,
    toggleCitySelection,
    toggleCondominiumSelection,
    toggleStreetSelection,
    setMassivaOpenState,
    setSignalLevelFilter,
    setCorporateClientFilter,
    setMaintenanceWindowDays,
    setMaintenanceFilter,
    clearAll,
    setOltSlot,
    setOltPort,
  } = useSplittersFiltersStore()

  const { data: accessPoints } = useAccessPointsForFilters()
  const { data: primarySplitters } = usePrimarySplittersForFilters()
  const filterOptionsQuery = useSplittersFilterOptions()

  const [oltQuery, setOltQuery] = useState('')
  const [primaryQuery, setPrimaryQuery] = useState('')
  const [statusQuery, setStatusQuery] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [streetSearch, setStreetSearch] = useState('')
  const [condominiumSearch, setCondominiumSearch] = useState('')

  const sortedOlts = useMemo(() => {
    if (!accessPoints?.length) return []
    return [...accessPoints].sort((a, b) =>
      (a.title || a.code).localeCompare(b.title || b.code, 'pt-BR'),
    )
  }, [accessPoints])

  const sortedPrimary = useMemo(() => {
    if (!primarySplitters?.length) return []
    return [...primarySplitters].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [primarySplitters])

  const filteredOlts = useMemo(() => {
    const q = oltQuery.trim().toLowerCase()
    if (q === '') return sortedOlts
    return sortedOlts.filter((olt) =>
      `${olt.title || ''} ${olt.code}`.toLowerCase().includes(q),
    )
  }, [oltQuery, sortedOlts])

  const filteredPrimary = useMemo(() => {
    const q = primaryQuery.trim().toLowerCase()
    if (q === '') return sortedPrimary
    return sortedPrimary.filter((t) => t.toLowerCase().includes(q))
  }, [primaryQuery, sortedPrimary])

  const filteredStatuses = useMemo(() => {
    const q = statusQuery.trim().toLowerCase()
    if (q === '') return SPLITTER_STATUS_ORDER
    return SPLITTER_STATUS_ORDER.filter((s) =>
      SPLITTER_STATUS_LABEL[s].toLowerCase().includes(q),
    )
  }, [statusQuery])

  const filteredCities = useMemo(() => {
    const options = filterOptionsQuery.data?.cities ?? []
    const q = citySearch.trim().toLowerCase()
    if (q === '') return options
    return options.filter((c) => c.toLowerCase().includes(q))
  }, [citySearch, filterOptionsQuery.data?.cities])

  const filteredStreets = useMemo(() => {
    const options = filterOptionsQuery.data?.streets ?? []
    const q = streetSearch.trim().toLowerCase()
    if (q === '') return options
    return options.filter((s) => s.toLowerCase().includes(q))
  }, [streetSearch, filterOptionsQuery.data?.streets])

  const filteredCondominiums = useMemo(() => {
    const options = filterOptionsQuery.data?.condominiums ?? []
    const q = condominiumSearch.trim().toLowerCase()
    if (q === '') return options
    return options.filter((n) => n.toLowerCase().includes(q))
  }, [condominiumSearch, filterOptionsQuery.data?.condominiums])

  const selectedOlts = useMemo(() => new Set(state.oltCodes), [state.oltCodes])
  const selectedPrimary = useMemo(
    () => new Set(state.primarySplitterTitles),
    [state.primarySplitterTitles],
  )
  const selectedStatuses = useMemo(
    () => new Set(state.splitterStatuses),
    [state.splitterStatuses],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="splitters-filters-drawer-title"
    >
      <button
        type="button"
        aria-label="Fechar filtros"
        className="absolute inset-0 bg-surface/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-outline-variant bg-surface-container-lowest shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant/40 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Filter size={20} />
            </div>
            <div>
              <h2
                id="splitters-filters-drawer-title"
                className="text-lg font-black tracking-tight text-on-surface"
              >
                Filtros
              </h2>
              <p className="mt-0.5 text-sm text-on-surface-variant/75">
                Refine a listagem. A busca por texto fica no topo da página; aqui
                estão os filtros estruturados. Tudo aplica na hora.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <SectionTitle>Ponto de acesso</SectionTitle>
              <input
                type="search"
                value={oltQuery}
                onChange={(e) => setOltQuery(e.target.value)}
                placeholder="Buscar ponto de acesso…"
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
              />
              <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-outline-variant/50 bg-surface p-2">
                {filteredOlts.map((olt) => {
                  const checked = selectedOlts.has(olt.code)
                  return (
                    <li key={olt.code}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low',
                          checked && 'bg-primary/8',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOltCode(olt.code)}
                        />
                        <span className="min-w-0 truncate text-sm">
                          {olt.title || olt.code}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-on-surface-variant/50">
                          {olt.code}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-2 border-t border-outline-variant/40 pt-6">
              <SectionTitle>{'Slot e PON (OLT)'}</SectionTitle>
              <p className="text-[11px] leading-snug text-on-surface-variant/75">
                Mesma leitura do nome do splitter: dois últimos grupos numéricos antes da
                primeira «/». Deixe em branco o que não quiser usar.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant/80">
                    Slot
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={
                      typeof state.oltSlot === 'number' ? state.oltSlot : ''
                    }
                    onChange={(e) => {
                      const t = e.target.value.trim()
                      if (t === '') {
                        setOltSlot(null)
                        return
                      }
                      const n = Number.parseInt(t, 10)
                      setOltSlot(Number.isFinite(n) ? n : null)
                    }}
                    className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm tabular-nums focus:border-primary/40 focus:outline-none"
                    placeholder="Qualquer"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant/80">
                    PON
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={
                      typeof state.oltPort === 'number' ? state.oltPort : ''
                    }
                    onChange={(e) => {
                      const t = e.target.value.trim()
                      if (t === '') {
                        setOltPort(null)
                        return
                      }
                      const n = Number.parseInt(t, 10)
                      setOltPort(Number.isFinite(n) ? n : null)
                    }}
                    className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm tabular-nums focus:border-primary/40 focus:outline-none"
                    placeholder="Qualquer"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>Splitter primário</SectionTitle>
              <div className="relative">
                <Network
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/45"
                />
                <input
                  type="search"
                  value={primaryQuery}
                  onChange={(e) => setPrimaryQuery(e.target.value)}
                  placeholder="Buscar primário…"
                  className="w-full rounded-xl border border-outline-variant bg-surface py-2.5 pl-10 pr-3 text-sm focus:border-primary/40 focus:outline-none"
                />
              </div>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-outline-variant/50 bg-surface p-2">
                {filteredPrimary.map((title) => {
                  const checked = selectedPrimary.has(title)
                  return (
                    <li key={title}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low',
                          checked && 'bg-primary/8',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePrimarySplitterTitle(title)}
                        />
                        <span className="text-sm">{title}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <SectionTitle>Status de ocupação</SectionTitle>
              <input
                type="search"
                value={statusQuery}
                onChange={(e) => setStatusQuery(e.target.value)}
                placeholder="Buscar status…"
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
              />
              <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-outline-variant/50 bg-surface p-2">
                {filteredStatuses.map((status) => {
                  const checked = selectedStatuses.has(status)
                  return (
                    <li key={status}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low',
                          checked && 'bg-primary/8',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSplitterStatus(status)}
                        />
                        <span className="text-sm">
                          {SPLITTER_STATUS_LABEL[status]}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <SectionTitle>Cidade</SectionTitle>
              <input
                type="search"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Buscar cidade…"
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
              />
              <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-outline-variant/50 bg-surface p-2">
                {filteredCities.map((city) => {
                  const checked = state.citySelections.includes(city)
                  return (
                    <li key={city}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low',
                          checked && 'bg-primary/8',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCitySelection(city)}
                        />
                        <span className="text-sm">{city}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <SectionTitle>Condomínio</SectionTitle>
              <input
                type="search"
                value={condominiumSearch}
                onChange={(e) => setCondominiumSearch(e.target.value)}
                placeholder="Buscar condomínio…"
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
              />
              <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-outline-variant/50 bg-surface p-2">
                {filteredCondominiums.map((name) => {
                  const checked = state.condominiumSelections.includes(name)
                  return (
                    <li key={name}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low',
                          checked && 'bg-primary/8',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCondominiumSelection(name)}
                        />
                        <span className="text-sm">{name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <SectionTitle>Rua</SectionTitle>
              <input
                type="search"
                value={streetSearch}
                onChange={(e) => setStreetSearch(e.target.value)}
                placeholder="Buscar rua…"
                className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
              />
              <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-xl border border-outline-variant/50 bg-surface p-2">
                {filteredStreets.map((street) => {
                  const checked = state.streetSelections.includes(street)
                  return (
                    <li key={street}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-container-low',
                          checked && 'bg-primary/8',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStreetSelection(street)}
                        />
                        <span className="text-sm">{street}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <SectionTitle>Manutenção</SectionTitle>
              <div className="rounded-xl border border-outline-variant/50 bg-surface p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-on-surface-variant/75">
                    Janela
                  </span>
                  <select
                    value={state.maintenanceWindowDays}
                    onChange={(e) =>
                      setMaintenanceWindowDays(Number(e.target.value) as 7 | 30 | 90)
                    }
                    className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1 text-xs font-semibold text-on-surface"
                  >
                    <option value={7}>7 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                </div>
                <div className="space-y-1">
                  {(
                    [
                      { id: 'all' as const, label: 'Todos os splitters' },
                      { id: 'with-maintenance' as const, label: 'Somente com manutenção' },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-container-low"
                    >
                      <input
                        type="radio"
                        name="maintenance-filter"
                        checked={state.maintenanceFilter === opt.id}
                        onChange={() => setMaintenanceFilter(opt.id)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>Massiva aberta</SectionTitle>
              <div className="space-y-1 rounded-xl border border-outline-variant/50 bg-surface p-3">
                {(
                  [
                    { id: 'all' as const, label: 'Todos' },
                    { id: 'with-open' as const, label: 'Com massiva aberta' },
                    { id: 'without-open' as const, label: 'Sem massiva aberta' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-container-low"
                  >
                    <input
                      type="radio"
                      name="massiva-open"
                      checked={state.massivaOpenState === opt.id}
                      onChange={() => setMassivaOpenState(opt.id)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>Nível de sinal (ONU)</SectionTitle>
              <div className="space-y-1 rounded-xl border border-outline-variant/50 bg-surface p-3">
                {(
                  [
                    { id: 'all' as const, label: 'Todos' },
                    { id: 'critico' as const, label: 'Crítico' },
                    { id: 'atenuado' as const, label: 'Atenuado' },
                    { id: 'offline' as const, label: 'Offline (sem leitura)' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-container-low"
                  >
                    <input
                      type="radio"
                      name="signal-level"
                      checked={state.signalLevelFilter === opt.id}
                      onChange={() => setSignalLevelFilter(opt.id)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>Cliente corporativo</SectionTitle>
              <div className="space-y-1 rounded-xl border border-outline-variant/50 bg-surface p-3">
                {(
                  [
                    { id: 'all' as const, label: 'Todos' },
                    {
                      id: 'with-corporate' as const,
                      label: 'Com cliente corporativo',
                    },
                    {
                      id: 'without-corporate' as const,
                      label: 'Sem cliente corporativo',
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-container-low"
                  >
                    <input
                      type="radio"
                      name="corporate-client"
                      checked={state.corporateClientFilter === opt.id}
                      onChange={() => setCorporateClientFilter(opt.id)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline-variant/40 bg-surface-container-lowest px-5 py-4">
          <button
            type="button"
            onClick={() => clearAll()}
            className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
          >
            Aplicar
          </button>
        </div>
      </aside>
    </div>
  )
}
