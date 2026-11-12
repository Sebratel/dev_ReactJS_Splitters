import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  it('com dados em cache, um erro de atualização não esconde o último estado', () => {
    render(<MassivaConferenciaCardView status={status()} isLoading={false} isError nowMs={NOW} />)
    expect(card()).toHaveAttribute('data-state', 'normal')
  })
})
