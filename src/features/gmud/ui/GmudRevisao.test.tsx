import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmudConfirmarAbertura, GmudRevisao, GmudRevisaoBarra } from '@/features/gmud/ui/GmudRevisao'
import { GmudRevisaoTopo } from '@/features/gmud/ui/GmudRevisaoTopo'
import { atencoesDoFormulario, numeroDeProtocolos, precisaConfirmarAbertura, textoDoBotaoAbrir } from '@/features/gmud/lib/gmudRevisao'
import { wizardSteps } from '@/features/gmud/lib/gmudWizard'
import {
  emptyGmudForm,
  emptyGmudSistemasExternosData,
  emptyGmudSistemasInternosData,
  type GmudFormState,
  type GmudPendencia,
  type GmudSistemasInternosData,
} from '@/features/gmud/model/gmudForm'

const AGORA = new Date(2026, 10, 1, 10, 0) // 01/11/2026 10:00, bem antes da janela

function form(over: Partial<GmudFormState> = {}): GmudFormState {
  return {
    ...emptyGmudForm('ana@sebratel.com', 'Ana'),
    categoria: 'rede_externa',
    tipo: 'Programada',
    titulo: 'Troca de OLT',
    assunto: 'Manutenção preventiva',
    popSite: 'POP Centro',
    ambienteAfetado: ['OLT', 'Backbone'],
    impactoParada: 'Não',
    riscoExecucao: 'Baixo',
    recursosAdministrativos: { 'T&TI/COR': 'executor', 'T&TI/CGR': 'validador', 'Dir/Projetos': 'na' },
    dataInicio: '2026-11-24',
    horaInicio: '22:00',
    dataFim: '2026-11-25',
    horaFim: '01:00',
    ...over,
  }
}

function renderRevisao(f: GmudFormState, opts: { pendencias?: GmudPendencia[]; siData?: GmudSistemasInternosData; agora?: Date } = {}) {
  const onEditar = vi.fn()
  const passos = wizardSteps(f.categoria).slice(0, -1)
  const view = render(
    <GmudRevisao
      form={f}
      siData={opts.siData ?? emptyGmudSistemasInternosData()}
      seData={emptyGmudSistemasExternosData()}
      passos={passos}
      pendencias={opts.pendencias ?? []}
      onEditar={onEditar}
      agora={opts.agora ?? AGORA}
    />,
  )
  return { onEditar, ...view }
}
const linha = (nome: string) => screen.getByRole('listitem', { name: nome })
const naLinha = (nome: string) => within(linha(nome))

