import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type DropdownOption = { value: string; label: string; group?: string }

/**
 * Seleção múltipla compacta: uma linha com o que já foi escolhido (etiquetas removíveis) e uma lista que abre
 * sobre a tela, agrupada. Mantém o formulário curto mesmo com muitas opções.
 */
export function GmudDropdownMultiSelect({
  options,
  selected,
  onToggle,
  placeholder = 'Selecionar…',
  ariaLabel,
}: {
  options: DropdownOption[]
  selected: string[]
  onToggle: (value: string) => void
  placeholder?: string
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const groups: Array<{ title: string; items: DropdownOption[] }> = []
  for (const o of options) {
    const title = o.group ?? ''
    let g = groups.find((x) => x.title === title)
    if (!g) {
      g = { title, items: [] }
      groups.push(g)
    }
    g.items.push(o)
  }

  return (
    <div ref={rootRef} className="relative mt-1">
      <div
        className={cn(
          'flex min-h-10 items-center gap-1.5 rounded-lg border bg-surface-container-lowest px-2 py-1.5 transition',
          open ? 'border-primary ring-2 ring-primary/30' : 'border-neutral-200 dark:border-white/10',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selected.map((v) => (
            <span
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/20 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-on-surface ring-1 ring-primary/60"
            >
              <span className="truncate">{v}</span>
              <button
                type="button"
                onClick={() => onToggle(v)}
                className="inline-flex size-4 items-center justify-center rounded-full hover:bg-primary/30"
                aria-label={`Remover ${v}`}
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={ariaLabel}
            className="min-h-6 flex-1 px-1 text-left text-sm text-on-surface-variant/80"
          >
            {selected.length === 0 ? placeholder : 'Adicionar…'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
          aria-hidden
          className="shrink-0 text-on-surface-variant"
        >
          <ChevronDown size={16} className={cn('transition', open ? 'rotate-180' : '')} />
        </button>
      </div>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-neutral-200/90 bg-surface-container-lowest p-2 shadow-lg dark:border-white/10"
        >
          {groups.map((g) => (
            <div key={g.title} className="mb-1 last:mb-0">
              {g.title !== '' ? (
                <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{g.title}</p>
              ) : null}
              {g.items.map((o) => {
                const ativo = selected.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    onClick={() => onToggle(o.value)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-surface-container-low',
                      ativo ? 'font-semibold text-on-surface' : 'text-on-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-md border',
                        ativo ? 'border-primary bg-primary text-neutral-900' : 'border-neutral-300 dark:border-white/25',
                      )}
                      aria-hidden
                    >
                      {ativo ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                    {o.label}
                  </button>
                )
              })}
            </div>
          ))}
          <div className="sticky bottom-0 mt-1 flex justify-end border-t border-neutral-200/70 bg-surface-container-lowest pt-1.5 dark:border-white/10">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
