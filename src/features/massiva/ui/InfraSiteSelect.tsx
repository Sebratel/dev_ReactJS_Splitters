import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchAuthenticationSites } from '@/features/massiva/api/searchAuthenticationSites'

type InfraSiteSelectProps = {
  /** Código do site atualmente selecionado (authenticationSiteCode). */
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}

/**
 * Seletor buscável de Site (typeahead) para a abertura de protocolo de Backbone.
 * Consulta o gateway em tempo real (`/api/v1/sites/search`) — sempre atualizado, sem lista fixa.
 * Envia o `title` do site como código (authenticationSiteCode), que nos sites de POP/DC é o
 * mesmo valor do "Código" do Elleven.
 */
export function InfraSiteSelect({ value, onChange, disabled }: InfraSiteSelectProps) {
  const [input, setInput] = useState(value)
  const [debounced, setDebounced] = useState(value)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim()), 300)
    return () => clearTimeout(timer)
  }, [input])

  const query = useQuery({
    queryKey: ['massiva', 'auth-sites', debounced],
    queryFn: ({ signal }) => searchAuthenticationSites(debounced, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
  })

  const results = query.data ?? []

  return (
    <div>
      <label
        htmlFor="infra-site"
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
      >
        Site (obrigatório)
      </label>
      <div className="relative">
        <input
          id="infra-site"
          type="text"
          value={input}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value
            setInput(next)
            setOpen(true)
            if (next.trim() === '') onChange('')
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          disabled={disabled}
          placeholder="Digite o código/nome do site (ex.: NHOPN)"
          className="w-full rounded-lg border border-neutral-200/80 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:cursor-not-allowed"
        />
        {open && debounced.length >= 2 ? (
          <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg">
            {query.isPending ? (
              <li className="px-3 py-1.5 text-neutral-500">Buscando…</li>
            ) : query.isError ? (
              <li className="px-3 py-1.5 text-red-600">Falha ao buscar sites.</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-1.5 text-neutral-500">Nenhum site encontrado.</li>
            ) : (
              results.map((site) => (
                <li key={`${site.id ?? site.title}`}>
                  <button
                    type="button"
                    // onMouseDown evita o blur do input antes do clique registrar.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(site.title)
                      setInput(site.title)
                      setOpen(false)
                    }}
                    className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-amber-50"
                  >
                    <span className="font-mono font-semibold text-neutral-900">{site.title}</span>
                    {site.city ? (
                      <span className="truncate text-[11px] text-neutral-500">{site.city}</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {value.trim() !== '' ? (
        <p className="mt-1 text-[10px] text-neutral-600">
          Site selecionado: <span className="font-mono font-semibold">{value}</span>
        </p>
      ) : (
        <p className="mt-1 text-[10px] font-medium text-amber-700">
          Selecione um site para abrir o protocolo de backbone.
        </p>
      )}
    </div>
  )
}
