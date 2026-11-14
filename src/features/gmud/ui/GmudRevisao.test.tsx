import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GmudConfirmarAbertura, GmudRevisao } from '@/features/gmud/ui/GmudRevisao'
import { precisaConfirmarAbertura, numeroDeProtocolos } from '@/features/gmud/lib/gmudRevisao'
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

function renderRevisao(f: GmudFormState, opts: { pendencias?: GmudPendencia[]; siData?: GmudSistemasInternosData } = {}) {
  const onEditar = vi.fn()
  const passos = wizardSteps(f.categoria).slice(0, -1)
  render(
    <GmudRevisao
      form={f}
      siData={opts.siData ?? emptyGmudSistemasInternosData()}
      seData={emptyGmudSistemasExternosData()}
      passos={passos}
      pendencias={opts.pendencias ?? []}
      onEditar={onEditar}
      agora={AGORA}
    />,
  )
  return onEditar
}
const cartao = (nome: string) => within(screen.getByRole('region', { name: nome }))

describe('GmudRevisao', () => {
  it('um cartão por etapa, com os dados principais', () => {
    renderRevisao(form())
    const ident = cartao('Identificação')
    expect(ident.getByText('Programada')).toBeInTheDocument()
    expect(ident.getByText('Troca de OLT')).toBeInTheDocument()
    expect(ident.getByText('Manutenção preventiva')).toBeInTheDocument()
    expect(ident.getByText('Completa')).toBeInTheDocument()

    const feito = cartao('O que será feito')
    expect(feito.getByText('POP Centro')).toBeInTheDocument()
    expect(feito.getByText('POP/site inteiro')).toBeInTheDocument()
    expect(feito.getByText('OLT')).toBeInTheDocument()
    expect(feito.getByText('Backbone')).toBeInTheDocument()
    expect(feito.getByText('Nenhum escolhido')).toBeInTheDocument()

    const impacto = cartao('Impacto e execução')
    expect(impacto.getByText('Não')).toBeInTheDocument()
    expect(impacto.getByText('Baixo')).toBeInTheDocument()

    const aprov = cartao('Aprovadores e janela')
    expect(aprov.getByText(/Terça 24\/11, 22:00 até quarta 25\/11, 01:00/)).toBeInTheDocument()
    expect(aprov.getByText('3 h de duração')).toBeInTheDocument()
  })

  it('valores vazios aparecem como "Não informado", sem quebrar', () => {
    renderRevisao({ ...emptyGmudForm(), categoria: 'rede_externa' })
    expect(cartao('Identificação').getAllByText('Não informado').length).toBeGreaterThanOrEqual(3)
    expect(cartao('Aprovadores e janela').getByText('Não informado')).toBeInTheDocument()
  })

  it('pendências: o cartão mostra a contagem e a lista em vez de "Completa"', () => {
    renderRevisao(form({ titulo: '' }), { pendencias: [{ section: 'Identificação', message: 'Título' }] })
    const ident = cartao('Identificação')
    expect(ident.getByText('1 pendência')).toBeInTheDocument()
    expect(ident.getByText('Título', { selector: 'li' })).toBeInTheDocument()
    expect(ident.queryByText('Completa')).toBeNull()
    expect(cartao('O que será feito').getByText('Completa')).toBeInTheDocument()
  })

  it('Editar é um botão com o nome da etapa e leva à etapa certa', async () => {
    const onEditar = renderRevisao(form())
    await userEvent.click(screen.getByRole('button', { name: 'Editar Impacto e execução' }))
    expect(onEditar).toHaveBeenLastCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Editar Identificação' }))
    expect(onEditar).toHaveBeenLastCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: 'Editar Aprovadores e janela' }))
    expect(onEditar).toHaveBeenLastCalledWith(3)
  })

  it('quem aprova: Programada = Comitê e áreas (sem as N/A); Emergencial = só Comitê; Pré-aprovada = ninguém', () => {
    renderRevisao(form())
    const aprov = cartao('Aprovadores e janela')
    expect(aprov.getByText('Comitê')).toBeInTheDocument()
    expect(aprov.getByText(/em paralelo/)).toBeInTheDocument()
    expect(aprov.getByText('T&TI/COR')).toBeInTheDocument()
    expect(aprov.getByText('T&TI/CGR')).toBeInTheDocument()
    expect(aprov.queryByText('Dir/Projetos')).toBeNull()
    expect(aprov.queryByText(/Só recebem e-mail/)).toBeNull()
  })

  it('quem aprova na Emergencial e na Pré-aprovada', () => {
    const emergencial = render(
      <GmudRevisao form={form({ tipo: 'Emergencial' })} siData={emptyGmudSistemasInternosData()} seData={emptyGmudSistemasExternosData()} passos={wizardSteps('rede_externa').slice(0, -1)} pendencias={[]} onEditar={() => {}} agora={AGORA} />,
    )
    let aprov = cartao('Aprovadores e janela')
    expect(aprov.getByText('Comitê')).toBeInTheDocument()
    expect(aprov.queryByText(/em paralelo/)).toBeNull()
    expect(aprov.getByText(/Só recebem e-mail de aviso, sem aprovar/)).toBeInTheDocument()
    expect(aprov.getByText('T&TI/COR')).toBeInTheDocument()
    emergencial.unmount()

    renderRevisao(form({ tipo: 'Pré-aprovada', repeticaoVezes: '1' }))
    aprov = cartao('Aprovadores e janela')
    expect(aprov.getByText(/Ninguém: a Pré-aprovada já nasce liberada/)).toBeInTheDocument()
    expect(aprov.queryByText('Comitê')).toBeNull()
    expect(aprov.getByText(/Só recebem e-mail de aviso/)).toBeInTheDocument()
  })

  it('sistemas internos: sistema, áreas impactadas aprovam e não há passo de clientes/COR', () => {
    const si = { ...emptyGmudSistemasInternosData(), sistemaAfetado: 'Hub Apps', ambiente: 'Produção', natureza: 'Atualização', areasImpactadas: ['Comercial'] }
    renderRevisao(form({ categoria: 'sistemas_internos', recursosAdministrativos: {} }), { siData: si })
    expect(cartao('O que será feito').getByText('Hub Apps')).toBeInTheDocument()
    expect(cartao('Identificação').getByText('Atualização')).toBeInTheDocument()
    expect(cartao('Aprovadores e janela').getByText('Comercial')).toBeInTheDocument()
    const passos = within(screen.getByRole('region', { name: 'O que acontece ao clicar em abrir' })).getAllByRole('listitem')
    expect(passos).toHaveLength(2)
    expect(passos.map((li) => li.textContent).join(' ')).not.toMatch(/clientes|COR/)
  })

  it('o que acontece: muda por tipo; na rede externa tem o passo dos clientes e do COR', () => {
    const { unmount } = render(
      <GmudRevisao form={form()} siData={emptyGmudSistemasInternosData()} seData={emptyGmudSistemasExternosData()} passos={[]} pendencias={[]} onEditar={() => {}} agora={AGORA} />,
    )
    let passos = within(screen.getByRole('region', { name: 'O que acontece ao clicar em abrir' })).getAllByRole('listitem')
    expect(passos).toHaveLength(3)
    expect(passos[1]).toHaveTextContent(/em paralelo/)
    expect(passos[2]).toHaveTextContent(/quando essas rotinas estão ativadas/)
    unmount()
    render(
      <GmudRevisao form={form({ tipo: 'Pré-aprovada', repeticaoVezes: '3', repeticaoIntervaloDias: '7' })} siData={emptyGmudSistemasInternosData()} seData={emptyGmudSistemasExternosData()} passos={[]} pendencias={[]} onEditar={() => {}} agora={AGORA} />,
    )
    passos = within(screen.getByRole('region', { name: 'O que acontece ao clicar em abrir' })).getAllByRole('listitem')
    expect(passos[0]).toHaveTextContent(/Abre 3 protocolos no Elleven agora/)
  })

  it('atenção antes de abrir só aparece quando algum caso se aplica', () => {
    const semAviso = render(
      <GmudRevisao form={form()} siData={emptyGmudSistemasInternosData()} seData={emptyGmudSistemasExternosData()} passos={[]} pendencias={[]} onEditar={() => {}} agora={AGORA} />,
    )
    expect(screen.queryByRole('region', { name: 'Atenção antes de abrir' })).toBeNull()
    semAviso.unmount()

    render(
      <GmudRevisao
        form={form({ tipo: 'Emergencial', impactoParada: 'Sim' })}
        siData={emptyGmudSistemasInternosData()}
        seData={emptyGmudSistemasExternosData()}
        passos={[]}
        pendencias={[]}
        onEditar={() => {}}
        agora={new Date(2026, 10, 23, 10, 0)}
      />,
    )
    const itens = within(screen.getByRole('region', { name: 'Atenção antes de abrir' })).getAllByRole('listitem')
    expect(itens.map((li) => li.textContent)).toEqual([
      'Há parada do serviço durante a execução.',
      'A janela começa em menos de 48 horas.',
      'É uma GMUD emergencial: só o Comitê decide.',
    ])
  })

  it('parada do serviço "Sim" aparece em destaque no cartão de impacto', () => {
    renderRevisao(form({ impactoParada: 'Sim', tipoIndisponibilidade: 'Parcial', duracaoEstimada: '30 min' }))
    const impacto = cartao('Impacto e execução')
    expect(impacto.getByText('Sim')).toHaveClass('bg-rose-700')
    expect(impacto.getByText('Parcial')).toBeInTheDocument()
    expect(impacto.getByText('30 min')).toBeInTheDocument()
  })
})