describe('GmudRevisao (compacta)', () => {
  it('uma linha por etapa, com os dados principais na própria linha', () => {
    renderRevisao(form())
    expect(screen.getAllByRole('heading', { level: 3 }).slice(0, 4).map((h) => h.textContent)).toEqual([
      'Identificação', 'O que será feito', 'Impacto e execução', 'Aprovadores e janela',
    ])
    const ident = naLinha('Identificação')
    expect(ident.getByText('Programada')).toBeInTheDocument()
    expect(ident.getByText('Troca de OLT')).toBeInTheDocument()
    expect(ident.getByText('Manutenção preventiva')).toBeInTheDocument()
    expect(ident.getByText('Completa')).toBeInTheDocument()

    const feito = naLinha('O que será feito')
    expect(feito.getByText('POP Centro')).toBeInTheDocument()
    expect(feito.getByText('POP/site inteiro')).toBeInTheDocument()
    expect(feito.getByText('OLT, Backbone')).toBeInTheDocument()
    expect(feito.getByText('Nenhum escolhido')).toBeInTheDocument()

    const impacto = naLinha('Impacto e execução')
    expect(impacto.getByText('Não')).toBeInTheDocument()
    expect(impacto.getByText('Baixo')).toBeInTheDocument()

    const aprov = naLinha('Aprovadores e janela')
    expect(aprov.getByText('Terça 24/11, 22:00 até quarta 25/11, 01:00')).toBeInTheDocument()
    expect(aprov.getByText('3 h de duração')).toBeInTheDocument()
    expect(aprov.getByText('Comitê e, em paralelo, T&TI/COR, T&TI/CGR')).toBeInTheDocument()
  })

  it('valor longo é cortado na tela e fica inteiro no title', () => {
    const titulo = 'Substituição do cartão de linha da OLT principal do POP Centro com migração das PONs'
    renderRevisao(form({ titulo }))
    const valor = naLinha('Identificação').getByText(titulo)
    expect(valor).toHaveClass('truncate')
    expect(valor).toHaveAttribute('title', titulo)
  })

  it('valores vazios aparecem como "Não informado", sem quebrar', () => {
    renderRevisao({ ...emptyGmudForm(), categoria: 'rede_externa' })
    expect(naLinha('Identificação').getAllByText('Não informado').length).toBeGreaterThanOrEqual(3)
    expect(naLinha('Aprovadores e janela').getByText('Não informado')).toBeInTheDocument()
  })

  it('pendências: selo com a contagem e o que falta, visível e no title', () => {
    renderRevisao(form({ titulo: '' }), {
      pendencias: [
        { section: 'Identificação', message: 'Título' },
        { section: 'Identificação', message: 'Tipo de GMUD' },
      ],
    })
    const ident = naLinha('Identificação')
    expect(ident.getByText('2 pendências')).toBeInTheDocument()
    expect(ident.getByText('Falta: Título; Tipo de GMUD')).toHaveAttribute('title', 'Título; Tipo de GMUD')
    expect(ident.queryByText('Completa')).toBeNull()
    expect(naLinha('O que será feito').getByText('Completa')).toBeInTheDocument()
  })

  it('Editar é um botão com o nome da etapa e leva à etapa certa', async () => {
    const { onEditar } = renderRevisao(form())
    await userEvent.click(screen.getByRole('button', { name: 'Editar Impacto e execução' }))
    expect(onEditar).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Editar Identificação' }))
    expect(onEditar).toHaveBeenLastCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: 'Editar Aprovadores e janela' }))
    expect(onEditar).toHaveBeenLastCalledWith(3)
  })

  it('quem aprova: Programada sem as N/A; Emergencial só o Comitê; Pré-aprovada ninguém', () => {
    const programada = renderRevisao(form())
    expect(naLinha('Aprovadores e janela').queryByText(/Dir\/Projetos/)).toBeNull()
    expect(naLinha('Aprovadores e janela').queryByText(/Só recebem e-mail/)).toBeNull()
    programada.unmount()

    const emergencial = renderRevisao(form({ tipo: 'Emergencial' }))
    let aprov = naLinha('Aprovadores e janela')
    expect(aprov.getByText('Só o Comitê')).toBeInTheDocument()
    expect(aprov.getByText('Só recebem e-mail de aviso, sem aprovar:')).toBeInTheDocument()
    expect(aprov.getByText('T&TI/COR, T&TI/CGR')).toBeInTheDocument()
    emergencial.unmount()

    renderRevisao(form({ tipo: 'Pré-aprovada', repeticaoVezes: '1' }))
    aprov = naLinha('Aprovadores e janela')
    expect(aprov.getByText('Ninguém: a Pré-aprovada já nasce liberada')).toBeInTheDocument()
    expect(aprov.getByText('T&TI/COR, T&TI/CGR')).toBeInTheDocument()
  })

  it('sistemas internos: sistema, ambiente e as áreas impactadas aprovando', () => {
    const si = { ...emptyGmudSistemasInternosData(), sistemaAfetado: 'Hub Apps', ambiente: 'Produção', natureza: 'Atualização', areasImpactadas: ['Comercial'] }
    renderRevisao(form({ categoria: 'sistemas_internos', recursosAdministrativos: {} }), { siData: si })
    expect(naLinha('O que será feito').getByText('Hub Apps')).toBeInTheDocument()
    expect(naLinha('O que será feito').getByText('Produção')).toBeInTheDocument()
    expect(naLinha('Identificação').getByText('Atualização')).toBeInTheDocument()
    expect(naLinha('Aprovadores e janela').getByText('Comitê e, em paralelo, Comercial')).toBeInTheDocument()
  })

  it('parada do serviço "Sim" em destaque, com indisponibilidade e duração estimada', () => {
    renderRevisao(form({ impactoParada: 'Sim', tipoIndisponibilidade: 'Parcial', duracaoEstimada: '30 min' }))
    const impacto = naLinha('Impacto e execução')
    expect(impacto.getByText('Sim')).toHaveClass('bg-rose-700')
    expect(impacto.getByText('Parcial')).toBeInTheDocument()
    expect(impacto.getByText('30 min')).toBeInTheDocument()
  })

  it('"O que acontece ao abrir" começa recolhido e abre ao clicar', async () => {
    renderRevisao(form())
    const botao = screen.getByRole('button', { name: /O que acontece ao abrir · 3 passos/ })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    const lista = document.getElementById(botao.getAttribute('aria-controls') ?? '') as HTMLElement
    expect(lista).not.toBeVisible()

    await userEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(lista).toBeVisible()
    const passos = within(lista).getAllByRole('listitem')
    expect(passos).toHaveLength(3)
    expect(passos[1]).toHaveTextContent(/em paralelo/)
    expect(passos[2]).toHaveTextContent(/quando essas rotinas estão ativadas/)

    await userEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(lista).not.toBeVisible()
  })

  it('sistemas internos: dois passos, sem clientes nem COR; Pré-aprovada diz quantos protocolos', async () => {
    const si = renderRevisao(form({ categoria: 'sistemas_internos' }))
    expect(screen.getByRole('button', { name: /O que acontece ao abrir · 2 passos/ })).toBeInTheDocument()
    si.unmount()
    renderRevisao(form({ tipo: 'Pré-aprovada', repeticaoVezes: '3', repeticaoIntervaloDias: '7' }))
    await userEvent.click(screen.getByRole('button', { name: /O que acontece ao abrir/ }))
    expect(screen.getByText(/Abre 3 protocolos no Elleven agora/)).toBeInTheDocument()
  })

  it('atenção: não aparece sem motivo; com um motivo é uma linha só', () => {
    const sem = renderRevisao(form())
    expect(screen.queryByRole('region', { name: 'Atenção antes de abrir' })).toBeNull()
    sem.unmount()
    renderRevisao(form({ impactoParada: 'Sim' }))
    const faixa = screen.getByRole('region', { name: 'Atenção antes de abrir' })
    expect(faixa).toHaveTextContent('Atenção: há parada do serviço durante a execução.')
    expect(within(faixa).queryByRole('list')).toBeNull()
  })

  it('atenção: com vários motivos, lista curta na mesma faixa', () => {
    renderRevisao(form({ tipo: 'Emergencial', impactoParada: 'Sim' }), { agora: new Date(2026, 10, 23, 10, 0) })
    const faixa = screen.getByRole('region', { name: 'Atenção antes de abrir' })
    expect(within(faixa).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'há parada do serviço durante a execução.',
      'a janela começa em menos de 48 horas.',
      'é uma GMUD emergencial: só o Comitê decide.',
    ])
  })
})

