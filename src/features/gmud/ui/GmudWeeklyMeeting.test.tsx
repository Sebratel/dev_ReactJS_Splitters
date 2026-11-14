import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { GmudWeeklyMeetingView } from '@/features/gmud/ui/GmudWeeklyMeeting'
import type { GmudReuniaoFeitoItem, GmudReuniaoItem, GmudReuniaoResultado, GmudReuniaoSemanal } from '@/features/gmud/lib/gmudReuniaoSemana'

const item = (protocolo: number, dataInicio: string, horaInicio: string, over: Partial<GmudReuniaoItem> = {}): GmudReuniaoItem => ({
  protocolo,
  titulo: `GMUD ${protocolo}`,
  tipo: 'Programada',
  categoria: 'rede_externa',
  popSite: 'POP Centro',
  sistema: null,
  janela: { dataInicio, horaInicio, dataFim: dataInicio, horaFim: '05:00' },
  impactoParada: 'Não',
  statusComite: 'aprovada',
  statusAreas: 'nao_aplicavel',
  areasTotal: 0,
  areasAprovadas: 0,
  statusExec: null,
  ellevenEncerradoEm: null,
  ellevenEncerradoStatus: null,
  statusVoalle: 'Abertura',
  reagendada: false,
  ...over,
})
const feito = (protocolo: number, resultado: GmudReuniaoResultado, dataInicio: string, over: Partial<GmudReuniaoFeitoItem> = {}): GmudReuniaoFeitoItem => ({
  ...item(protocolo, dataInicio, '01:00'),
  resultado,
  novaJanela: null,
  ...over,
})

const DATA: GmudReuniaoSemanal = {
  feito: [
    feito(11, 'concluida', '2026-11-09'),
    feito(12, 'nao_concluida', '2026-11-12'),
    feito(13, 'reagendada', '2026-11-10', { novaJanela: { dataInicio: '2026-11-25', horaInicio: '02:00', dataFim: '2026-11-25', horaFim: '04:00' } }),
    feito(14, 'cancelada', '2026-11-11'),
  ],
  vem: [
    item(21, '2026-11-18', '03:00'),
    item(22, '2026-11-16', '22:00', { statusComite: 'pendente', impactoParada: 'Sim', categoria: 'sistemas_internos', popSite: null, sistema: 'Hub Apps', tipo: 'Emergencial' }),
    item(23, '2026-11-18', '01:00', { statusAreas: 'pendente', areasAprovadas: 1, areasTotal: 3 }),
  ],
}

function renderView(props: Partial<React.ComponentProps<typeof GmudWeeklyMeetingView>> = {}) {
  const onSegunda = vi.fn()
  render(
    <MemoryRouter>
      <GmudWeeklyMeetingView hoje="2026-11-17" segunda="2026-11-09" onSegunda={onSegunda} data={DATA} {...props} />
    </MemoryRouter>,
  )
  return onSegunda
}

describe('GmudWeeklyMeetingView', () => {
  it('mostra o intervalo das duas semanas e os dois blocos numerados', () => {
    renderView()
    expect(screen.getByText(/09\/11 a 15\/11/, { selector: 'p' })).toHaveTextContent('Feito: 09/11 a 15/11 · Próxima: 16/11 a 22/11')
    expect(screen.getByRole('heading', { name: /1\. O que foi feito/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /2\. O que vem/ })).toBeInTheDocument()
  })

  it('atalhos e setas mudam a semana; o atalho da semana em exibição fica marcado', async () => {
    const onSegunda = renderView()
    expect(screen.getByRole('button', { name: 'Semana passada' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Esta semana' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
    expect(onSegunda).toHaveBeenLastCalledWith('2026-11-16')
    await userEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(onSegunda).toHaveBeenLastCalledWith('2026-11-02')
    await userEvent.click(screen.getByRole('button', { name: 'Semana seguinte' }))
    expect(onSegunda).toHaveBeenLastCalledWith('2026-11-16')
  })

  it('bloco 1: resumo e lista com o que não saiu como planejado antes das concluídas', () => {
    renderView()
    const bloco = within(screen.getByRole('region', { name: /O que foi feito/ }))
    expect(bloco.getByText('Janela passou sem concluir').nextElementSibling).toHaveTextContent('1')
    expect(bloco.getByText('Concluídas').nextElementSibling).toHaveTextContent('1')
    const linhas = bloco.getAllByRole('listitem')
    expect(linhas.map((li) => li.getAttribute('data-resultado'))).toEqual(['nao_concluida', 'reagendada', 'cancelada', 'concluida'])
    expect(within(linhas[0] as HTMLElement).getByText('Não concluída')).toBeInTheDocument()
    expect(within(linhas[1] as HTMLElement).getByText(/Nova janela: 25\/11 02:00/)).toBeInTheDocument()
    expect(within(linhas[0] as HTMLElement).getByRole('link', { name: /GMUD 12/ })).toHaveAttribute('href', '/gmud/12')
    expect(within(linhas[0] as HTMLElement).getByText('Rede externa · POP Centro')).toBeInTheDocument()
  })

  it('bloco 2: agrupa por dia, mostra parada, situação e categoria com o sistema', () => {
    renderView()
    const bloco = within(screen.getByRole('region', { name: /O que vem/ }))
    expect(bloco.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['Segunda, 16/111 GMUD', 'Quarta, 18/112 GMUDs'])
    const linhas = bloco.getAllByRole('listitem')
    expect(linhas.map((li) => within(li).getByRole('link').getAttribute('href'))).toEqual(['/gmud/22', '/gmud/23', '/gmud/21'])
    const pendente = within(linhas[0] as HTMLElement)
    expect(pendente.getByText('Com parada')).toBeInTheDocument()
    expect(pendente.getByText('Aguardando Comitê')).toBeInTheDocument()
    expect(pendente.getByText('Sistemas internos · Hub Apps')).toBeInTheDocument()
    expect(pendente.getByText('Emergencial')).toBeInTheDocument()
    expect(within(linhas[1] as HTMLElement).getByText('Comitê aprovou · aguardando áreas (1/3)')).toBeInTheDocument()
    expect(within(linhas[2] as HTMLElement).getByText('Liberada')).toBeInTheDocument()
    expect(within(linhas[2] as HTMLElement).queryByText('Com parada')).toBeNull()
    expect(bloco.getByText('Aguardando aprovação').nextElementSibling).toHaveTextContent('2')
    expect(bloco.getByText('Com parada de serviço').nextElementSibling).toHaveTextContent('1')
  })

  it('estado vazio em cada bloco e nota sobre as legadas', () => {
    renderView({ data: { feito: [], vem: [] } })
    expect(screen.getByText('Nenhuma GMUD executada nessa semana.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma GMUD programada para essa semana.')).toBeInTheDocument()
    expect(screen.getByText(/legadas \(só no Voalle\)/)).toBeInTheDocument()
  })

  it('carregando e erro com "Tentar de novo"', async () => {
    const onRetry = vi.fn()
    renderView({ data: undefined, isLoading: true })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando a reunião…')
    renderView({ data: undefined, error: 'Falha ao carregar a reunião semanal de GMUDs.', onRetry })
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
