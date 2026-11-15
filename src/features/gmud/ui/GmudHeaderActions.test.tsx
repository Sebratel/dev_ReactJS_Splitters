import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { atualizadoHa } from '@/features/gmud/lib/gmudAtualizado'
import type { GmudPainelContagens } from '@/features/gmud/api/gmudPainel'

// A tela do painel é montada com as partes pesadas trocadas por marcadores: aqui interessa só o cabeçalho.
const permissoes = new Set<string>()
vi.mock('@/features/access/store/accessAuthStore', () => ({
  useAccessAuthStore: (seletor: (s: { hasPermission: (p: string) => boolean }) => unknown) => seletor({ hasPermission: (p) => permissoes.has(p) }),
}))
vi.mock('@/features/gmud/hooks/useGmudApprovals', () => ({ useGmudPendingCount: () => 0 }))
vi.mock('@/features/gmud/hooks/useGmudCommittee', () => ({ useIsGmudCommitteeMember: () => false }))
vi.mock('@/features/gmud/api/fetchGmudListSummary', () => ({ useGmudListSummary: () => ({ data: undefined }) }))
vi.mock('@/features/gmud/ui/GmudPainelLista', () => ({ GmudPainelLista: () => <div data-testid="lista" /> }))
vi.mock('@/features/gmud/ui/GmudSummaryStrip', () => ({ GmudSummaryStrip: () => <div data-testid="cartoes" /> }))
vi.mock('@/features/gmud/ui/GmudApprovalQueue', () => ({ GmudApprovalQueue: () => null }))
vi.mock('@/features/gmud/ui/GmudCalendar', () => ({ GmudCalendar: () => null }))
vi.mock('@/features/gmud/ui/GmudWeeklyMeeting', () => ({ GmudWeeklyMeeting: () => null }))
vi.mock('@/features/gmud/ui/GmudApprovalModal', () => ({ GmudApprovalModal: () => null }))
vi.mock('@/features/gmud/ui/GmudLinksModal', () => ({ GmudLinksModal: () => null }))

const { GmudHeaderActions } = await import('@/features/gmud/ui/GmudHeaderActions')
const { GmudScreen } = await import('@/features/gmud/ui/GmudScreen')
const { GmudPainelAbas } = await vi.importActual<typeof import('@/features/gmud/ui/GmudPainelLista')>('@/features/gmud/ui/GmudPainelLista')

function montar(ui: ReactNode, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const view = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/gmud']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
  return { qc, ...view }
}
const NOME = 'Ações do painel de GMUDs'
const grupo = () => within(screen.getByRole('group', { name: NOME }))

beforeEach(() => {
  permissoes.clear()
})

describe('atualizadoHa', () => {
  const agora = new Date(2026, 10, 14, 12, 0).getTime()
  it('agora mesmo, minutos e horas', () => {
    expect(atualizadoHa(agora - 20_000, agora)).toBe('agora mesmo')
    expect(atualizadoHa(agora - 60_000, agora)).toBe('há 1 min')
    expect(atualizadoHa(agora - 12 * 60_000, agora)).toBe('há 12 min')
    expect(atualizadoHa(agora - 59 * 60_000, agora)).toBe('há 59 min')
    expect(atualizadoHa(agora - 2 * 3_600_000 - 5 * 60_000, agora)).toBe('há 2 h')
  })
  it('sem atualização ainda não diz nada; relógio adiantado não vira número negativo', () => {
    expect(atualizadoHa(0, agora)).toBe('')
    expect(atualizadoHa(agora + 5_000, agora)).toBe('agora mesmo')
  })
})

