import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchAuthenticationSites } from '@/features/massiva/api/searchAuthenticationSites'

/**
 * Campo de POP/Site com typeahead: sugere sites já cadastrados na plataforma (ERP, via gateway),
 * mas permite texto livre (caso o site não esteja na lista). Reaproveita a busca de sites da massiva.
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
  const [debounced, setDebounced] = useState(value)
  const boxRef = useRef<HTMLDivElement>(null)

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

  const { data } = useQuery({
    queryKey: ['gmud', 'sites', debounced],
    queryFn: ({ signal }) => searchAuthenticationSites(debounced, signal),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 60_000,
  })
  const sites = data ?? []

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Digite o POP/Site (ex.: NHOPN)"
        autoComplete="off"
      />
      {open && sites.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest shadow-lg">
          {sites.map((s) => (
            <li key={`${s.id ?? s.title}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition hover:bg-surface-container-low"
                onClick={() => {
                  onChange(s.title)
                  setOpen(false)
                }}
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
