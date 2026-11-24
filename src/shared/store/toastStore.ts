import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export type Toast = {
  id: string
  message: string
  tone: ToastTone
}

type ToastStore = {
  toasts: Toast[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push(message, tone = 'success') {
    const id = `${Date.now()}-${Math.random()}`
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))
