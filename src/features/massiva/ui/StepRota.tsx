import { formatMassivaRoutePairsSummary } from '@/features/massiva/lib/formatMassivaRoutePairsSummary'
import type { MassivaRouteConnectionSelection } from '@/features/massiva/model/massivaLocalPreview'
import {
  formatOltSlotPonPair,
  OLT_PON_LABEL,
  OLT_SLOT_LABEL,
} from '@/shared/lib/oltTopologyLabels'
import { useMemo, useState } from 'react'

type StepRotaProps = {
  connections: MassivaRouteConnectionSelection[]
  apDisplayLabel: (code: string) => string
  apOptionsForConnection: (connection: MassivaRouteConnectionSelection) => string[]
  slotPortOptionsForConnection: (
    connection: MassivaRouteConnectionSelection,
  ) => Array<{ slot: number; port: number }>
  onAddConnection: () => void
  onRemoveConnection: (index: number) => void
  onSetConnectionAp: (index: number, apCode: string | null) => void
  slotOptionsForConnection: (connection: MassivaRouteConnectionSelection) => number[]
  portOptionsForConnection: (connection: MassivaRouteConnectionSelection) => number[]
  onApplyMultiplePairsAtRoute: (
    index: number,
    pairs: Array<{ slot: number; port: number }>,
  ) => void
  onClearRoute: () => void
  isRoutesCatalogPending: boolean
  isRoutesCatalogError: boolean
  onRefetchRoutesCatalog: () => void
}

const fieldClass =
  'w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20'

const SLOT_PORT_SECTION_TONES = [
  {
    shell: 'border-sky-200/90 dark:border-sky-800/50 bg-sky-50/40 dark:bg-sky-950/40',
    header: 'border-sky-200/80 dark:border-sky-800/50 bg-sky-100/90 dark:bg-sky-950/50',
    accent: 'border-l-sky-500',
    title: 'text-sky-950',
    action: 'text-sky-800 dark:text-sky-200 hover:bg-sky-200/50',
  },
  {
    shell: 'border-violet-200/90 dark:border-violet-800/50 bg-violet-50/35 dark:bg-violet-950/40',
    header: 'border-violet-200/80 dark:border-violet-800/50 bg-violet-100/90 dark:bg-violet-950/50',
    accent: 'border-l-violet-500',
    title: 'text-violet-950',
    action: 'text-violet-800 dark:text-violet-200 hover:bg-violet-200/50',
  },
  {
    shell: 'border-amber-200/90 dark:border-amber-800/50 bg-amber-50/35 dark:bg-amber-950/40',
    header: 'border-amber-200/80 dark:border-amber-800/50 bg-amber-100/90 dark:bg-amber-950/50',
    accent: 'border-l-amber-500',
    title: 'text-amber-950',
    action: 'text-amber-900 dark:text-amber-200 hover:bg-amber-200/50',
  },
  {
    shell: 'border-emerald-200/90 dark:border-emerald-800/50 bg-emerald-50/35 dark:bg-emerald-950/40',
    header: 'border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-100/90 dark:bg-emerald-950/50',
    accent: 'border-l-emerald-500',
    title: 'text-emerald-950',
    action: 'text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200/50',
  },
] as const

