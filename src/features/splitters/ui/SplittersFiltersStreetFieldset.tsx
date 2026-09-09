import { useMemo } from 'react'

type SplittersFiltersStreetFieldsetProps = {
  streetSelections: readonly string[]
  streetOptions: readonly string[]
  knownStreetCount: number
  totalSplitters: number
  onToggleStreetSelection: (streetLine: string) => void
}

/**
 * Filtro por rua da listagem — lógica de cópia e estados parciais isolada da barra principal.
 */
export function SplittersFiltersStreetFieldset({
  streetSelections,
  streetOptions,
  knownStreetCount,
  totalSplitters,
  onToggleStreetSelection,
}: SplittersFiltersStreetFieldsetProps) {
  const selectedStreets = useMemo(
    () => new Set(streetSelections),
    [streetSelections],
  )

  const streetPartial =
    streetSelections.length > 0 &&
    totalSplitters > 0 &&
    knownStreetCount < totalSplitters

  return (
    <fieldset className="mt-4 min-w-0">
      <legend className="text-xs font-medium text-on-surface-variant dark:text-on-surface-variant/60">
        Rua
      </legend>
      <p className="mt-1 text-xs text-on-surface-variant dark:text-on-surface-variant/60">
        Mesma regra da Home Flutter: a rua do splitter deve conter o texto selecionado. Fontes: endereço do BFF e
        cache local do reverse geocode (detalhe já aberto). Sem geocoding automático em massa na listagem (evita
        bloqueios e custo de API).
      </p>
      {totalSplitters > 0 ? (
        <p className="mt-1 text-xs text-on-surface-variant dark:text-on-surface-variant/60">
          Ruas conhecidas para {knownStreetCount} de {totalSplitters} splitters nesta lista.
        </p>
      ) : null}
      {streetPartial ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
          Modo parcial: splitters sem rua conhecida não entram no resultado quando há filtro de rua ativo.
        </p>
      ) : null}
      {streetOptions.length === 0 && totalSplitters > 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">
          Nenhuma rua disponível ainda — cadastre no BFF ou abra o detalhe de um splitter com coordenadas para
          popular o cache.
        </p>
      ) : null}
      {streetOptions.length > 0 ? (
        <ul
          className="mt-2 max-h-52 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 dark:border-white/10 p-2 dark:border-neutral-600"
          role="group"
          aria-label="Selecionar ruas"
        >
          {streetOptions.map((line) => {
            const checked = selectedStreets.has(line)
            return (
              <li key={line}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-neutral-300 text-violet-600 dark:text-violet-300 focus:ring-violet-500 dark:border-neutral-600"
                    checked={checked}
                    onChange={() => onToggleStreetSelection(line)}
                  />
                  <span className="text-on-surface dark:text-neutral-200">{line}</span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}
    </fieldset>
  )
}
