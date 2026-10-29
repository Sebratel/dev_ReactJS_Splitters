import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbackDialogHost } from '@/shared/ui/FeedbackDialogHost'
import { showFeedbackDialog, useFeedbackDialogStore } from '@/shared/store/feedbackDialogStore'
import { showGmudError } from '@/features/gmud/lib/gmudFeedback'

afterEach(() => {
  act(() => useFeedbackDialogStore.setState({ queue: [] }))
})

describe('FeedbackDialogHost', () => {
  it('não renderiza nada sem mensagem', () => {
    render(<FeedbackDialogHost />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('mostra erro como alertdialog centralizado, com título e mensagem', () => {
    render(<FeedbackDialogHost />)
    act(() => showFeedbackDialog({ variant: 'error', title: 'Falhou', message: 'Detalhe do erro' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Falhou' })
    expect(dialog).toHaveTextContent('Detalhe do erro')
    // o contêiner fixo usa flex center: o popup fica no meio da tela
    expect(dialog.parentElement?.className).toMatch(/fixed/)
    expect(dialog.parentElement?.className).toMatch(/items-center/)
    expect(dialog.parentElement?.className).toMatch(/justify-center/)
  })

  it('lista os itens (ex.: campos a corrigir)', () => {
    render(<FeedbackDialogHost />)
    act(() => showFeedbackDialog({ variant: 'warning', title: 'Corrija antes de enviar', items: ['Título', 'Áreas impactadas'] }))
    expect(screen.getByText('Título')).toBeInTheDocument()
    expect(screen.getByText('Áreas impactadas')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Corrija antes de enviar' })).toBeInTheDocument()
  })

  it('fecha com o botão, com Esc e ao clicar fora', async () => {
    const user = userEvent.setup()
    render(<FeedbackDialogHost />)

    act(() => showFeedbackDialog({ variant: 'error', title: 'A' }))
    await user.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()

    act(() => showFeedbackDialog({ variant: 'error', title: 'B' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()

    act(() => showFeedbackDialog({ variant: 'error', title: 'C' }))
    const backdrop = screen.getByRole('alertdialog').previousElementSibling as HTMLElement
    await user.click(backdrop)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('foca o botão principal ao abrir', () => {
    render(<FeedbackDialogHost />)
    act(() => showFeedbackDialog({ variant: 'success', title: 'Pronto' }))
    expect(screen.getByRole('button', { name: 'Entendi' })).toHaveFocus()
  })

  it('botões de ação fecham e executam o clique', async () => {
    const user = userEvent.setup()
    const abrir = vi.fn()
    const ok = vi.fn()
    render(<FeedbackDialogHost />)
    act(() =>
      showFeedbackDialog({
        variant: 'success',
        title: 'GMUD 1 registrada',
        primary: { label: 'Concluir', onClick: ok },
        secondary: { label: 'Ver GMUD', onClick: abrir },
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Ver GMUD' }))
    expect(abrir).toHaveBeenCalledTimes(1)
    expect(ok).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('enfileira mensagens: a segunda aparece quando a primeira é fechada', async () => {
    const user = userEvent.setup()
    render(<FeedbackDialogHost />)
    act(() => {
      showFeedbackDialog({ variant: 'error', title: 'Primeira' })
      showFeedbackDialog({ variant: 'error', title: 'Segunda' })
    })
    expect(screen.getByRole('alertdialog', { name: 'Primeira' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.getByRole('alertdialog', { name: 'Segunda' })).toBeInTheDocument()
  })
})

describe('showGmudError', () => {
  it('usa a mensagem do erro e cai num texto padrão quando não há', () => {
    render(<FeedbackDialogHost />)
    act(() => showGmudError(new Error('Elleven recusou o encerramento'), 'Não foi possível encerrar a GMUD'))
    expect(screen.getByRole('alertdialog', { name: 'Não foi possível encerrar a GMUD' })).toHaveTextContent('Elleven recusou o encerramento')
    act(() => useFeedbackDialogStore.getState().close())

    act(() => showGmudError('texto solto', 'Falhou'))
    expect(screen.getByRole('alertdialog', { name: 'Falhou' })).toHaveTextContent('Tente novamente em instantes.')
  })
})
