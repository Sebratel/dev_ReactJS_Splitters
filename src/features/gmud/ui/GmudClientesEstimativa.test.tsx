import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GmudClientImpactEstimate } from '@/features/gmud/api/gmudClients'

const estimativa = vi.fn<() => { data?: GmudClientImpactEstimate; isFetching: boolean; isError: boolean }>()
vi.mock('@/features/gmud/hooks/useGmudClients', () => ({
  useGmudClientImpactEstimate: () => estimativa(),
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
})
