import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmudFiltroConstrutor } from '@/features/gmud/ui/GmudFiltroConstrutor'
import { GmudCanceladasRodape, GmudPainelAbas } from '@/features/gmud/ui/GmudPainelLista'
import { GmudSummaryStrip } from '@/features/gmud/ui/GmudSummaryStrip'
import { FILTROS_PADRAO, type GmudPainelFiltros } from '@/features/gmud/lib/gmudPainelFiltros'

const com = (over: Partial<GmudPainelFiltros>): GmudPainelFiltros => ({ ...FILTROS_PADRAO, ...over })
const SOLICITANTES = ['ANA PAULA SOUZA', 'BRUNO DA SILVA', 'CARLA MENDES']

/** Faz o papel da tela: guarda os filtros e mostra o estado para o teste conferir. */
function Painel({ inicial = FILTROS_PADRAO, onAbrirSolicitantes }: { inicial?: GmudPainelFiltros; onAbrirSolicitantes?: () => void }) {
  const [filtros, setFiltros] = useState(inicial)
  return (
    <>
      <GmudFiltroConstrutor filtros={filtros} onChange={setFiltros} solicitantes={SOLICITANTES} onAbrirSolicitantes={onAbrirSolicitantes} />
      <output data-testid="estado">{JSON.stringify(filtros)}</output>
      <button type="button">fora</button>
    </>
  )
}
const estado = (): GmudPainelFiltros => JSON.parse(screen.getByTestId('estado').textContent ?? '{}') as GmudPainelFiltros
const botaoFiltro = () => screen.getByRole('button', { name: 'Filtro' })
const abrirCampo = async (campo: string) => {
  await userEvent.click(botaoFiltro())
  await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${campo}`) }))
}

describe('GmudFiltroConstrutor: menu', () => {
  it('"+ Filtro" abre o menu com os cinco campos e fecha de novo', async () => {
    render(<Painel inicial={com({ origem: [] })} />)
    expect(botaoFiltro()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
    await userEvent.click(botaoFiltro())
    expect(botaoFiltro()).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: 'Adicionar filtro' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Situação', 'Abertura', 'Tipo', 'Origem', 'Solicitante'])
    expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus()
    await userEvent.click(botaoFiltro())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Situação e Tipo aceitam vários valores, com caixas de seleção', async () => {
    render(<Painel />)
    await abrirCampo('Situação')
    const menu = screen.getByRole('menu', { name: 'Opções de Situação' })
    expect(within(menu).getAllByRole('menuitemcheckbox').map((i) => i.textContent)).toEqual([
      'Aguardando aprovação', 'Liberada', 'Concluída', 'Encerrada', 'Negada', 'Cancelada',
    ])
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Negada' }))
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Liberada' }))
    expect(estado().situacao).toEqual(['liberada', 'negada']) // na ordem das opções
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Liberada' })).toHaveAttribute('aria-checked', 'true')
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Concluída' })).toHaveAttribute('aria-checked', 'false')
    // O menu continua aberto para marcar mais; desmarcar tira o valor.
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Negada' }))
    expect(estado().situacao).toEqual(['liberada'])
  })

  it('Abertura é seleção única: escolher outro troca; escolher o mesmo desfaz', async () => {
    render(<Painel />)
    await abrirCampo('Abertura')
    const opcao = (nome: string) => screen.getByRole('menuitemradio', { name: nome })
    await userEvent.click(opcao('Últimos 7 dias'))
    expect(estado().abertura).toBe(7)
    await userEvent.click(opcao('Últimos 30 dias'))
    expect(estado().abertura).toBe(30)
    expect(opcao('Últimos 30 dias')).toHaveAttribute('aria-checked', 'true')
    expect(opcao('Últimos 7 dias')).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(opcao('Últimos 30 dias'))
    expect(estado().abertura).toBeNull()
  })

  it('Origem começa com Plataforma marcada', async () => {
    render(<Painel />)
    await abrirCampo('Origem')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Plataforma' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Legado' })).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Legado' }))
    expect(estado().origem).toEqual(['plataforma', 'legado'])
  })

  it('Solicitante: pede os nomes ao abrir, busca e aceita vários', async () => {
    const onAbrir = vi.fn()
    render(<Painel onAbrirSolicitantes={onAbrir} />)
    await abrirCampo('Solicitante')
    expect(onAbrir).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('searchbox', { name: 'Buscar solicitante' })).toHaveFocus()
    expect(screen.getAllByRole('menuitemcheckbox').map((i) => i.textContent)).toEqual(['Ana Souza', 'Bruno Silva', 'Carla Mendes'])
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar solicitante' }), 'bru')
    expect(screen.getAllByRole('menuitemcheckbox').map((i) => i.textContent)).toEqual(['Bruno Silva'])
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Bruno Silva' }))
    expect(estado().solicitante).toEqual(['BRUNO DA SILVA'])
  })

  it('mudar um filtro volta para a primeira página', async () => {
    render(<Painel inicial={com({ pagina: 4 })} />)
    await abrirCampo('Tipo')
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Emergencial' }))
    expect(estado()).toMatchObject({ tipo: ['emergencial'], pagina: 0 })
  })
})

describe('GmudFiltroConstrutor: teclado e foco', () => {
  it('setas andam pelos itens, Enter abre o campo, seta para a esquerda volta e Esc fecha devolvendo o foco', async () => {
    render(<Painel />)
    botaoFiltro().focus()
    await userEvent.keyboard('{Enter}')
    const itens = () => screen.getAllByRole('menuitem')
    expect(itens()[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(itens()[2]).toHaveFocus() // Tipo
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(itens()[4]).toHaveFocus() // deu a volta: Solicitante
    await userEvent.keyboard('{Home}')
    expect(itens()[0]).toHaveFocus()

    await userEvent.keyboard('{Enter}') // abre Situação
    expect(screen.getByRole('menu', { name: 'Opções de Situação' })).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{Enter}') // primeira opção
    expect(estado().situacao).toEqual(['aguardando'])
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('menu', { name: 'Adicionar filtro' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(botaoFiltro()).toHaveFocus()
  })

  it('fecha ao clicar fora', async () => {
    render(<Painel />)
    await userEvent.click(botaoFiltro())
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'fora' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('GmudFiltroConstrutor: etiquetas', () => {
  it('padrão: só a etiqueta da origem; sem nenhum filtro, a mensagem discreta', () => {
    const padrao = render(<Painel />)
    expect(screen.getByText('é Plataforma')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
    expect(screen.queryByText(/Nenhum filtro aplicado/)).toBeNull()
    padrao.unmount()
    render(<Painel inicial={com({ origem: [] })} />)
    expect(screen.getByText(/Nenhum filtro aplicado/)).toBeInTheDocument()
  })

  it('mostra "é um de …", o X tira o filtro e "Limpar filtros" volta ao padrão', async () => {
    render(<Painel inicial={com({ situacao: ['liberada', 'negada'], tipo: ['programada'], abertura: 30, kpi: 'abertas' })} />)
    expect(screen.getByRole('button', { name: 'Situação é um de Liberada, Negada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tipo é Programada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abertura nos últimos 30 dias' })).toBeInTheDocument()
    expect(screen.getByText('Em aberto')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remover filtro Situação' }))
    expect(estado().situacao).toEqual([])
    expect(screen.queryByRole('button', { name: /Situação é/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Remover filtro Atalho' }))
    expect(estado().kpi).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(estado()).toEqual(FILTROS_PADRAO)
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
  })

  it('tirar a etiqueta da origem mostra todas as origens (e isso conta como filtro mudado)', async () => {
    render(<Painel />)
    await userEvent.click(screen.getByRole('button', { name: 'Remover filtro Origem' }))
    expect(estado().origem).toEqual([])
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
  })

  it('clicar no texto da etiqueta reabre as opções daquele campo', async () => {
    render(<Painel inicial={com({ tipo: ['emergencial'] })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Tipo é Emergencial' }))
    const menu = screen.getByRole('menu', { name: 'Opções de Tipo' })
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Emergencial' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('GmudPainelAbas', () => {
  it('mostra as cinco abas com a contagem e marca a ativa', async () => {
    const onChange = vi.fn()
    render(<GmudPainelAbas aba="vencidas" contagens={{ todas: 1234, minhas: 3, aguardando: 2, vencidas: 4, semana: 0, canceladas: 9 }} onChange={onChange} />)
    const abas = within(screen.getByRole('group', { name: 'Atalhos da lista' })).getAllByRole('button')
    expect(abas.map((a) => a.textContent)).toEqual(['Todas1.234', 'Minhas3', 'Aguardando decisão2', 'Vencidas4', 'Esta semana0'])
    expect(screen.getByRole('button', { name: /Vencidas/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Todas/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /Equipe/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Esta semana/ }))
    expect(onChange).toHaveBeenCalledWith('semana')
  })

  it('sem contagem ainda, mostra um traço', () => {
    render(<GmudPainelAbas aba="todas" contagens={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Minhas/ })).toHaveTextContent('Minhas–')
  })
})

describe('GmudCanceladasRodape', () => {
  it('ocultas por padrão: "N canceladas ocultas · mostrar"', async () => {
    const onChange = vi.fn()
    render(<GmudCanceladasRodape filtros={com({ pagina: 2 })} canceladas={12} onChange={onChange} />)
    expect(screen.getByText(/12 canceladas ocultas/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'mostrar' }))
    expect(onChange).toHaveBeenCalledWith(com({ mostrarCanceladas: true, pagina: 0 }))
  })

  it('singular, e nada quando não há canceladas ocultas', () => {
    const uma = render(<GmudCanceladasRodape filtros={FILTROS_PADRAO} canceladas={1} onChange={() => {}} />)
    expect(screen.getByText(/1 cancelada oculta ·/)).toBeInTheDocument()
    uma.unmount()
    const { container } = render(<GmudCanceladasRodape filtros={FILTROS_PADRAO} canceladas={0} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('à mostra: oferece "ocultar"; com a situação Cancelada no filtro, não aparece', async () => {
    const onChange = vi.fn()
    const mostrando = render(<GmudCanceladasRodape filtros={com({ mostrarCanceladas: true })} canceladas={5} onChange={onChange} />)
    expect(screen.getByText(/Mostrando as canceladas \(5\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ocultar' }))
    expect(onChange).toHaveBeenCalledWith(com({ mostrarCanceladas: false }))
    mostrando.unmount()
    const { container } = render(<GmudCanceladasRodape filtros={com({ situacao: ['cancelada'] })} canceladas={5} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('GmudSummaryStrip como atalhos', () => {
  const resumo = { abertas: 12, vencidas: 4, vencemSemana: 3, comitePendente: 2 }

  it('cada cartão é um botão com estado ativo; o clique liga ou desliga o atalho', async () => {
    const onToggle = vi.fn()
    render(<GmudSummaryStrip summary={resumo} ativos={new Set(['vencidas', 'abertas'] as const)} onToggle={onToggle} />)
    const cartao = (nome: RegExp) => screen.getByRole('button', { name: nome })
    expect(cartao(/Em aberto/)).toHaveAttribute('aria-pressed', 'true')
    expect(cartao(/Prazo vencido/)).toHaveAttribute('aria-pressed', 'true')
    expect(cartao(/Aguardando Comitê/)).toHaveAttribute('aria-pressed', 'false')
    expect(cartao(/Vencem em 7 dias/)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText('Filtrando')).toHaveLength(2)

    await userEvent.click(cartao(/Aguardando Comitê/))
    expect(onToggle).toHaveBeenLastCalledWith('comite_pendente')
    await userEvent.click(cartao(/Prazo vencido/)) // segundo clique: a tela desfaz
    expect(onToggle).toHaveBeenLastCalledWith('vencidas')
    await userEvent.click(cartao(/Vencem em 7 dias/))
    expect(onToggle).toHaveBeenLastCalledWith('vencem_semana')
  })
})
