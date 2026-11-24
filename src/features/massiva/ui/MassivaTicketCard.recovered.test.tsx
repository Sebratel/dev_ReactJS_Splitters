import { describe, expect, it, vi } from 'vitest'
// Ordem importa: o app carrega o sessionStore antes do httpClient (há um ciclo entre eles).
import '@/features/session/store/sessionStore'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

vi.mock('react-oidc-context', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}))

import { MassivaTicketCard } from '@/features/massiva/ui/MassivaTicketCard'

function ticket(over: Partial<MassivaTicket> = {}): MassivaTicket {
  return {
    protocol: 1886908,
    assignmentId: 2322444,
    title: 'OLT 03 - SLEFT',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: 'aberta',
    ellevenLifecycle: 'open',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt: new Date('2026-11-11T15:11:00.000Z'),
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: null,
    closeDescription: null,
    closedBy: null,
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
    ...over,
  }
}

function renderCard(t: MassivaTicket) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MassivaTicketCard
        ticket={t}
        closeConfigured
        onRequestClose={() => undefined}
        onRequestCancel={() => undefined}
        onRequestMaintenance={() => undefined}
        lastAffectedVerification={null}
        verifiedByLabel="Teste"
      />
    </QueryClientProvider>,
  )
}

describe('MassivaTicketCard — selo "Recuperada do Elleven"', () => {
  it('mostra o selo com o texto de ajuda quando a massiva foi recuperada pela conferência', () => {
    renderCard(ticket({ recoveredFromElleven: true }))
    const selo = screen.getByTestId('selo-recuperada-elleven')
    expect(selo).toHaveTextContent('Recuperada do Elleven')
    expect(selo).toHaveAttribute(
      'title',
      'Esta massiva estava só no Elleven e foi registrada automaticamente pela conferência. Alguns dados (operador, clientes afetados) podem estar em branco.',
    )
  })

  it('não mostra o selo nas demais massivas', () => {
    renderCard(ticket())
    expect(screen.queryByTestId('selo-recuperada-elleven')).toBeNull()
  })

  it('linha parcial (sem operador e sem afetados) renderiza o cartão normalmente', () => {
    renderCard(ticket({ recoveredFromElleven: true, createdBy: '', responsible: '', affectedClients: 0 }))
    expect(screen.getByText('#1886908')).toBeInTheDocument()
    expect(screen.getByText('OLT 03 - SLEFT')).toBeInTheDocument()
    expect(screen.getByText('Sem impacto mapeado')).toBeInTheDocument()
    expect(screen.getAllByText('Não informado').length).toBeGreaterThanOrEqual(1)
  })
})
