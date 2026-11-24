import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGmudPopSites, type GmudPopSite } from '@/features/gmud/api/gmudPopSites'
import { filterPopSites } from '@/features/gmud/lib/gmudPopSites'
import { searchAuthenticationSites } from '@/features/massiva/api/searchAuthenticationSites'

/**
 * Campo de POP/Site: ao clicar já mostra TODOS os sites ativos (sem precisar digitar), e filtra conforme a
 * pessoa escreve. Permite texto livre (caso o site não esteja na lista); nesse caso, se a lista local não
 * tiver nada parecido, ainda consulta o ERP pelo gateway como reserva.
 */
export function GmudPopSiteField({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // Só filtra depois que a pessoa digita. Ao clicar num campo já preenchido, mostra a lista inteira para trocar.
  const [digitou, setDigitou] = useState(false)
  const [ativo, setAtivo] = useState(-1)
  const [debounced, setDebounced] = useState(value)
  const boxRef = useRef<HTMLDivElement>(null)
  const listaId = useId()

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), 300)
    return () => window.clearTimeout(t)
  }, [value])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const todos = useQuery({
    queryKey: ['gmud', 'pop-sites'],
    queryFn: ({ signal }) => fetchGmudPopSites(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const filtrados = useMemo(
    () => filterPopSites(todos.data ?? [], digitou ? value : ''),
    [todos.data, digitou, value],
  )

  // Reserva: site fora da lista local (ou lista indisponível) -> busca no ERP pelo gateway.
  const termo = debounced.trim()
  const precisaReserva = open && digitou && termo.length >= 2 && filtrados.length === 0
  const reserva = useQuery({
    queryKey: ['gmud', 'sites', termo],
    queryFn: ({ signal }) => searchAuthenticationSites(termo, signal),
    enabled: precisaReserva,
    staleTime: 60_000,
  })

  const sites: GmudPopSite[] = filtrados.length > 0 ? filtrados : precisaReserva ? (reserva.data ?? []) : []
  const mostrarLista = open && sites.length > 0

  const escolher = (s: GmudPopSite) => {
    onChange(s.title)
    setDigitou(false)
    setOpen(false)
    setAtivo(-1)
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={className}
        value={value}
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={listaId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value)
          setDigitou(true)
          setAtivo(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setAtivo((i) => Math.min(sites.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAtivo((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter' && mostrarLista && ativo >= 0 && sites[ativo]) {
            e.preventDefault()
            escolher(sites[ativo])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder="Clique para escolher ou digite o POP/Site (ex.: NHOPN)"
        autoComplete="off"
      />
      {mostrarLista ? (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest shadow-lg"
        >
          {sites.map((s, i) => (
            <li key={`${s.id ?? s.title}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={s.title === value}
                tabIndex={-1}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-surface-container-low ${
                  i === ativo ? 'bg-surface-container-low' : ''
                }`}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => escolher(s)}
              >
                <span className="font-mono font-semibold text-on-surface">{s.title}</span>
                {s.city ? <span className="truncate text-[11px] text-on-surface-variant">{s.city}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
