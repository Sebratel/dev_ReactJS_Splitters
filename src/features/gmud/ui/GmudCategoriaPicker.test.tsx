import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmudCategoriaPicker } from '@/features/gmud/ui/GmudCategoriaPicker'

describe('GmudCategoriaPicker', () => {
  it('mostra as três categorias como botões', () => {
    render(<GmudCategoriaPicker onEscolher={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
    for (const nome of ['Rede externa', 'Sistemas internos', 'Sistemas externos']) {
      expect(screen.getByRole('button', { name: nome })).toHaveAttribute('type', 'button')
    }
  })

  it('chama onEscolher com a categoria do cartão clicado', async () => {
    const onEscolher = vi.fn()
    render(<GmudCategoriaPicker onEscolher={onEscolher} />)
    await userEvent.click(screen.getByRole('button', { name: 'Sistemas externos' }))
    expect(onEscolher).toHaveBeenCalledWith('sistemas_externos')
    await userEvent.click(screen.getByRole('button', { name: 'Rede externa' }))
    expect(onEscolher).toHaveBeenLastCalledWith('rede_externa')
    await userEvent.click(screen.getByRole('button', { name: 'Sistemas internos' }))
    expect(onEscolher).toHaveBeenLastCalledWith('sistemas_internos')
    expect(onEscolher).toHaveBeenCalledTimes(3)
  })

  it('escolhe pelo teclado', async () => {
    const onEscolher = vi.fn()
    render(<GmudCategoriaPicker onEscolher={onEscolher} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Rede externa' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onEscolher).toHaveBeenCalledWith('rede_externa')
  })

  it('descreve cada botão com a prévia do formulário, sem depender de hover', () => {
    render(<GmudCategoriaPicker onEscolher={() => {}} />)
    const rede = screen.getByRole('button', { name: 'Rede externa' })
    expect(rede).toHaveAccessibleDescription(/Infraestrutura, OLTs, backbone, sites/)
    expect(rede).toHaveAccessibleDescription(/Atividade.*Ambiente afetado.*Impacto.*Execução/)
    expect(rede).toHaveAccessibleDescription(/Aprovadores e janela e Revisão/)
    expect(screen.getByRole('button', { name: 'Sistemas externos' })).toHaveAccessibleDescription(
      /Sistema e fornecedor.*Mudança prevista.*Impacto.*Contingência/,
    )
  })
})
