import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest dark:focus-visible:ring-red-300'

/**
 * Botão de apagar o rascunho da GMUD, com confirmação em dois passos na própria tela (sem window.confirm):
 * o primeiro clique troca o botão por "Apagar tudo?" com "Sim, apagar" e "Cancelar".
 */
export function GmudDiscardDraftButton({ rotulo, onConfirmar, compact = false }: { rotulo: string; onConfirmar: () => void; /** Menor, para caber em uma linha (topo da Revisão). */ compact?: boolean }) {
  const tamanho = compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  const icone = compact ? 13 : 15
  const [confirmando, setConfirmando] = useState(false)
  const abrirRef = useRef<HTMLButtonElement>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const jaMontou = useRef(false)

  // O foco acompanha a troca: vai para "Cancelar" (a opção segura) e volta ao botão ao desistir.
  useEffect(() => {
    if (!jaMontou.current) {
      jaMontou.current = true
      return
    }
    if (confirmando) cancelarRef.current?.focus()
    else abrirRef.current?.focus()
  }, [confirmando])

  return (
    <span aria-live="polite" className="inline-flex flex-wrap items-center gap-2">
      {confirmando ? (
        <span role="group" aria-label="Confirmar apagar o rascunho" className="inline-flex flex-wrap items-center gap-2">
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-red-700 dark:text-red-300`}>Apagar tudo?</span>
          <button
            type="button"
            onClick={() => {
              setConfirmando(false)
              onConfirmar()
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border border-red-700 bg-red-700 ${tamanho} font-bold text-white transition-colors hover:bg-red-800 ${FOCO}`}
          >
            <Trash2 size={icone} aria-hidden /> Sim, apagar
          </button>
          <button
            ref={cancelarRef}
            type="button"
            onClick={() => setConfirmando(false)}
            className={`rounded-lg border border-neutral-300 bg-surface-container-lowest ${tamanho} font-semibold text-on-surface transition-colors hover:bg-surface-container-low dark:border-white/15 ${FOCO}`}
          >
            Cancelar
          </button>
        </span>
      ) : (
        <button
          ref={abrirRef}
          type="button"
          onClick={() => setConfirmando(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-surface-container-lowest ${tamanho} font-bold text-red-700 transition-colors hover:border-red-700 hover:bg-red-50 dark:border-red-400/40 dark:text-red-300 dark:hover:border-red-300 dark:hover:bg-red-500/10 ${FOCO}`}
        >
          <Trash2 size={icone} aria-hidden /> {rotulo}
        </button>
      )}
    </span>
  )
}
