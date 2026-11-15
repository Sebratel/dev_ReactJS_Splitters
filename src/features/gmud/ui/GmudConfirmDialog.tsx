import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CircleHelp } from 'lucide-react'
import type { GmudConfirmOptions, GmudConfirmResult } from '@/features/gmud/lib/gmudConfirm'
import { cn } from '@/shared/lib/utils'

const FOCAVEIS = 'button:not([disabled]), textarea:not([disabled])'

/**
 * Pop-up de confirmação do módulo de GMUD, no meio da tela (no lugar do confirm/prompt do navegador).
 * Mesmo padrão do GmudAvisoModal: portal no body, foco preso dentro do diálogo, Esc fecha (desistindo) e o
 * foco volta para onde estava. Clicar no fundo também desiste — nunca confirma.
 * Foco inicial: no campo de texto, se houver; senão no botão seguro (desistir) quando a ação é destrutiva.
 * Normalmente é aberto por `gmudConfirm()` (lib/gmudConfirm.ts), que devolve uma Promise.
 */
export function GmudConfirmDialog({ options, onResolve }: { options: GmudConfirmOptions; onResolve: (result: GmudConfirmResult) => void }) {
  const { titulo, mensagem, confirmar, cancelar = 'Voltar', tom = 'neutro', campoTexto } = options
  const tituloId = useId()
  const descricaoId = useId()
  const campoId = useId()
  const [texto, setTexto] = useState('')
  const caixaRef = useRef<HTMLDivElement>(null)
  const campoRef = useRef<HTMLTextAreaElement>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const confirmarRef = useRef<HTMLButtonElement>(null)
  const destrutivo = tom === 'destrutivo'
  const paragrafos = (Array.isArray(mensagem) ? mensagem : mensagem ? [mensagem] : []).filter((p) => p.trim() !== '')

  const desistir = () => onResolve({ confirmado: false, texto: '' })

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const alvo = campoRef.current ?? (destrutivo ? cancelarRef.current : confirmarRef.current)
    alvo?.focus()
    return () => anterior?.focus()
    // Só ao abrir: o foco inicial não deve mudar depois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Na captura, para o Esc fechar só este diálogo e não um modal que esteja aberto por baixo.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onResolve({ confirmado: false, texto: '' })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onResolve])

  const Icone = destrutivo ? AlertTriangle : CircleHelp
  return createPortal(
    <div className="gmud-fade fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={desistir} aria-hidden />
      <div
        ref={caixaRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={paragrafos.length > 0 ? descricaoId : undefined}
        onKeyDown={(e) => {
          // Foco preso: o Tab circula só entre o campo e os botões do diálogo.
          if (e.key !== 'Tab') return
          const itens = Array.from(caixaRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
          if (itens.length === 0) return
          const atual = itens.indexOf(document.activeElement as HTMLElement)
          const proximo = e.shiftKey ? (atual <= 0 ? itens.length - 1 : atual - 1) : atual === itens.length - 1 ? 0 : atual + 1
          e.preventDefault()
          itens[proximo]?.focus()
        }}
        className="gmud-enter relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200/80 bg-surface-container-lowest p-5 shadow-2xl dark:border-white/15 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              destrutivo ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200' : 'bg-primary text-neutral-900',
            )}
          >
            <Icone size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={tituloId} className="text-base font-bold text-on-surface">
              {titulo}
            </h2>
            {paragrafos.length > 0 ? (
              <div id={descricaoId} className="mt-2 space-y-2 break-words text-sm text-on-surface">
                {paragrafos.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {campoTexto ? (
          <div className="mt-4">
            <label htmlFor={campoId} className="block text-xs font-semibold text-on-surface-variant">
              {campoTexto.rotulo}
            </label>
            <textarea
              ref={campoRef}
              id={campoId}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              placeholder={campoTexto.placeholder}
              aria-describedby={campoTexto.ajuda ? `${campoId}-ajuda` : undefined}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/20 dark:border-white/20 dark:focus:border-white dark:focus:ring-white/20"
            />
            {campoTexto.ajuda ? (
              <p id={`${campoId}-ajuda`} className="mt-1 text-xs text-on-surface-variant">
                {campoTexto.ajuda}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelarRef}
            type="button"
            onClick={desistir}
            className="min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:ring-white/20 dark:focus-visible:ring-white"
          >
            {cancelar}
          </button>
          <button
            ref={confirmarRef}
            type="button"
            onClick={() => onResolve({ confirmado: true, texto })}
            className={cn(
              'min-h-10 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest',
              destrutivo
                ? 'bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700 dark:focus-visible:ring-red-300'
                : 'bg-primary text-neutral-900 hover:bg-primary/90 focus-visible:ring-neutral-900/60 dark:focus-visible:ring-white',
            )}
          >
            {confirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
