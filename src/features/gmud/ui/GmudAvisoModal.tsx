import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { useEscapeKey } from '@/features/gmud/hooks/useEscapeKey'

/**
 * Aviso no meio da tela (pop-up) para o que falta preencher: não passa despercebido como um bloco no rodapé.
 * Foco vai para o botão ao abrir e volta ao elemento anterior ao fechar; Esc e clique fora fecham.
 */
export function GmudAvisoModal({
  titulo,
  itens,
  onClose,
}: {
  titulo: string
  itens: string[]
  onClose: () => void
}) {
  const tituloId = useId()
  const listaId = useId()
  const botaoRef = useRef<HTMLButtonElement>(null)
  useEscapeKey(onClose)

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    botaoRef.current?.focus()
    return () => anterior?.focus()
  }, [])

  // No body, para o aviso cobrir a tela mesmo que um ancestral tenha transform/animação (que prende o `fixed`).
  return createPortal(
    <div className="gmud-fade fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={listaId}
        onKeyDown={(e) => {
          // Só há um botão no aviso: o foco fica nele enquanto estiver aberto.
          if (e.key === 'Tab') {
            e.preventDefault()
            botaoRef.current?.focus()
          }
        }}
        className="gmud-enter relative w-full max-w-md rounded-2xl border border-neutral-200/80 bg-surface-container-lowest p-6 shadow-2xl dark:border-white/15"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-neutral-900" aria-hidden>
            <AlertTriangle size={22} />
          </span>
          <div className="min-w-0">
            <h2 id={tituloId} className="text-base font-bold text-on-surface">
              {titulo}
            </h2>
            <ul id={listaId} className="mt-2 list-inside list-disc space-y-1 text-sm text-on-surface">
              {itens.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            ref={botaoRef}
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/60 focus-visible:ring-offset-2"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