/** Reproduz a ligação do formulário: barra dentro do <form>, envio com a confirmação nos casos de risco. */
function Formulario({ f, pendencias = 0, enviando = false, onEnviar }: { f: GmudFormState; pendencias?: number; enviando?: boolean; onEnviar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  const protocolos = numeroDeProtocolos(f.tipo, f.repeticaoVezes, f.repeticaoIntervaloDias)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (precisaConfirmarAbertura(f.tipo, protocolos)) setConfirmando(true)
        else onEnviar()
      }}
    >
      <GmudRevisaoBarra
        pendencias={pendencias}
        atencoes={atencoesDoFormulario(f, AGORA)}
        textoBotao={textoDoBotaoAbrir(protocolos)}
        enviando={enviando}
        podeEnviar={!enviando}
        onCancelar={() => {}}
        onVoltar={() => {}}
      />
      {confirmando ? (
        <GmudConfirmarAbertura
          form={f}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={() => {
            setConfirmando(false)
            onEnviar()
          }}
        />
      ) : null}
    </form>
  )
}

describe('GmudRevisaoBarra', () => {
  it('resumo "Tudo preenchido", um botão de cada e o botão final envia', async () => {
    const onEnviar = vi.fn()
    render(<Formulario f={form()} onEnviar={onEnviar} />)
    const barra = within(screen.getByRole('group', { name: 'Ações da revisão' }))
    expect(barra.getByText('Tudo preenchido')).toBeInTheDocument()
    expect(barra.queryByText(/atenç/)).toBeNull()
    expect(barra.getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancelar', 'Voltar', 'Abrir GMUD no Elleven'])
    await userEvent.click(barra.getByRole('button', { name: 'Abrir GMUD no Elleven' }))
    expect(onEnviar).toHaveBeenCalledTimes(1)
  })

  it('mostra as pendências e as atenções (com o texto no title)', () => {
    render(<Formulario f={form({ impactoParada: 'Sim', tipo: 'Emergencial' })} pendencias={2} onEnviar={() => {}} />)
    const barra = within(screen.getByRole('group', { name: 'Ações da revisão' }))
    expect(barra.getByText('2 pendências')).toBeInTheDocument()
    expect(barra.queryByText('Tudo preenchido')).toBeNull()
    expect(barra.getByText(/· 2 atenções/)).toHaveAttribute(
      'title',
      'Há parada do serviço durante a execução. É uma GMUD emergencial: só o Comitê decide.',
    )
  })

  it('Cancelar e Voltar chamam as ações', async () => {
    const onCancelar = vi.fn()
    const onVoltar = vi.fn()
    render(<GmudRevisaoBarra pendencias={0} atencoes={[]} textoBotao="Abrir GMUD no Elleven" enviando={false} podeEnviar onCancelar={onCancelar} onVoltar={onVoltar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onVoltar).toHaveBeenCalledTimes(1)
  })

  it('enquanto abre: "Abrindo no Elleven…" e o botão fica desabilitado', async () => {
    const onEnviar = vi.fn()
    render(<Formulario f={form()} enviando onEnviar={onEnviar} />)
    const botao = screen.getByRole('button', { name: 'Abrindo no Elleven…' })
    expect(botao).toBeDisabled()
    await userEvent.click(botao)
    expect(onEnviar).not.toHaveBeenCalled()
  })

  it('Pré-aprovada com repetição: o botão diz quantos protocolos e pede confirmação', async () => {
    const onEnviar = vi.fn()
    render(<Formulario f={form({ tipo: 'Pré-aprovada', repeticaoVezes: '4', repeticaoIntervaloDias: '15' })} onEnviar={onEnviar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir 4 protocolos no Elleven' }))
    expect(screen.getByRole('alertdialog', { name: 'Abrir 4 protocolos no Elleven?' })).toBeInTheDocument()
    expect(onEnviar).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onEnviar).not.toHaveBeenCalled()
  })

  it('Emergencial: Cancelar não envia e "Sim, abrir" envia', async () => {
    const onEnviar = vi.fn()
    render(<Formulario f={form({ tipo: 'Emergencial' })} onEnviar={onEnviar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir GMUD no Elleven' }))
    const dialogo = screen.getByRole('alertdialog', { name: 'Abrir 1 protocolo no Elleven?' })
    expect(dialogo).toHaveTextContent('Emergencial · Troca de OLT · Terça 24/11, 22:00 até quarta 25/11, 01:00')
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(onEnviar).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir GMUD no Elleven' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, abrir' }))
    expect(onEnviar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Programada e Pré-aprovada de um protocolo enviam direto, sem diálogo', async () => {
    const onEnviar = vi.fn()
    render(<Formulario f={form({ tipo: 'Pré-aprovada', repeticaoVezes: '1' })} onEnviar={onEnviar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir GMUD no Elleven' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onEnviar).toHaveBeenCalledTimes(1)
  })
})

describe('GmudRevisaoTopo', () => {
  it('sem rascunho: só a categoria e "Trocar categoria"', async () => {
    const onTrocar = vi.fn()
    render(<GmudRevisaoTopo categoriaLabel="Rede externa" rascunhoSalvoEm={null} onTrocarCategoria={onTrocar} onDescartarRascunho={() => {}} />)
    expect(screen.getByText('Rede externa')).toBeInTheDocument()
    expect(screen.queryByText(/Rascunho/)).toBeNull()
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['Trocar categoria'])
    await userEvent.click(screen.getByRole('button', { name: 'Trocar categoria' }))
    expect(onTrocar).toHaveBeenCalledTimes(1)
  })

  it('com rascunho: hora em que foi salvo, validade e o descarte com confirmação em dois passos', async () => {
    const onDescartar = vi.fn()
    const salvoEm = new Date(2026, 10, 14, 9, 5).toISOString()
    render(<GmudRevisaoTopo categoriaLabel="Sistemas internos" rascunhoSalvoEm={salvoEm} onTrocarCategoria={() => {}} onDescartarRascunho={onDescartar} />)
    expect(screen.getByText(/Rascunho de hoje/)).toHaveTextContent('· Rascunho de hoje 09:05, expira 23:59')

    await userEvent.click(screen.getByRole('button', { name: 'Limpar tudo e começar do zero' }))
    expect(onDescartar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onDescartar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar tudo e começar do zero' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, apagar' }))
    expect(onDescartar).toHaveBeenCalledTimes(1)
  })
})
