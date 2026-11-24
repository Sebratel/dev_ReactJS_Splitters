import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listar = vi.fn()
const buscar = vi.fn()
vi.mock('@/features/gmud/api/gmudPopSites', () => ({ fetchGmudPopSites: (...a: unknown[]) => listar(...a) }))
vi.mock('@/features/massiva/api/searchAuthenticationSites', () => ({ searchAuthenticationSites: (...a: unknown[]) => buscar(...a) }))

import { GmudPopSiteField } from '@/features/gmud/ui/GmudPopSiteField'

const SITES = [
  { id: 1, title: 'CANNT', city: 'Canoas', neighborhood: null },
  { id: 2, title: 'NHOPN', city: 'Novo Hamburgo', neighborhood: null },
  { id: 3, title: 'SLEOP', city: 'São Leopoldo', neighborhood: null },
]

function Campo({ inicial = '' }: { inicial?: string }) {
  const [v, setV] = useState(inicial)
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <GmudPopSiteField value={v} onChange={setV} />
    </QueryClientProvider>
  )
}

describe('GmudPopSiteField', () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue(SITES)
    buscar.mockReset().mockResolvedValue([])
  })

  it('ao clicar, mostra todos os sites sem precisar digitar', async () => {
    const user = userEvent.setup()
    render(<Campo />)
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findAllByRole('option')).toHaveLength(3)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('filtra conforme digita e escolhe pelo clique', async () => {
    const user = userEvent.setup()
    render(<Campo />)
    await user.click(screen.getByRole('combobox'))
    await screen.findAllByRole('option')
    await user.type(screen.getByRole('combobox'), 'canoas')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await user.click(screen.getByRole('option', { name: /CANNT/ }))
    expect(screen.getByRole('combobox')).toHaveValue('CANNT')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('campo já preenchido: ao clicar mostra a lista inteira para trocar', async () => {
    const user = userEvent.setup()
    render(<Campo inicial="CANNT" />)
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findAllByRole('option')).toHaveLength(3)
  })

  it('teclado: seta para baixo e Enter escolhem; Esc fecha', async () => {
    const user = userEvent.setup()
    render(<Campo />)
    await user.click(screen.getByRole('combobox'))
    await screen.findAllByRole('option')
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(screen.getByRole('combobox')).toHaveValue('NHOPN')
    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('site fora da lista: texto livre consulta o ERP como reserva', async () => {
    buscar.mockResolvedValue([{ id: 9, title: 'ZZNEW', city: null, neighborhood: null }])
    const user = userEvent.setup()
    render(<Campo />)
    await user.click(screen.getByRole('combobox'))
    await screen.findAllByRole('option')
    await user.type(screen.getByRole('combobox'), 'zznew')
    expect(await screen.findByRole('option', { name: /ZZNEW/ })).toBeInTheDocument()
    expect(buscar).toHaveBeenCalled()
  })
})
