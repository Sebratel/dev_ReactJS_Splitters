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

  it('acende o caminho do nó central até o cartão sob o mouse e apaga ao sair', async () => {
    render(<GmudCategoriaPicker onEscolher={() => {}} />)
    expect(screen.queryByTestId('caminho-haste')).toBeNull()
    await userEvent.hover(screen.getByRole('button', { name: 'Sistemas externos' }))
    for (const trecho of ['caminho-haste', 'caminho-barra', 'caminho-descida', 'caminho-porta']) {
      expect(screen.getByTestId(trecho)).toHaveAttribute('data-categoria', 'sistemas_externos')
      expect(screen.getByTestId(trecho)).toHaveAttribute('data-aceso', 'true')
    }
    await userEvent.unhover(screen.getByRole('button', { name: 'Sistemas externos' }))
    for (const trecho of ['caminho-haste', 'caminho-barra', 'caminho-descida', 'caminho-porta']) {
      expect(screen.getByTestId(trecho)).toHaveAttribute('data-aceso', 'false')
    }
  })

  it('o caminho até o cartão do meio não tem trecho horizontal', async () => {
    render(<GmudCategoriaPicker onEscolher={() => {}} />)
    await userEvent.hover(screen.getByRole('button', { name: 'Sistemas internos' }))
    expect(screen.getByTestId('caminho-haste')).toHaveAttribute('data-aceso', 'true')
    expect(screen.getByTestId('caminho-descida')).toHaveAttribute('data-categoria', 'sistemas_internos')
    expect(screen.queryByTestId('caminho-barra')).toBeNull()
  })

  it('acende o caminho pelo foco do teclado e troca de cartão ao avançar', async () => {
    render(<GmudCategoriaPicker onEscolher={() => {}} />)
    await userEvent.tab()
    expect(screen.getByTestId('caminho-descida')).toHaveAttribute('data-categoria', 'rede_externa')
    expect(screen.getByTestId('caminho-barra')).toHaveAttribute('data-aceso', 'true')
    await userEvent.tab()
    expect(screen.getAllByTestId('caminho-descida')).toHaveLength(1)
    expect(screen.getByTestId('caminho-descida')).toHaveAttribute('data-categoria', 'sistemas_internos')
    expect(screen.queryByTestId('caminho-barra')).toBeNull()
  })
})
