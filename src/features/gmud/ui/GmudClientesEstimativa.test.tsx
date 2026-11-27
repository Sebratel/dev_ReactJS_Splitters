import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GmudClientImpactEstimate, GmudImpactedClientsList } from '@/features/gmud/api/gmudClients'

const estimativa = vi.fn<() => { data?: GmudClientImpactEstimate; isFetching: boolean; isError: boolean }>()
const lista = vi.fn<() => { data?: GmudImpactedClientsList; isLoading: boolean; isError: boolean }>()
vi.mock('@/features/gmud/hooks/useGmudClients', () => ({
  useGmudClientImpactEstimate: () => estimativa(),
  useGmudImpactedClients: () => lista(),
}))

import { GmudClientesEstimativa } from '@/features/gmud/ui/GmudClientesEstimativa'

const escopo = { popSite: 'POP Centro', escopoRotas: [], clientesSemSplitter: [] }

describe('GmudClientesEstimativa', () => {
  beforeEach(() => {
    estimativa.mockReset()
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never
  })

  it('sem POP/Site não mostra nada', () => {
    estimativa.mockReturnValue({ isFetching: false, isError: false })
    const { container } = render(<GmudClientesEstimativa {...escopo} popSite="  " />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o total, os corporativos e a divisão', async () => {
    estimativa.mockReturnValue({ data: { applicable: true, pronto: true, total: 2116, corporativos: 24, limite: 5000 }, isFetching: false, isError: false })
    render(<GmudClientesEstimativa {...escopo} />)
    await waitFor(() => expect(screen.getByText('2.116')).toBeInTheDocument())
    expect(screen.getByText(/24 corporativos/)).toBeInTheDocument()
    expect(screen.getByText(/Residenciais · 2\.092/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('avisa quando passa do limite do envio aos afetados', async () => {
    estimativa.mockReturnValue({ data: { applicable: true, pronto: true, total: 8450, corporativos: 112, limite: 5000 }, isFetching: false, isError: false })
    render(<GmudClientesEstimativa {...escopo} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Acima de 5\.000 clientes/)
  })

  it('erro de cálculo não quebra e avisa', () => {
    estimativa.mockReturnValue({ isFetching: false, isError: true })
    render(<GmudClientesEstimativa {...escopo} />)
    expect(screen.getByText(/Não foi possível estimar agora/)).toBeInTheDocument()
  })

  describe('popup com os clientes', () => {
    const pronto = { data: { applicable: true, pronto: true, total: 3, corporativos: 1, limite: 5000 }, isFetching: false, isError: false }
    const clientes: GmudImpactedClientsList = {
      pronto: true,
      total: 3,
      truncado: false,
      clientes: [
        { contractId: 11, nome: 'Ana Souza', corporativo: false, pontoAcesso: 'CTO 01' },
        { contractId: 12, nome: 'José Lima', corporativo: false, pontoAcesso: 'CTO 02' },
        { contractId: 99, nome: 'Padaria Central', corporativo: true, pontoAcesso: 'CTO 03' },
      ],
    }

    it('o ícone abre o popup, separa residenciais e corporativos, busca e fecha', async () => {
      estimativa.mockReturnValue(pronto)
      lista.mockReturnValue({ data: clientes, isLoading: false, isError: false })
      render(<GmudClientesEstimativa {...escopo} />)
      expect(screen.queryByRole('dialog')).toBeNull()

      fireEvent.click(await screen.findByRole('button', { name: 'Ver clientes impactados' }))
      const dialog = screen.getByRole('dialog', { name: 'Clientes impactados' })
      expect(within(dialog).getByText('Ana Souza')).toBeInTheDocument()
      expect(within(dialog).queryByText('Padaria Central')).toBeNull()

      fireEvent.click(within(dialog).getByRole('tab', { name: /Corporativos · 1/ }))
      expect(within(dialog).getByText('Padaria Central')).toBeInTheDocument()
      expect(within(dialog).queryByText('Ana Souza')).toBeNull()

      fireEvent.click(within(dialog).getByRole('tab', { name: /Residenciais · 2/ }))
      fireEvent.change(within(dialog).getByLabelText('Buscar cliente'), { target: { value: 'jose' } })
      expect(within(dialog).getByText('José Lima')).toBeInTheDocument()
      expect(within(dialog).queryByText('Ana Souza')).toBeNull()
      fireEvent.change(within(dialog).getByLabelText('Buscar cliente'), { target: { value: 'zzz' } })
      expect(within(dialog).getByText(/Nenhum cliente encontrado/)).toBeInTheDocument()

      fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('mostra carregando e erro dentro do popup', async () => {
      estimativa.mockReturnValue(pronto)
      lista.mockReturnValue({ isLoading: true, isError: false })
      const { unmount } = render(<GmudClientesEstimativa {...escopo} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Ver clientes impactados' }))
      expect(screen.getByText(/Buscando os clientes/)).toBeInTheDocument()
      unmount()

      lista.mockReturnValue({ isLoading: false, isError: true })
      render(<GmudClientesEstimativa {...escopo} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Ver clientes impactados' }))
      expect(screen.getByRole('alert')).toHaveTextContent(/Não foi possível listar/)
    })

    it('sem clientes não mostra o ícone', async () => {
      estimativa.mockReturnValue({ data: { applicable: true, pronto: true, total: 0, corporativos: 0, limite: 5000 }, isFetching: false, isError: false })
      render(<GmudClientesEstimativa {...escopo} />)
      await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'Ver clientes impactados' })).toBeNull()
    })
  })
})
