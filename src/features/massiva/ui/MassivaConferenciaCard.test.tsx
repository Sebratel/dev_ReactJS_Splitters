import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MassivaConferenciaCardView } from '@/features/massiva/ui/MassivaConferenciaCard'
import {
  parseMassivaConferenciaStatus,
  type MassivaConferenciaStatus,
} from '@/features/massiva/model/massivaConferenciaStatus'

const NOW = new Date('2026-11-12T12:00:00.000Z').getTime()
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

function status(over: Record<string, unknown> = {}, ultima: Record<string, unknown> | null = {}): MassivaConferenciaStatus {
  return parseMassivaConferenciaStatus({
    habilitada: true,
    dryRun: false,
    intervaloMinutos: 5,
    janelaDias: 30,
    gatewayConfigurado: true,
    recuperadasUltimos30Dias: 8,
    ultimaExecucao:
      ultima === null
        ? null
        : {
            ok: true,
            dryRun: false,
            iniciadoEm: minAgo(2),
            elleven: { total: 339, abertos: 2 },
            plano: { criar: 0 },
            criadasTotal: 0,
            ...ultima,
          },
    ...over,
  })
}

const card = () => screen.getByTestId('conferencia-card')

describe('MassivaConferenciaCardView', () => {
  it('carregando: mostra o skeleton e nenhum número', () => {
    render(<MassivaConferenciaCardView status={undefined} isLoading isError={false} nowMs={NOW} />)
    expect(card()).toHaveAttribute('data-state', 'loading')
    expect(screen.getByLabelText('Carregando a conferência')).toBeInTheDocument()
    expect(screen.queryByTestId('conferencia-abertas')).toBeNull()
  })

  it('erro de rede: mensagem curta, sem derrubar o cartão', () => {
    render(<MassivaConferenciaCardView status={undefined} isLoading={false} isError nowMs={NOW} />)
    expect(card()).toHaveAttribute('data-state', 'error')
    expect(screen.getByText(/Não foi possível consultar a conferência agora/)).toBeInTheDocument()
    expect(screen.getByText('Conferência com o Elleven')).toBeInTheDocument()
  })

  it('desligada: texto fixo e selo "Desligada"', () => {
    render(<MassivaConferenciaCardView status={status({ habilitada: false }, null)} isLoading={false} isError={false} nowMs={NOW} />)
    expect(card()).toHaveAttribute('data-state', 'desligada')
    expect(screen.getByText('A conferência automática está desligada neste ambiente.')).toBeInTheDocument()
    expect(screen.getByTestId('conferencia-modo')).toHaveTextContent('Desligada')
  })

  it('nunca executou: "Aguardando a primeira verificação."', () => {
    render(<MassivaConferenciaCardView status={status({}, null)} isLoading={false} isError={false} nowMs={NOW} />)
    expect(card()).toHaveAttribute('data-state', 'aguardando')
    expect(screen.getByText('Aguardando a primeira verificação.')).toBeInTheDocument()
  })

  it('normal: mostra verificação relativa, abertas, sem registro e recuperadas', () => {
    render(<MassivaConferenciaCardView status={status()} isLoading={false} isError={false} nowMs={NOW} />)
    expect(card()).toHaveAttribute('data-state', 'normal')
    expect(screen.getByTestId('conferencia-modo')).toHaveTextContent('Ativa')
    expect(within(screen.getByTestId('conferencia-ultima')).getByText('há 2 min')).toBeInTheDocument()
    expect(within(screen.getByTestId('conferencia-abertas')).getByText('2')).toBeInTheDocument()
    expect(within(screen.getByTestId('conferencia-abertas')).getByText(/de 339 na lista do Elleven/)).toBeInTheDocument()
    expect(within(screen.getByTestId('conferencia-sem-registro')).getByText('0')).toBeInTheDocument()
    expect(within(screen.getByTestId('conferencia-recuperadas')).getByText('8')).toBeInTheDocument()
    expect(screen.queryByTestId('conferencia-erro')).toBeNull()
  })

  it('ativa que acabou de registrar protocolos: tile verde, sem alerta', () => {
    render(
      <MassivaConferenciaCardView
        status={status({}, { plano: { criar: 2 }, criadasTotal: 2 })}
        isLoading={false}
        isError={false}
        nowMs={NOW}
      />,
    )
    const tile = screen.getByTestId('conferencia-sem-registro')
    expect(within(tile).getByText('2')).toBeInTheDocument()
    expect(within(tile).getByText(/2 registradas agora/)).toBeInTheDocument()
    expect(tile.className).toMatch(/emerald/)
    expect(card()).toHaveAttribute('data-state', 'normal')
  })

  it('só relatório com protocolos faltando: "sem registro" em vermelho e aviso do modo', () => {
    render(
      <MassivaConferenciaCardView
        status={status({ dryRun: true }, { dryRun: true, plano: { criar: 8 }, criariamTotal: 8 })}
        isLoading={false}
        isError={false}
        nowMs={NOW}
      />,
    )
    const tile = screen.getByTestId('conferencia-sem-registro')
    expect(within(tile).getByText('8')).toBeInTheDocument()
    expect(within(tile).getByText('Só relatório: nada foi criado.')).toBeInTheDocument()
    expect(tile.className).toMatch(/rose/)
    expect(screen.getByTestId('conferencia-so-relatorio')).toBeInTheDocument()
    expect(screen.getByTestId('conferencia-modo')).toHaveTextContent('Só relatório')
  })

  it('vermelho: última verificação com erro mostra a linha de erro', () => {
    render(
      <MassivaConferenciaCardView
        status={status({}, { ok: false, erro: 'Gateway fora do ar' })}
        isLoading={false}
        isError={false}
        nowMs={NOW}
      />,
    )
    expect(card()).toHaveAttribute('data-state', 'vermelho')
    expect(screen.getByTestId('conferencia-erro')).toHaveTextContent('Gateway fora do ar')
    expect(screen.getByTestId('conferencia-modo').className).toMatch(/rose/)
  })

  it('vermelho: atrasada (mais de 3x o intervalo)', () => {
    render(
      <MassivaConferenciaCardView status={status({}, { iniciadoEm: minAgo(40) })} isLoading={false} isError={false} nowMs={NOW} />,
    )
    expect(card()).toHaveAttribute('data-state', 'vermelho')
    expect(screen.getByTestId('conferencia-atrasada')).toBeInTheDocument()
    expect(screen.getByTestId('conferencia-ultima').className).toMatch(/rose/)
  })

  it('contagem de recuperadas indisponível aparece como traço', () => {
    render(
      <MassivaConferenciaCardView status={status({ recuperadasUltimos30Dias: null })} isLoading={false} isError={false} nowMs={NOW} />,
    )
    expect(within(screen.getByTestId('conferencia-recuperadas')).getByText('—')).toBeInTheDocument()
  })

  it('divergências de situação aparecem só como informação', () => {
    render(
      <MassivaConferenciaCardView
        status={status({}, { divergencias: { abertaLocalFinalizadaElleven: { total: 1 }, fechadaLocalAbertaElleven: { total: 0 } } })}
        isLoading={false}
        isError={false}
        nowMs={NOW}
      />,
    )
    expect(screen.getByTestId('conferencia-divergencias')).toHaveTextContent('1 aberta(s) na plataforma que o Elleven mostra finalizada(s)')
    expect(screen.getByTestId('conferencia-divergencias')).toHaveTextContent('nada foi alterado')
  })

  describe('painel de protocolos', () => {
    const proto = (n: number, over: Record<string, unknown> = {}) => ({
      protocolo: n,
      assignmentId: n + 1_000_000,
      statusElleven: 'aberta',
      abertura: '2026-11-12 08:00:00',
      pontoDeAcesso: 'OLT 03 - SLEFT',
      desfecho: 'seria_criada',
      ...over,
    })
    const renderCard = (ultima: Record<string, unknown>, over: Record<string, unknown> = {}) =>
      render(<MassivaConferenciaCardView status={status(over, ultima)} isLoading={false} isError={false} nowMs={NOW} />)

    it('botão "Ver protocolos (N)" abre a tabela com badge, abertura, ponto de acesso e o que a conferência faz', async () => {
      const user = userEvent.setup()
      renderCard({
        dryRun: true,
        plano: { criar: 3 },
        criariamTotal: 3,
        semRegistro: { total: 3, itens: [proto(1), proto(2, { statusElleven: 'encerrada' }), proto(3)] },
      }, { dryRun: true })
      expect(screen.queryByTestId('conferencia-painel')).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Ver protocolos (3)' }))
      const painel = screen.getByTestId('conferencia-painel')
      expect(within(painel).getAllByTestId('conferencia-protocolo-linha')).toHaveLength(3)
      expect(within(painel).getByText('Encerrada')).toBeInTheDocument()
      expect(within(painel).getAllByText('12/11 08:00')).toHaveLength(3)
      expect(within(painel).getAllByText('OLT 03 - SLEFT')).toHaveLength(3)
      expect(within(painel).getAllByText('Seria criada')).toHaveLength(3)
      await user.click(screen.getByTestId('conferencia-fechar'))
      expect(screen.queryByTestId('conferencia-painel')).toBeNull()
    })

    it('modo real: mostra o desfecho de cada protocolo (Criada, Falhou)', async () => {
      const user = userEvent.setup()
      renderCard({
        plano: { criar: 2 },
        criadasTotal: 1,
        falhasTotal: 1,
        semRegistro: { total: 2, itens: [proto(1, { desfecho: 'criada' }), proto(2, { desfecho: 'falhou' })] },
      })
      await user.click(screen.getByTestId('conferencia-ver-sem-registro'))
      const painel = screen.getByTestId('conferencia-painel')
      expect(within(painel).getByText('Criada')).toBeInTheDocument()
      expect(within(painel).getByText('Falhou')).toBeInTheDocument()
    })

    it('lista vazia: "Nada faltando." e botão de copiar desabilitado', async () => {
      const user = userEvent.setup()
      renderCard({ semRegistro: { total: 0, itens: [] } })
      await user.click(screen.getByRole('button', { name: 'Ver protocolos (0)' }))
      expect(screen.getByTestId('conferencia-painel-vazio')).toHaveTextContent('Nada faltando.')
      expect(screen.getByTestId('conferencia-copiar')).toBeDisabled()
    })

    it('mais de 50: mostra "e mais N" com o total real', async () => {
      const user = userEvent.setup()
      const itens = Array.from({ length: 50 }, (_, i) => proto(100 + i))
      renderCard({ dryRun: true, plano: { criar: 63 }, criariamTotal: 63, semRegistro: { total: 63, itens } }, { dryRun: true })
      await user.click(screen.getByRole('button', { name: 'Ver protocolos (63)' }))
      expect(within(screen.getByTestId('conferencia-painel')).getAllByTestId('conferencia-protocolo-linha')).toHaveLength(50)
      expect(screen.getByTestId('conferencia-painel-mais')).toHaveTextContent('e mais 13')
    })

    it('copiar protocolos usa a área de transferência (um por linha) e confirma', async () => {
      const user = userEvent.setup()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      renderCard({ semRegistro: { total: 2, itens: [proto(11), proto(12)] } })
      await user.click(screen.getByTestId('conferencia-ver-sem-registro'))
      await user.click(screen.getByTestId('conferencia-copiar'))
      expect(writeText).toHaveBeenCalledWith('11\n12')
      expect(await screen.findByText('Copiado!')).toBeInTheDocument()
    })

    it('copiar sem Clipboard API cai no plano B (execCommand)', async () => {
      const user = userEvent.setup()
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
      const exec = vi.fn().mockReturnValue(true)
      Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
      renderCard({ semRegistro: { total: 1, itens: [proto(21)] } })
      await user.click(screen.getByTestId('conferencia-ver-sem-registro'))
      await user.click(screen.getByTestId('conferencia-copiar'))
      expect(exec).toHaveBeenCalledWith('copy')
      expect(await screen.findByText('Copiado!')).toBeInTheDocument()
    })

    it('fora da janela: linha de aviso com botão próprio e painel "não será criada"', async () => {
      const user = userEvent.setup()
      renderCard(
        {
          semRegistro: { total: 0, itens: [] },
          foraDaJanela: {
            total: 2,
            itens: [
              proto(30, { statusElleven: 'cancelada', desfecho: 'fora_da_janela' }),
              proto(31, { statusElleven: 'encerrada', desfecho: 'fora_da_janela' }),
            ],
          },
        },
        { janelaDias: 7 },
      )
      expect(screen.getByTestId('conferencia-fora-da-janela')).toHaveTextContent('Fora da janela de 7 dias')
      await user.click(screen.getByRole('button', { name: 'Ver protocolos fora da janela (2)' }))
      const painel = screen.getByTestId('conferencia-painel')
      expect(within(painel).getAllByText('Fora da janela, não será criada')).toHaveLength(2)
      expect(within(painel).getByText('Cancelada')).toBeInTheDocument()
    })

    it('fora da janela vazio: não mostra a linha de aviso', () => {
      renderCard({ semRegistro: { total: 0, itens: [] }, foraDaJanela: { total: 0, itens: [] } })
      expect(screen.queryByTestId('conferencia-fora-da-janela')).toBeNull()
    })

    it('backend antigo, sem as listas: sem botões e o resto do cartão funciona', () => {
      renderCard({ plano: { criar: 0 } })
      expect(screen.queryByTestId('conferencia-ver-sem-registro')).toBeNull()
      expect(screen.queryByTestId('conferencia-fora-da-janela')).toBeNull()
      expect(within(screen.getByTestId('conferencia-sem-registro')).getByText('0')).toBeInTheDocument()
      expect(card()).toHaveAttribute('data-state', 'normal')
    })
  })

  it('com dados em cache, um erro de atualização não esconde o último estado', () => {
    render(<MassivaConferenciaCardView status={status()} isLoading={false} isError nowMs={NOW} />)
    expect(card()).toHaveAttribute('data-state', 'normal')
  })
})
