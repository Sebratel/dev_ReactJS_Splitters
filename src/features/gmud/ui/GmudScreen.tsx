import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ClipboardList, Presentation } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { GmudApprovalModal } from '@/features/gmud/ui/GmudApprovalModal'
import { GmudApprovalQueue } from '@/features/gmud/ui/GmudApprovalQueue'
import { GmudCalendar } from '@/features/gmud/ui/GmudCalendar'
import { GmudWeeklyMeeting } from '@/features/gmud/ui/GmudWeeklyMeeting'
import { GmudLinksModal } from '@/features/gmud/ui/GmudLinksModal'
import { useGmudPendingCount } from '@/features/gmud/hooks/useGmudApprovals'
import { useIsGmudCommitteeMember } from '@/features/gmud/hooks/useGmudCommittee'
import { GmudHeaderActions } from '@/features/gmud/ui/GmudHeaderActions'
import { GmudPainelLista } from '@/features/gmud/ui/GmudPainelLista'
import { GmudSummaryStrip } from '@/features/gmud/ui/GmudSummaryStrip'
import { useGmudListSummary } from '@/features/gmud/api/fetchGmudListSummary'
import { filtrosDaUrl, filtrosParaUrl, type GmudPainelFiltros } from '@/features/gmud/lib/gmudPainelFiltros'
import type { GmudListFilter, GmudListItem } from '@/features/gmud/model/gmud'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-2xl border border-neutral-200/90 dark:border-white/15 bg-surface-container-lowest'
type GmudView = 'all' | 'pending' | 'agenda' | 'reuniao'

export function GmudScreen() {
  const [approving, setApproving] = useState<GmudListItem | null>(null)
  const [linking, setLinking] = useState<GmudListItem | null>(null)
  const [view, setView] = useState<GmudView>('all')
  // Abas já abertas continuam montadas (só escondidas): voltar para uma aba não remonta nem rebusca à toa,
  // e ela mantém o que a pessoa estava vendo (mês da agenda, semana da reunião).
  const [visited, setVisited] = useState<ReadonlySet<GmudView>>(() => new Set<GmudView>(['all']))
  const openView = (next: GmudView) => {
    setView(next)
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)))
  }
  // Filtros do painel: o estado mora na URL (dá para compartilhar o link e voltar com o navegador).
  const [searchParams, setSearchParams] = useSearchParams()
  const filtros = useMemo(() => filtrosDaUrl(searchParams), [searchParams])
  const mudarFiltros = (next: GmudPainelFiltros, opts?: { substituir?: boolean }) => setSearchParams(filtrosParaUrl(next), { replace: opts?.substituir === true })
  // Cartões do topo como atalhos: "Prazo vencido" e "Aguardando Comitê" são as abas Vencidas e Aguardando
  // decisão; "Em aberto" e "Vencem em 7 dias" são filtros próprios. O segundo clique desfaz.
  const cartoesAtivos = useMemo(() => {
    const ativos = new Set<GmudListFilter>()
    if (filtros.aba === 'vencidas') ativos.add('vencidas')
    if (filtros.aba === 'aguardando') ativos.add('comite_pendente')
    if (filtros.kpi === 'abertas') ativos.add('abertas')
    if (filtros.kpi === 'vence7') ativos.add('vencem_semana')
    return ativos
  }, [filtros.aba, filtros.kpi])
  const alternarCartao = (key: GmudListFilter) => {
    const base = { ...filtros, pagina: 0 }
    if (key === 'vencidas') mudarFiltros({ ...base, aba: filtros.aba === 'vencidas' ? 'todas' : 'vencidas' })
    else if (key === 'comite_pendente') mudarFiltros({ ...base, aba: filtros.aba === 'aguardando' ? 'todas' : 'aguardando' })
    else if (key === 'abertas') mudarFiltros({ ...base, kpi: filtros.kpi === 'abertas' ? null : 'abertas' })
    else if (key === 'vencem_semana') mudarFiltros({ ...base, kpi: filtros.kpi === 'vence7' ? null : 'vence7' })
  }
  const queryClient = useQueryClient()
  const atualizarLista = () => void queryClient.invalidateQueries({ queryKey: ['gmud', 'list'] })
  // "Aprovar" (avaliar e fila de pendentes) é do Comitê: só quem está na lista de membros.
  const canApprove = useIsGmudCommitteeMember()
  const canConfigure = useAccessAuthStore((s) => s.hasPermission('canConfigureGmud') || s.hasPermission('isAdmin'))
  const pendingCount = useGmudPendingCount()
  const summaryQuery = useGmudListSummary()

  // Sem permissão de aprovar, a aba de pendentes não existe: mostra a lista.
  const mostraLista = view === 'all' || (view === 'pending' && !canApprove)

  return (
    <div className="mx-auto min-w-0 max-w-[1480px] space-y-4">
      <AppPageHeader
        badge="Gestão de Mudança de Rede"
        title="GMUD"
        description="Requisição, acompanhamento e aprovação de mudanças de rede — integrado ao Elleven."
        icon={ClipboardList}
        primaryAction={{ to: '/', label: 'Voltar ao painel' }}
        trailing={<GmudHeaderActions canConfigure={canConfigure} />}
      />

      <GmudSummaryStrip
        summary={summaryQuery.data}
        ativos={cartoesAtivos}
        onToggle={(key) => {
          openView('all')
          alternarCartao(key)
        }}
      />

      <div className="flex rounded-lg bg-surface-container-low p-0.5 ring-1 ring-neutral-200/70 dark:ring-white/10">
          <button
            type="button"
            onClick={() => openView('all')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition',
              view === 'all'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            Todas as GMUDs
          </button>
          <button
            type="button"
            onClick={() => openView('agenda')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
              view === 'agenda'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <CalendarDays size={14} /> Agenda
          </button>
          <button
            type="button"
            onClick={() => openView('reuniao')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
              view === 'reuniao'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <Presentation size={14} aria-hidden /> Reunião semanal
          </button>
          {canApprove ? (
          <button
            type="button"
            onClick={() => openView('pending')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
              view === 'pending'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            Pendentes de aprovação
            {pendingCount > 0 ? (
              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
          ) : null}
      </div>

      {/* Painéis das abas: o escondido usa `hidden`; ao reaparecer, a classe gmud-fade refaz o fade curto. */}
      {canApprove && visited.has('pending') ? (
        <div hidden={view !== 'pending'} className="gmud-fade">
          <GmudApprovalQueue />
        </div>
      ) : null}
      {visited.has('agenda') ? (
        <div hidden={view !== 'agenda'} className="gmud-fade">
          <GmudCalendar />
        </div>
      ) : null}
      {visited.has('reuniao') ? (
        <div hidden={view !== 'reuniao'} className="gmud-fade">
          <GmudWeeklyMeeting />
        </div>
      ) : null}
      {/* Sem `overflow` no cartão: a tabela rola com a página e o cabeçalho dela fica fixo (sticky). */}
      <div hidden={!mostraLista} className={cn(CARD, 'gmud-fade')}>
        <GmudPainelLista filtros={filtros} onChange={mudarFiltros} canApprove={canApprove} onLink={setLinking} onApprove={setApproving} />
      </div>

      {approving ? (
        <GmudApprovalModal
          gmud={approving}
          onClose={() => setApproving(null)}
          onSaved={() => {
            setApproving(null)
            atualizarLista()
          }}
        />
      ) : null}

      {linking ? <GmudLinksModal gmud={linking} onClose={() => setLinking(null)} /> : null}
    </div>
  )
}