describe('GmudHeaderActions', () => {
  it('botões separados: Atualizar só com ícone; Indicadores com ícone e texto', () => {
    montar(<GmudHeaderActions canConfigure={false} />)
    const atualizar = grupo().getByRole('button', { name: 'Atualizar' })
    expect(atualizar).toHaveAttribute('type', 'button')
    expect(atualizar).toHaveAttribute('title', 'Atualizar')
    expect(atualizar).toHaveTextContent('') // só o ícone
    expect(atualizar).toHaveClass('h-10', 'w-10')
    const indicadores = grupo().getByRole('link', { name: 'Indicadores' })
    expect(indicadores).toHaveAttribute('href', '/gmud/indicadores')
    expect(indicadores).toHaveTextContent('Indicadores')
    // Cada um com o próprio contorno, 40 px de altura e cantos de 8 px (sem agrupamento com borda única).
    for (const controle of [atualizar, indicadores]) expect(controle).toHaveClass('h-10', 'rounded-lg', 'border', 'bg-surface-container-lowest')
    expect(screen.getByRole('group', { name: NOME })).not.toHaveClass('border')
    // Ícones de 18 px, decorativos.
    for (const svg of screen.getByRole('group', { name: NOME }).querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('width', '18')
    }
  })

  it('em tela estreita Indicadores e Configurar viram só ícone de 40 px (o nome fica no aria-label e no title)', () => {
    montar(<GmudHeaderActions canConfigure />)
    for (const nome of ['Indicadores', 'Configurar']) {
      const link = grupo().getByRole('link', { name: nome })
      expect(link).toHaveClass('w-10', 'sm:w-auto')
      expect(link).toHaveAttribute('title')
      expect(within(link).getByText(nome)).toHaveClass('hidden', 'sm:inline')
    }
    // "Nova GMUD" mantém o texto em qualquer largura.
    expect(grupo().getByRole('link', { name: 'Nova GMUD' }).querySelector('.hidden')).toBeNull()
  })

  it('"Configurar" só aparece para quem pode configurar', () => {
    const sem = montar(<GmudHeaderActions canConfigure={false} />)
    expect(grupo().queryByRole('link', { name: 'Configurar' })).toBeNull()
    expect(grupo().getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/gmud/indicadores', '/gmud/nova'])
    sem.unmount()
    montar(<GmudHeaderActions canConfigure />)
    expect(grupo().getByRole('link', { name: 'Configurar' })).toHaveAttribute('href', '/gmud/configuracoes')
  })

  it('"Nova GMUD" é o único botão amarelo e o último das ações da GMUD', () => {
    montar(<GmudHeaderActions canConfigure />)
    const nova = screen.getByRole('link', { name: 'Nova GMUD' })
    expect(nova).toHaveAttribute('href', '/gmud/nova')
    expect(nova).toHaveClass('bg-primary', 'text-neutral-900', 'h-10', 'rounded-lg')
    const controles = [...screen.getByRole('group', { name: NOME }).querySelectorAll('a, button')]
    expect(controles[controles.length - 1]).toBe(nova)
    expect(controles.filter((c) => c.classList.contains('bg-primary'))).toEqual([nova])
  })

  it('Atualizar invalida o módulo inteiro (["gmud"]) e anuncia o estado', async () => {
    const { qc } = montar(<GmudHeaderActions canConfigure={false} />)
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await userEvent.click(grupo().getByRole('button', { name: 'Atualizar' }))
    expect(invalidar).toHaveBeenCalledTimes(1)
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['gmud'] })
    // Sem nenhuma consulta rodando, já está atualizado.
    expect(screen.getByRole('status')).toHaveTextContent('Atualizado')
  })

  it('enquanto alguma consulta do módulo carrega: ícone girando e "Atualizando…"', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let liberar: (v: number) => void = () => {}
    void qc.fetchQuery({ queryKey: ['gmud', 'list', 'x'], queryFn: () => new Promise<number>((resolve) => { liberar = resolve }) })
    montar(<GmudHeaderActions canConfigure={false} />, qc)
    const icone = grupo().getByRole('button', { name: 'Atualizar' }).querySelector('svg') as SVGElement
    expect(icone).toHaveClass('animate-spin')
    await userEvent.click(grupo().getByRole('button', { name: 'Atualizar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Atualizando…')
    await act(async () => {
      liberar(1)
    })
    await waitFor(() => expect(icone).not.toHaveClass('animate-spin'))
    expect(screen.getByRole('status')).toHaveTextContent('Atualizado')
  })

  it('"Atualizado há X" usa a consulta mais recente do módulo; sem dados, não aparece', () => {
    const vazio = montar(<GmudHeaderActions canConfigure={false} />)
    expect(screen.queryByText(/^Atualizado (agora|há)/)).toBeNull()
    vazio.unmount()

    const qc = new QueryClient()
    const agora = Date.now()
    qc.setQueryData(['gmud', 'list-summary'], { ok: true }, { updatedAt: agora - 40 * 60_000 })
    qc.setQueryData(['gmud', 'list', 'painel'], { ok: true }, { updatedAt: agora - 7 * 60_000 })
    qc.setQueryData(['outro-modulo'], { ok: true }, { updatedAt: agora })
    montar(<GmudHeaderActions canConfigure={false} />, qc)
    expect(screen.getByText('Atualizado há 7 min')).toBeInTheDocument()
  })
})

