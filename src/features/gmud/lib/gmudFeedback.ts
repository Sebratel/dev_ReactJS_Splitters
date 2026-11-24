import { showFeedbackDialog } from '@/shared/store/feedbackDialogStore'

/** Erro de uma ação do módulo GMUD, em popup no centro da tela. */
export function showGmudError(error: unknown, title: string, fallback = 'Tente novamente em instantes.'): void {
  showFeedbackDialog({
    variant: 'error',
    title,
    message: error instanceof Error && error.message.trim() !== '' ? error.message : fallback,
  })
}
