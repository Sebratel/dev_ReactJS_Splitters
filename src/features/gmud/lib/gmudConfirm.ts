import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { GmudConfirmDialog } from '@/features/gmud/ui/GmudConfirmDialog'

/**
 * Confirmação do módulo de GMUD em um pop-up da própria plataforma, no lugar de window.confirm/prompt.
 * `gmudConfirm()` abre o diálogo e devolve uma Promise — dá para usar com `await` nos mesmos pontos em que
 * antes havia o diálogo do navegador (inclusive dentro de mutationFn), sem provider na árvore.
 */

export type GmudConfirmOptions = {
  /** A pergunta, curta. Ex.: "Cancelar esta GMUD?". */
  titulo: string
  /** O que vai acontecer. Um texto ou vários parágrafos. */
  mensagem?: string | string[]
  /** Rótulo do botão que confirma, com o verbo da ação. Ex.: "Cancelar GMUD", "Remover". */
  confirmar: string
  /** Rótulo do botão que desiste. Padrão: "Voltar". */
  cancelar?: string
  /** `destrutivo` (vermelho, foco no botão de desistir) ou `neutro`. Padrão: neutro. */
  tom?: 'destrutivo' | 'neutro'
  /** Campo de texto opcional (ex.: relato que vai junto no protocolo). */
  campoTexto?: { rotulo: string; ajuda?: string; placeholder?: string }
}

/** `texto` é o que foi digitado no campo (vazio se não houver campo ou se a pessoa desistiu). */
export type GmudConfirmResult = { confirmado: boolean; texto: string }

/**
 * Abre o pop-up de confirmação e resolve quando a pessoa decide. Desistir (botão, Esc ou clique no fundo)
 * resolve com `confirmado: false` — nunca rejeita.
 */
export function gmudConfirm(options: GmudConfirmOptions): Promise<GmudConfirmResult> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    container.setAttribute('data-gmud-confirm', '')
    document.body.appendChild(container)
    const root = createRoot(container)
    let resolvido = false
    const onResolve = (result: GmudConfirmResult) => {
      if (resolvido) return
      resolvido = true
      root.unmount()
      container.remove()
      resolve(result)
    }
    root.render(createElement(GmudConfirmDialog, { options, onResolve }))
  })
}
