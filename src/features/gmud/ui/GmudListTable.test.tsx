import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { GmudListTable } from '@/features/gmud/ui/GmudListTable'
import type { GmudExtra, GmudListItem } from '@/features/gmud/model/gmud'

const extra = (over: Partial<GmudExtra> = {}): GmudExtra => ({
  assignmentId: 1,
  tipo: 'Programada',
  assunto: null,
  categoria: null,
  popSite: null,
  impactoParada: null,
  comunicaCliente: null,
  statusComite: 'pendente',
  statusAreas: 'nao_aplicavel',
  areasTotal: 0,
  areasAprovadas: 0,
  statusExec: null,
  rnc: null,
  dataCab: null,
  ambienteAfetado: null,
  ellevenEncerradoEm: null,
  ellevenEncerradoStatus: null,
  ...over,
})
const item = (over: Partial<GmudListItem>): GmudListItem => ({
  protocol: 1,
  assignmentId: 1,
  title: 'Troca de OLT',
  description: '',
  openedAt: '2026-11-01T12:00:00.000Z',
  slaDate: null,
  conclusionDate: null,
  status: 'Abertura',
  statusId: 1,
  requester: 'ANA PAULA SOUZA',
  requesterEmail: 'ana@sebratel.com',
  extra: null,
  massivaLinksCount: 0,
  ...over,
})

function renderTable(items: GmudListItem[], onLink = vi.fn()) {
  render(
    <MemoryRouter>
      <GmudListTable items={items} canApprove={false} onLink={onLink} onApprove={() => {}} sort={{ key: 'protocolo', dir: 'desc' }} onSort={() => {}} />
    </MemoryRouter>,
  )
  return onLink
}
const linha = (protocol: number) => screen.getByText(String(protocol)).closest('tr') as HTMLElement

describe('GmudListTable', () => {
  it('GMUD da plataforma: ícone de origem, selo com o nome do tipo e situação separada do tipo', () => {
    renderTable([item({ protocol: 101, extra: extra({ tipo: 'Pré-aprovada', statusComite: 'aprovada' }) })])
    const tr = within(linha(101))
    expect(tr.getByRole('img', { name: 'Da plataforma' })).toBeInTheDocument()
    expect(tr.queryByText('Legado')).toBeNull()
    expect(tr.getByText('Pré-aprovada')).toBeInTheDocument()
    expect(tr.getByText('Liberada')).toBeInTheDocument()
    expect(tr.getByText('Voalle: Abertura')).toBeInTheDocument()
  })

  it('legado: texto "Legado", sem ícone da plataforma, e a situação é o status do Voalle', () => {
    renderTable([item({ protocol: 202, status: 'Em andamento' })])
    const tr = within(linha(202))
    expect(tr.getByText('Legado')).toBeInTheDocument()
    expect(tr.queryByRole('img', { name: 'Da plataforma' })).toBeNull()
    expect(tr.getByText('Em andamento')).toBeInTheDocument()
    expect(tr.queryByText(/^Voalle:/)).toBeNull()
    expect(linha(202)).toHaveAttribute('data-origem', 'legado')
  })

  it('cancelada: título riscado e selo Cancelada', () => {
    renderTable([item({ protocol: 303, title: 'Manutenção no POP', status: 'Cancelado', extra: extra() })])
    const tr = within(linha(303))
    // O prazo também diz "Cancelada"; o selo da situação é o que traz a explicação.
    expect(tr.getByTitle('Cancelada: aprovações pendentes não valem mais.')).toHaveTextContent('Cancelada')
    expect(tr.getByTitle('Manutenção no POP')).toHaveClass('line-through')
  })

  it('vínculos: contagem fixa quando há massivas; "Vincular" quando não há', async () => {
    const onLink = renderTable([item({ protocol: 404, massivaLinksCount: 2 }), item({ protocol: 505 })])
    const comVinculo = within(linha(404)).getByRole('button', { name: '2 massivas vinculadas' })
    expect(comVinculo).not.toHaveClass('opacity-0')
    const semVinculo = within(linha(505)).getByRole('button', { name: 'Vincular' })
    expect(semVinculo).toHaveClass('opacity-0')
    await userEvent.click(comVinculo)
    expect(onLink).toHaveBeenCalledWith(expect.objectContaining({ protocol: 404 }))
  })
})
