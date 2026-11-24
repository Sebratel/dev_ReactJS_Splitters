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

  it('sem rascunho não mostra aviso, selo nem botão de descartar', () => {
    render(<GmudCategoriaPicker onEscolher={() => {}} />)
    expect(screen.queryByTestId('aviso-rascunho')).toBeNull()
    expect(screen.queryByText(/Rascunho aqui/)).toBeNull()
    expect(screen.queryByText('Continuar de onde parou')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  describe('com rascunho em andamento', () => {
    const rascunho = { categoria: 'sistemas_internos' as const, salvoEm: '2026-11-13T15:30:00.000Z', etapaLabel: 'Impacto e execução' }

    it('mostra o aviso com a categoria, a etapa e a data, e marca só o cartão do rascunho', () => {
      render(<GmudCategoriaPicker onEscolher={() => {}} rascunho={rascunho} onDescartarRascunho={() => {}} />)
      const aviso = screen.getByTestId('aviso-rascunho')
      expect(aviso).toHaveTextContent('Você tem um rascunho em andamento')
      expect(aviso).toHaveTextContent('Categoria: Sistemas internos')
      expect(aviso).toHaveTextContent('Parou em: Impacto e execução')
      expect(aviso).toHaveTextContent(new Date(rascunho.salvoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))

      const doRascunho = screen.getByRole('button', { name: 'Sistemas internos' })
      expect(doRascunho).toHaveAccessibleDescription(/Rascunho aqui · continuar/)
      expect(doRascunho).toHaveTextContent('Continuar de onde parou')
      expect(screen.getAllByText(/Rascunho aqui/)).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Rede externa' })).not.toHaveTextContent('Continuar de onde parou')
      expect(screen.getByRole('button', { name: 'Rede externa' })).toHaveTextContent('Escolher')
    })

    it('escolher o cartão do rascunho chama onEscolher com a categoria dele', async () => {
      const onEscolher = vi.fn()
      render(<GmudCategoriaPicker onEscolher={onEscolher} rascunho={rascunho} onDescartarRascunho={() => {}} />)
      await userEvent.click(screen.getByRole('button', { name: 'Sistemas internos' }))
      expect(onEscolher).toHaveBeenCalledWith('sistemas_internos')
    })

    it('só descarta depois da confirmação; Cancelar não descarta', async () => {
      const onDescartar = vi.fn()
      render(<GmudCategoriaPicker onEscolher={() => {}} rascunho={rascunho} onDescartarRascunho={onDescartar} />)

      await userEvent.click(screen.getByRole('button', { name: 'Descartar rascunho' }))
      expect(onDescartar).not.toHaveBeenCalled()
      expect(screen.getByText('Apagar tudo?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(onDescartar).not.toHaveBeenCalled()
      expect(screen.queryByText('Apagar tudo?')).toBeNull()
      expect(screen.getByRole('button', { name: 'Descartar rascunho' })).toHaveFocus()

      await userEvent.click(screen.getByRole('button', { name: 'Descartar rascunho' }))
      await userEvent.click(screen.getByRole('button', { name: 'Sim, apagar' }))
      expect(onDescartar).toHaveBeenCalledTimes(1)
    })
  })
})