describe('cabeçalho da tela de GMUD', () => {
  it('"Voltar ao painel" continua como estava: pílula amarela do AppPageHeader, por último', () => {
    montar(<GmudScreen />)
    const voltar = screen.getByRole('link', { name: 'Voltar ao painel' })
    expect(voltar).toHaveAttribute('href', '/')
    expect(voltar).toHaveClass('rounded-full', 'bg-primary', 'min-h-[44px]')
    // As ações novas vêm antes; o Voltar segue sendo o último controle do cabeçalho.
    const controles = within(screen.getByRole('banner')).getAllByRole('link')
    expect(controles.map((c) => c.getAttribute('href'))).toEqual(['/gmud/indicadores', '/gmud/nova', '/'])
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Atualizar' })).toBeInTheDocument()
  })

  it('com permissão de configurar, "Configurar" aparece entre as ações', () => {
    permissoes.add('canConfigureGmud')
    montar(<GmudScreen />)
    expect(grupo().getByRole('link', { name: 'Configurar' })).toBeInTheDocument()
  })
})

describe('abas rápidas: visual', () => {
  const contagens: GmudPainelContagens = { todas: 120, minhas: 3, aguardando: 2, vencidas: 4, semana: 0, canceladas: 9 }
  const contador = (nome: RegExp) => screen.getByRole('button', { name: nome }).querySelector('[data-tom]') as HTMLElement

  it('aba ativa: amarelo da marca, texto escuro e contador translúcido (sem preto sólido)', () => {
    render(<GmudPainelAbas aba="todas" contagens={contagens} onChange={() => {}} />)
    const ativa = screen.getByRole('button', { name: /Todas/ })
    expect(ativa).toHaveAttribute('aria-pressed', 'true')
    expect(ativa).toHaveClass('bg-primary', 'text-neutral-900')
    expect(contador(/Todas/)).toHaveAttribute('data-tom', 'ativa')
    expect(contador(/Todas/)).toHaveClass('bg-neutral-900/10', 'text-neutral-900')
    expect(contador(/Todas/).className).not.toMatch(/bg-neutral-900(\s|$)|text-white/)
  })

  it('inativas: contador cinza suave; Vencidas e Aguardando decisão em tom de alerta quando há itens', () => {
    render(<GmudPainelAbas aba="todas" contagens={contagens} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Minhas/ })).toHaveAttribute('aria-pressed', 'false')
    expect(contador(/Minhas/)).toHaveAttribute('data-tom', 'neutro')
    expect(contador(/Minhas/)).toHaveClass('bg-surface-container-low')
    expect(contador(/Vencidas/)).toHaveAttribute('data-tom', 'alerta')
    expect(contador(/Vencidas/)).toHaveClass('bg-rose-100', 'text-rose-700')
    expect(contador(/Aguardando decisão/)).toHaveAttribute('data-tom', 'atencao')
    expect(contador(/Aguardando decisão/)).toHaveClass('bg-amber-100')
    expect(contador(/Esta semana/)).toHaveAttribute('data-tom', 'neutro')
  })

  it('sem itens (ou sem contagem) não há alerta; a aba ativa usa sempre o tom da ativa', () => {
    const zerado = render(<GmudPainelAbas aba="todas" contagens={{ ...contagens, vencidas: 0, aguardando: 0 }} onChange={() => {}} />)
    expect(contador(/Vencidas/)).toHaveAttribute('data-tom', 'neutro')
    expect(contador(/Aguardando decisão/)).toHaveAttribute('data-tom', 'neutro')
    zerado.unmount()
    const semContagem = render(<GmudPainelAbas aba="todas" contagens={undefined} onChange={() => {}} />)
    expect(contador(/Vencidas/)).toHaveAttribute('data-tom', 'neutro')
    semContagem.unmount()
    render(<GmudPainelAbas aba="vencidas" contagens={contagens} onChange={() => {}} />)
    expect(contador(/Vencidas/)).toHaveAttribute('data-tom', 'ativa')
  })

  it('contador com largura mínima fixa e números tabulares (a aba não muda de tamanho)', () => {
    render(<GmudPainelAbas aba="todas" contagens={contagens} onChange={() => {}} />)
    for (const nome of [/Todas/, /Minhas/, /Vencidas/]) expect(contador(nome)).toHaveClass('min-w-7', 'tabular-nums')
  })
})