export function StepRota({
  connections,
  apDisplayLabel,
  apOptionsForConnection,
  slotPortOptionsForConnection,
  onAddConnection,
  onRemoveConnection,
  onSetConnectionAp,
  slotOptionsForConnection,
  portOptionsForConnection,
  onApplyMultiplePairsAtRoute,
  onClearRoute,
  isRoutesCatalogPending,
  isRoutesCatalogError,
  onRefetchRoutesCatalog,
}: StepRotaProps) {
  /** Props legadas da API do passo; a UI atual usa `slotPortOptionsForConnection`. */
  void slotOptionsForConnection
  void portOptionsForConnection

  const [openDropdownRouteIndex, setOpenDropdownRouteIndex] = useState<number | null>(null)
  const [selectedSlots, setSelectedSlots] = useState<Record<number, boolean>>({})
  /** PONs marcadas por slot (slot → pon → selecionada). */
  const [selectedPortsBySlot, setSelectedPortsBySlot] = useState<
    Record<number, Record<number, boolean>>
  >({})

  const openedConnection =
    openDropdownRouteIndex !== null ? connections[openDropdownRouteIndex] : undefined
  const openedRouteOptions = useMemo(
    () =>
      openedConnection
        ? slotPortOptionsForConnection(openedConnection)
        : [],
    [openedConnection, slotPortOptionsForConnection],
  )

  const slotOptions = useMemo(
    () =>
      [...new Set(openedRouteOptions.map((pair) => pair.slot))].sort((a, b) => a - b),
    [openedRouteOptions],
  )
  const portOptionsBySlot = useMemo(() => {
    const map = new Map<number, number[]>()
    for (const pair of openedRouteOptions) {
      const ports = map.get(pair.slot) ?? []
      if (!ports.includes(pair.port)) ports.push(pair.port)
      map.set(pair.slot, ports)
    }
    for (const [slot, ports] of map) {
      map.set(
        slot,
        [...ports].sort((a, b) => a - b),
      )
    }
    return map
  }, [openedRouteOptions])
  const selectedSlotValues = useMemo(
    () =>
      Object.entries(selectedSlots)
        .filter(([, checked]) => checked)
        .map(([slot]) => Number(slot))
        .sort((a, b) => a - b),
    [selectedSlots],
  )
  const selectedPairsCount = useMemo(
    () =>
      openedRouteOptions.filter(
        (pair) =>
          selectedSlots[pair.slot] === true &&
          selectedPortsBySlot[pair.slot]?.[pair.port] === true,
      ).length,
    [openedRouteOptions, selectedPortsBySlot, selectedSlots],
  )

  const closeDropdown = () => {
    setOpenDropdownRouteIndex(null)
    setSelectedSlots({})
    setSelectedPortsBySlot({})
  }

  const openDropdown = (routeIndex: number, connection: MassivaRouteConnectionSelection) => {
    const preselectedSlots: Record<number, boolean> = {}
    const preselectedPortsBySlot: Record<number, Record<number, boolean>> = {}
    const selectedPairs = connection.selectedPairs ?? []
    if (selectedPairs.length > 0) {
      for (const pair of selectedPairs) {
        preselectedSlots[pair.slot] = true
        if (preselectedPortsBySlot[pair.slot] == null) {
          preselectedPortsBySlot[pair.slot] = {}
        }
        preselectedPortsBySlot[pair.slot][pair.port] = true
      }
    } else if (connection.slot !== null && connection.porta !== null) {
      preselectedSlots[connection.slot] = true
      preselectedPortsBySlot[connection.slot] = { [connection.porta]: true }
    }
    setOpenDropdownRouteIndex(routeIndex)
    setSelectedSlots(preselectedSlots)
    setSelectedPortsBySlot(preselectedPortsBySlot)
  }

  const applyDropdownSelection = () => {
    if (openDropdownRouteIndex === null) return
    const pairs = openedRouteOptions.filter(
      (pair) =>
        selectedSlots[pair.slot] === true &&
        selectedPortsBySlot[pair.slot]?.[pair.port] === true,
    )
    if (pairs.length === 0) return
    onApplyMultiplePairsAtRoute(openDropdownRouteIndex, pairs)
    closeDropdown()
  }

  const selectAllOpenedRoutePairs = () => {
    if (openDropdownRouteIndex === null) return

    const allSlots: Record<number, boolean> = {}
    const allPortsBySlot: Record<number, Record<number, boolean>> = {}

    for (const option of openedRouteOptions) {
      allSlots[option.slot] = true
      if (allPortsBySlot[option.slot] == null) {
        allPortsBySlot[option.slot] = {}
      }
      allPortsBySlot[option.slot][option.port] = true
    }

    setSelectedSlots(allSlots)
    setSelectedPortsBySlot(allPortsBySlot)
  }

  const clearOpenedRouteSelection = () => {
    if (openDropdownRouteIndex === null) return
    setSelectedSlots({})
    setSelectedPortsBySlot({})
  }

  const toggleSlotSelection = (slot: number, checked: boolean) => {
    setSelectedSlots((current) => ({ ...current, [slot]: checked }))
    if (!checked) {
      setSelectedPortsBySlot((current) => {
        if (current[slot] == null) return current
        const next = { ...current }
        delete next[slot]
        return next
      })
    }
  }

  const togglePortForSlot = (slot: number, port: number, checked: boolean) => {
    setSelectedPortsBySlot((current) => ({
      ...current,
      [slot]: {
        ...(current[slot] ?? {}),
        [port]: checked,
      },
    }))
  }

  const allPortsSelectedForSlot = (slot: number): boolean => {
    const ports = portOptionsBySlot.get(slot) ?? []
    if (ports.length === 0) return false
    const selected = selectedPortsBySlot[slot] ?? {}
    return ports.every((port) => selected[port] === true)
  }

  const selectAllPortsForSlot = (slot: number) => {
    const ports = portOptionsBySlot.get(slot) ?? []
    setSelectedPortsBySlot((current) => ({
      ...current,
      [slot]: Object.fromEntries(ports.map((port) => [port, true])),
    }))
  }

  const clearPortsForSlot = (slot: number) => {
    setSelectedPortsBySlot((current) => {
      if (current[slot] == null) return current
      const next = { ...current }
      delete next[slot]
      return next
    })
  }

  const selectAllPortsForSelectedSlots = () => {
    const next: Record<number, Record<number, boolean>> = {}
    for (const slot of selectedSlotValues) {
      const ports = portOptionsBySlot.get(slot) ?? []
      next[slot] = Object.fromEntries(ports.map((port) => [port, true]))
    }
    setSelectedPortsBySlot(next)
  }

  const allPortsSelectedForSelectedSlots = useMemo(() => {
    if (selectedSlotValues.length === 0) return false
    return selectedSlotValues.every((slot) => {
      const ports = portOptionsBySlot.get(slot) ?? []
      if (ports.length === 0) return false
      const selected = selectedPortsBySlot[slot] ?? {}
      return ports.every((port) => selected[port] === true)
    })
  }, [selectedSlotValues, selectedPortsBySlot, portOptionsBySlot])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-on-surface">Rota</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Defina AP, slot e PON. Na seleção múltipla, escolha as PONs de cada slot separadamente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddConnection}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            Adicionar rota
          </button>
          <button
            type="button"
            onClick={onClearRoute}
            className="rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-neutral-300 hover:bg-surface-container-low"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {connections.map((connection, index) => {
          const apOptions = apOptionsForConnection(connection)
          const routeOptions = slotPortOptionsForConnection(connection)
          const selectedPairs = connection.selectedPairs ?? []
          const hasAllPairsSelected =
            routeOptions.length > 0 &&
            selectedPairs.length > 0 &&
            routeOptions.every((option) =>
              selectedPairs.some(
                (pair) => pair.slot === option.slot && pair.port === option.port,
              ),
            )
          const pairsSummary =
            selectedPairs.length > 0
              ? formatMassivaRoutePairsSummary(selectedPairs)
              : connection.slot !== null && connection.porta !== null
                ? {
                    display: formatOltSlotPonPair(connection.slot, connection.porta),
                    full: formatOltSlotPonPair(connection.slot, connection.porta),
                  }
                : null

          const apSelectDisabled =
            isRoutesCatalogPending || isRoutesCatalogError

          return (
            <section
              key={`rota-${index}`}
              className="rounded-lg bg-surface-container-lowest/80 px-4 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.05)] ring-1 ring-neutral-200/70 dark:ring-white/10"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Rota {index + 1}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {connection.apId.trim() !== ''
                      ? `${apDisplayLabel(connection.apId)} (${connection.apId})`
                      : 'Rota ainda sem AP definido'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveConnection(index)}
                  disabled={connections.length <= 1}
                  className="rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-neutral-300 hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remover
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    Ponto de acesso
                  </span>
                  <select
                    className={fieldClass}
                    value={connection.apId}
                    disabled={apSelectDisabled}
                    onChange={(event) => {
                      const value = event.target.value
                      onSetConnectionAp(index, value === '' ? null : value)
                    }}
                    aria-label={`Selecionar ponto de acesso da rota ${index + 1}`}
                    aria-busy={isRoutesCatalogPending}
                  >
                    <option value="">
                      {isRoutesCatalogPending
                        ? 'Carregando pontos de acesso...'
                        : isRoutesCatalogError
                          ? 'Erro ao carregar catálogo'
                          : 'Selecione...'}
                    </option>
                    {apOptions.map((code) => (
                      <option key={code} value={code}>
                        {apDisplayLabel(code)} ({code})
                      </option>
                    ))}
                  </select>
                  {isRoutesCatalogError ? (
                    <p className="mt-1.5 text-xs text-red-600 dark:text-red-300">
                      Não foi possível carregar o catálogo de rotas do BFF.{' '}
                      <button
                        type="button"
                        onClick={onRefetchRoutesCatalog}
                        className="font-semibold underline decoration-red-500/60 underline-offset-2 hover:text-red-800 dark:hover:text-red-200"
                      >
                        Tentar de novo
                      </button>
                    </p>
                  ) : null}
                  {!isRoutesCatalogPending && !isRoutesCatalogError && apOptions.length === 0 ? (
                    <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-200">
                      Nenhum ponto de acesso no catálogo (base vazia ou filtro do servidor).
                    </p>
                  ) : null}
                </label>

                <div className="text-sm">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    Seleção múltipla (slot e PON)
                  </span>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className={`${fieldClass} flex items-center justify-between text-left`}
                      onClick={() => openDropdown(index, connection)}
                      disabled={connection.apId.trim() === ''}
                      aria-label={`Selecionar múltiplos slots e PONs da rota ${index + 1}`}
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-left"
                        title={pairsSummary?.full ?? undefined}
                      >
                        {hasAllPairsSelected
                          ? 'Todos selecionados'
                          : pairsSummary != null
                            ? pairsSummary.display
                            : 'Selecionar pares...'}
                      </span>
                      <span className="text-xs text-on-surface-variant">Abrir</span>
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        hasAllPairsSelected
                          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
                          : 'border-neutral-200 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-800 dark:hover:text-sky-200'
                      }`}
                      disabled={connection.apId.trim() === '' || routeOptions.length === 0}
                      onClick={() =>
                        onApplyMultiplePairsAtRoute(index, hasAllPairsSelected ? [] : routeOptions)
                      }
                      aria-label={`Selecionar todos os slots e PONs da rota ${index + 1}`}
                    >
                      <span
                        aria-hidden
                        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border text-[10px] leading-none ${
                          hasAllPairsSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-current'
                        }`}
                      >
                        ✓
                      </span>
                      {hasAllPairsSelected ? 'Todos selecionados' : 'Selecionar todos'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {openDropdownRouteIndex !== null ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 px-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Selecionar múltiplos slots e PONs da rota ${openDropdownRouteIndex + 1}`}
        >
          <div className="w-full max-w-2xl rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest p-4 shadow-xl">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Rota {openDropdownRouteIndex + 1}
              </p>
              <h4 className="mt-1 text-base font-semibold text-on-surface">
                Dropdown multi-seleção
              </h4>
              <p className="mt-1 text-sm text-on-surface-variant">
                Marque os slots desejados e, em seguida, escolha as PONs de cada slot.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllOpenedRoutePairs}
                  className="rounded-lg border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1.5 text-xs font-semibold text-sky-900 dark:text-sky-200 transition hover:border-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/50"
                >
                  Selecionar tudo
                </button>
                <button
                  type="button"
                  onClick={clearOpenedRouteSelection}
                  className="rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-neutral-300 hover:bg-surface-container-low"
                >
                  Limpar seleção
                </button>
              </div>
            </div>

            <div className="grid min-h-[18rem] gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
              <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-low/60">
                <div className="border-b border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Slots</p>
                </div>
                <div className="max-h-80 flex-1 space-y-0.5 overflow-y-auto p-2">
                  {slotOptions.length > 0 ? (
                    slotOptions.map((slot) => {
                      const checked = selectedSlots[slot] === true
                      return (
                        <label
                          key={slot}
                          className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition ${
                            checked
                              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-950 ring-1 ring-sky-200/80'
                              : 'bg-surface-container-lowest hover:bg-surface-container-low'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => toggleSlotSelection(slot, event.target.checked)}
                          />
                          <span>Slot <strong>{slot}</strong></span>
                        </label>
                      )
                    })
                  ) : (
                    <p className="px-2 py-3 text-sm text-on-surface-variant">Nenhum slot disponível.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-low/60">
                <div className="flex items-center justify-between gap-2 border-b border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    PONs por slot
                  </p>
                  {selectedSlotValues.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (allPortsSelectedForSelectedSlots) {
                          setSelectedPortsBySlot({})
                        } else {
                          selectAllPortsForSelectedSlots()
                        }
                      }}
                      className="shrink-0 rounded-md border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 px-2 py-1 text-[11px] font-semibold text-sky-900 dark:text-sky-200 transition hover:border-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/50"
                    >
                      {allPortsSelectedForSelectedSlots
                        ? 'Limpar PONs'
                        : 'Selecionar todas as PONs'}
                    </button>
                  ) : null}
                </div>
                <div className="max-h-80 flex-1 overflow-y-auto p-3">
                  {selectedSlotValues.length > 0 ? (
                    <div className="space-y-3">
                      {selectedSlotValues.map((slot, slotIndex) => {
                        const ports = portOptionsBySlot.get(slot) ?? []
                        const selectedPortsForSlot = selectedPortsBySlot[slot] ?? {}
                        const slotPortsAllSelected = allPortsSelectedForSlot(slot)
                        const tone = SLOT_PORT_SECTION_TONES[slotIndex % SLOT_PORT_SECTION_TONES.length]
                        return (
                          <section
                            key={slot}
                            aria-label={`PONs do ${OLT_SLOT_LABEL.toLowerCase()} ${slot}`}
                            className={`overflow-hidden rounded-lg border border-l-4 shadow-sm ${tone.shell} ${tone.accent}`}
                          >
                            <div
                              className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${tone.header}`}
                            >
                              <p className={`text-xs font-bold uppercase tracking-wide ${tone.title}`}>
                                Slot <span className="tabular-nums">{slot}</span>
                              </p>
                              {ports.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    slotPortsAllSelected
                                      ? clearPortsForSlot(slot)
                                      : selectAllPortsForSlot(slot)
                                  }
                                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${tone.action}`}
                                >
                                  {slotPortsAllSelected ? 'Limpar' : 'Selecionar todas'}
                                </button>
                              ) : null}
                            </div>
                            {ports.length > 0 ? (
                              <div className="grid grid-cols-2 gap-1.5 bg-surface-container-lowest/70 p-2.5 sm:grid-cols-3">
                                {ports.map((port) => (
                                  <label
                                    key={`${slot}-${port}`}
                                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition ${
                                      selectedPortsForSlot[port] === true
                                        ? 'border-sky-300 bg-sky-50 dark:bg-sky-950/40 text-sky-950 shadow-sm'
                                        : 'border-neutral-200/70 dark:border-white/10 bg-surface-container-lowest hover:border-neutral-300 hover:bg-surface-container-low'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedPortsForSlot[port] === true}
                                      onChange={(event) =>
                                        togglePortForSlot(slot, port, event.target.checked)
                                      }
                                    />
                                    <span className="tabular-nums">{OLT_PON_LABEL} {port}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <p className="bg-surface-container-lowest/70 px-3 py-2 text-xs text-on-surface-variant">
                                Sem PONs neste slot.
                              </p>
                            )}
                          </section>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[10rem] flex-col items-center justify-center px-4 text-center">
                      <p className="text-sm font-medium text-on-surface-variant">Nenhum slot selecionado</p>
                      <p className="mt-1 max-w-xs text-xs text-on-surface-variant">
                        Marque um ou mais slots à esquerda para escolher as PONs de cada um.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-on-surface-variant">
              {selectedPairsCount > 0
                ? `${selectedPairsCount} combinação(ões) válida(s) selecionada(s).`
                : selectedSlotValues.length > 0
                  ? 'Marque ao menos uma PON em cada slot selecionado.'
                  : 'Selecione os slots para habilitar a escolha de PONs.'}
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDropdown}
                className="rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-neutral-300 hover:bg-surface-container-low"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyDropdownSelection}
                disabled={selectedPairsCount === 0}
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aplicar seleção
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}


