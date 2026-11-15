import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmudAvisoModal } from '@/features/gmud/ui/GmudAvisoModal'

const itens = ['Tipo da GMUD', 'Título']

describe('GmudAvisoModal', () => {
  it('abre como diálogo modal com título e a lista do que falta', () => {
    render(<GmudAvisoModal titulo="Falta preencher para continuar" itens={itens} onClose={() => {}} />)
    const dialogo = screen.getByRole('alertdialog', { name: 'Falta preencher para continuar' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Tipo da GMUD')).toBeInTheDocument()
    expect(screen.getByText('Título')).toBeInTheDocument()
  })

  it('leva o foco para o botão ao abrir', () => {
    render(<GmudAvisoModal titulo="Aviso" itens={itens} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Entendi' })).toHaveFocus()
  })

  it('fecha com o botão e com Esc', async () => {
    const onClose = vi.fn()
    render(<GmudAvisoModal titulo="Aviso" itens={itens} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('o Tab não tira o foco do aviso', async () => {
    render(<GmudAvisoModal titulo="Aviso" itens={itens} onClose={() => {}} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Entendi' })).toHaveFocus()
  })

  it('devolve o foco ao elemento que estava focado quando fecha', () => {
    const botao = document.createElement('button')
    document.body.appendChild(botao)
    botao.focus()
    const { unmount } = render(<GmudAvisoModal titulo="Aviso" itens={itens} onClose={() => {}} />)
    expect(botao).not.toHaveFocus()
    unmount()
    expect(botao).toHaveFocus()
    botao.remove()
  })
})
