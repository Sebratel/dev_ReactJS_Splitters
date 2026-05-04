import type { MassivaRouteConnectionSelection } from '@/features/massiva/model/massivaLocalPreview'
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
  'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20'

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
  const [selectedPorts, setSelectedPorts] = useState<Record<number, boolean>>({})

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
  const portOptions = useMemo(
    () =>
      [...new Set(openedRouteOptions.map((pair) => pair.port))].sort((a, b) => a - b),
    [openedRouteOptions],
  )
  const selectedSlotValues = useMemo(
    () =>
      Object.entries(selectedSlots)
        .filter(([, checked]) => checked)
        .map(([slot]) => Number(slot)),
    [selectedSlots],
  )
  const selectedPortValues = useMemo(
    () =>
      Object.entries(selectedPorts)
        .filter(([, checked]) => checked)
        .map(([port]) => Number(port)),
    [selectedPorts],
  )
  const compatiblePortsBySelectedSlots = useMemo(() => {
    if (selectedSlotValues.length === 0) return new Set<number>(portOptions)
    return new Set(
      openedRouteOptions
        .filter((pair) => selectedSlotValues.includes(pair.slot))
        .map((pair) => pair.port),
    )
  }, [openedRouteOptions, portOptions, selectedSlotValues])
  const compatibleSlotsBySelectedPorts = useMemo(() => {
    if (selectedPortValues.length === 0) return new Set<number>(slotOptions)
    return new Set(
      openedRouteOptions
        .filter((pair) => selectedPortValues.includes(pair.port))
        .map((pair) => pair.slot),
    )
  }, [openedRouteOptions, selectedPortValues, slotOptions])
  const selectedPairsCount = useMemo(
    () =>
      openedRouteOptions.filter(
        (pair) => selectedSlots[pair.slot] === true && selectedPorts[pair.port] === true,
      ).length,
    [openedRouteOptions, selectedPorts, selectedSlots],
  )

  const closeDropdown = () => {
    setOpenDropdownRouteIndex(null)
    setSelectedSlots({})
    setSelectedPorts({})
  }

  const openDropdown = (routeIndex: number, connection: MassivaRouteConnectionSelection) => {
    const preselectedSlots: Record<number, boolean> = {}
    const preselectedPorts: Record<number, boolean> = {}
    const selectedPairs = connection.selectedPairs ?? []
    if (selectedPairs.length > 0) {
      for (const pair of selectedPairs) {
        preselectedSlots[pair.slot] = true
        preselectedPorts[pair.port] = true
      }
    } else if (connection.slot !== null && connection.porta !== null) {
      preselectedSlots[connection.slot] = true
      preselectedPorts[connection.porta] = true
    }
    setOpenDropdownRouteIndex(routeIndex)
    setSelectedSlots(preselectedSlots)
    setSelectedPorts(preselectedPorts)
  }

  const applyDropdownSelection = () => {
    if (openDropdownRouteIndex === null) return
    const pairs = openedRouteOptions.filter(
      (pair) => selectedSlots[pair.slot] === true && selectedPorts[pair.port] === true,
    )
    if (pairs.length === 0) return
    onApplyMultiplePairsAtRoute(openDropdownRouteIndex, pairs)
    closeDropdown()
  }

  const selectAllOpenedRoutePairs = () => {
    if (openDropdownRouteIndex === null) return

    const allSlots: Record<number, boolean> = {}
    const allPorts: Record<number, boolean> = {}

    for (const option of openedRouteOptions) {
      allSlots[option.slot] = true
      allPorts[option.port] = true
    }

    setSelectedSlots(allSlots)
    setSelectedPorts(allPorts)
  }

  const clearOpenedRouteSelection = () => {
    if (openDropdownRouteIndex === null) return
    setSelectedSlots({})
    setSelectedPorts({})
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">Rota</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Defina AP, slot e porta. A seleção múltipla aplica todas as combinações válidas do AP.
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
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
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

          const apSelectDisabled =
            isRoutesCatalogPending || isRoutesCatalogError

          return (
            <section
              key={`rota-${index}`}
              className="rounded-lg bg-white/80 px-4 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.05)] ring-1 ring-neutral-200/70"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                    Rota {index + 1}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    {connection.apId.trim() !== ''
                      ? `${apDisplayLabel(connection.apId)} (${connection.apId})`
                      : 'Rota ainda sem AP definido'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveConnection(index)}
                  disabled={connections.length <= 1}
                  className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remover
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
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
                    <p className="mt-1.5 text-xs text-red-600">
                      Não foi possível carregar o catálogo de rotas do BFF.{' '}
                      <button
                        type="button"
                        onClick={onRefetchRoutesCatalog}
                        className="font-semibold underline decoration-red-500/60 underline-offset-2 hover:text-red-800"
                      >
                        Tentar de novo
                      </button>
                    </p>
                  ) : null}
                  {!isRoutesCatalogPending && !isRoutesCatalogError && apOptions.length === 0 ? (
                    <p className="mt-1.5 text-xs text-amber-800">
                      Nenhum ponto de acesso no catálogo (base vazia ou filtro do servidor).
                    </p>
                  ) : null}
                </label>

                <div className="text-sm">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Seleção múltipla (slot e porta)
                  </span>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className={`${fieldClass} flex items-center justify-between text-left`}
                      onClick={() => openDropdown(index, connection)}
                      disabled={connection.apId.trim() === ''}
                      aria-label={`Selecionar múltiplos slots e portas da rota ${index + 1}`}
                    >
                      <span className="truncate">
                        {hasAllPairsSelected
                          ? 'Todos selecionados'
                          : connection.slot !== null && connection.porta !== null
                          ? `Atual: slot ${connection.slot} / porta ${connection.porta}`
                          : 'Selecionar pares...'}
                      </span>
                      <span className="text-xs text-neutral-500">Abrir</span>
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        hasAllPairsSelected
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800'
                      }`}
                      disabled={connection.apId.trim() === '' || routeOptions.length === 0}
                      onClick={() => onApplyMultiplePairsAtRoute(index, routeOptions)}
                      aria-label={`Selecionar todos os slots e portas da rota ${index + 1}`}
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
          aria-label={`Selecionar múltiplos slots e portas da rota ${openDropdownRouteIndex + 1}`}
        >
          <div className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                Rota {openDropdownRouteIndex + 1}
              </p>
              <h4 className="mt-1 text-base font-semibold text-neutral-900">
                Dropdown multi-seleção
              </h4>
              <p className="mt-1 text-sm text-neutral-600">
                Selecione múltiplos slots e portas para encontrar combinações válidas do AP.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllOpenedRoutePairs}
                  className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-900 transition hover:border-sky-300 hover:bg-sky-100"
                >
                  Selecionar tudo
                </button>
                <button
                  type="button"
                  onClick={clearOpenedRouteSelection}
                  className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Limpar seleção
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/50 p-2">
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Slots</p>
                {slotOptions.length > 0 ? (
                  slotOptions.map((slot) => {
                    const checked = selectedSlots[slot] === true
                    const disabled = !compatibleSlotsBySelectedPorts.has(slot)
                    return (
                      <label
                        key={slot}
                        className={`flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-sm transition ${
                          disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-sky-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) =>
                            setSelectedSlots((current) => ({
                              ...current,
                              [slot]: event.target.checked,
                            }))
                          }
                        />
                        <span>Slot <strong>{slot}</strong></span>
                      </label>
                    )
                  })
                ) : (
                  <p className="px-2 py-3 text-sm text-neutral-500">Nenhum slot disponível.</p>
                )}
              </div>

              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/50 p-2">
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Portas</p>
                {portOptions.length > 0 ? (
                  portOptions.map((port) => {
                    const checked = selectedPorts[port] === true
                    const disabled = !compatiblePortsBySelectedSlots.has(port)
                    return (
                      <label
                        key={port}
                        className={`flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-sm transition ${
                          disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-sky-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) =>
                            setSelectedPorts((current) => ({
                              ...current,
                              [port]: event.target.checked,
                            }))
                          }
                        />
                        <span>Porta <strong>{port}</strong></span>
                      </label>
                    )
                  })
                ) : (
                  <p className="px-2 py-3 text-sm text-neutral-500">Nenhuma porta disponível.</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-600">
              {selectedPairsCount > 0
                ? `${selectedPairsCount} combinação(ões) válida(s) selecionada(s).`
                : 'Selecione slots e portas compatíveis para habilitar o avanço.'}
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDropdown}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
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


