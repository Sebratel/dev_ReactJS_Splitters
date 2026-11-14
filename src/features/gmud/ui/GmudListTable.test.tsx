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

  it('cancelada: título em cinza SEM risco, selo Cancelada e prazo "—"', () => {
    renderTable([item({ protocol: 303, title: 'Manutenção no POP', status: 'Cancelado', slaDate: '2026-11-20T12:00:00.000Z', extra: extra() })])
    const tr = within(linha(303))
    // O selo da situação diz "Cancelada"; a coluna Prazo não repete.
    expect(tr.getAllByText('Cancelada')).toHaveLength(1)
    expect(tr.getByTitle('Cancelada: aprovações pendentes não valem mais.')).toHaveTextContent('Cancelada')
    expect(tr.getByText('Sem prazo a acompanhar')).toBeInTheDocument()
    const titulo = tr.getByTitle('Manutenção no POP')
    expect(titulo).not.toHaveClass('line-through')
    expect(titulo).toHaveClass('text-on-surface-variant')
    expect(linha(303)).toHaveAttribute('data-cancelada', 'true')
  })

  it('encerrada também mostra "—" no prazo; aberta continua com o selo do prazo', () => {
    renderTable([
      item({ protocol: 606, conclusionDate: '2026-11-02T12:00:00.000Z', status: 'Encerrado' }),
      item({ protocol: 707, slaDate: '2020-01-01T12:00:00.000Z' }),
    ])
    expect(within(linha(606)).getByText('Sem prazo a acompanhar')).toBeInTheDocument()
    expect(within(linha(606)).queryByText('Encerrada')).toBeNull()
    expect(within(linha(707)).getByText(/Vencida há/)).toBeInTheDocument()
    expect(linha(707)).not.toHaveAttribute('data-cancelada')
  })

  it('a tabela não tem rolagem própria e as colunas secundárias somem em tela estreita', () => {
    const { container } = render(
      <MemoryRouter>
        <GmudListTable items={[item({ protocol: 808 })]} canApprove={false} onLink={() => {}} onApprove={() => {}} sort={{ key: 'protocolo', dir: 'desc' }} onSort={() => {}} />
      </MemoryRouter>,
    )
    const envoltorio = container.querySelector('table')?.parentElement as HTMLElement
    expect(envoltorio.className).not.toMatch(/overflow|max-h/)
    const cabecalhos = screen.getAllByRole('columnheader')
    expect(cabecalhos.every((th) => th.className.includes('sticky'))).toBe(true)
    expect(screen.getByRole('columnheader', { name: /Solicitante/ })).toHaveClass('hidden', 'md:table-cell')
    expect(screen.getByRole('columnheader', { name: /Abertura/ })).toHaveClass('hidden', 'md:table-cell')
    expect(screen.getByRole('columnheader', { name: /Prazo/ })).not.toHaveClass('hidden')
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