/** Reproduz a ligação do formulário: o botão final só envia direto quando não precisa de confirmação. */
function BotaoFinal({ f, onEnviar }: { f: GmudFormState; onEnviar: () => void }) {
  const [confirmando, setConfirmando] = useState(false)
  const protocolos = numeroDeProtocolos(f.tipo, f.repeticaoVezes, f.repeticaoIntervaloDias)
  return (
    <>
      <button type="button" onClick={() => (precisaConfirmarAbertura(f.tipo, protocolos) ? setConfirmando(true) : onEnviar())}>
        Abrir
      </button>
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
    </>
  )
}

describe('GmudConfirmarAbertura', () => {
  it('Programada envia direto, sem diálogo', async () => {
    const onEnviar = vi.fn()
    render(<BotaoFinal f={form()} onEnviar={onEnviar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onEnviar).toHaveBeenCalledTimes(1)
  })

  it('Pré-aprovada de um protocolo também envia direto', async () => {
    const onEnviar = vi.fn()
    render(<BotaoFinal f={form({ tipo: 'Pré-aprovada', repeticaoVezes: '1' })} onEnviar={onEnviar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onEnviar).toHaveBeenCalledTimes(1)
  })

  it('Emergencial: abre o diálogo, Cancelar não envia e "Sim, abrir" envia', async () => {
    const onEnviar = vi.fn()
    render(<BotaoFinal f={form({ tipo: 'Emergencial' })} onEnviar={onEnviar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialogo = screen.getByRole('alertdialog', { name: 'Abrir 1 protocolo no Elleven?' })
    expect(dialogo).toHaveTextContent('Emergencial · Troca de OLT · Terça 24/11, 22:00 até quarta 25/11, 01:00')
    expect(onEnviar).not.toHaveBeenCalled()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onEnviar).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, abrir' }))
    expect(onEnviar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Pré-aprovada com repetição: o título diz quantos protocolos; Esc fecha sem enviar', async () => {
    const onEnviar = vi.fn()
    render(<BotaoFinal f={form({ tipo: 'Pré-aprovada', repeticaoVezes: '4', repeticaoIntervaloDias: '15' })} onEnviar={onEnviar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByRole('alertdialog', { name: 'Abrir 4 protocolos no Elleven?' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onEnviar).not.toHaveBeenCalled()
  })
})
