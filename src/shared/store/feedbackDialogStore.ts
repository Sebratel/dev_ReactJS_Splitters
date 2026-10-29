import { create } from 'zustand'

export type FeedbackVariant = 'success' | 'error' | 'warning' | 'info'

export type FeedbackAction = {
  label: string
  onClick?: () => void
}

export type FeedbackDialogInput = {
  variant: FeedbackVariant
  title: string
  message?: string
  /** Lista de pontos (ex.: campos a corrigir), exibida abaixo da mensagem. */
  items?: readonly string[]
  /** Botão principal; por padrão "Entendi". */
  primary?: FeedbackAction
  /** Botão secundário opcional (ex.: "Ver GMUD"). */
  secondary?: FeedbackAction
}

export type FeedbackDialog = FeedbackDialogInput & { id: string }

type FeedbackDialogStore = {
  /** Fila: o primeiro é o exibido; os demais aparecem quando ele for fechado. */
  queue: FeedbackDialog[]
  show: (input: FeedbackDialogInput) => void
  close: () => void
}

export const useFeedbackDialogStore = create<FeedbackDialogStore>((set) => ({
  queue: [],
  show(input) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set((s) => ({ queue: [...s.queue, { ...input, id }] }))
  },
  close() {
    set((s) => ({ queue: s.queue.slice(1) }))
  },
}))

/** Atalho fora de componentes (callbacks de mutação, etc.). */
export function showFeedbackDialog(input: FeedbackDialogInput): void {
  useFeedbackDialogStore.getState().show(input)
}
