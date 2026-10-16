import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Ban, CalendarClock, CheckCircle2, ClipboardList, Gavel, Link2, ListTree } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { fetchGmudDetail, type GmudDetail } from '@/features/gmud/api/gmudDetail'
import type { GmudAgendaItem } from '@/features/gmud/api/gmudAgenda'
import type { GmudListItem } from '@/features/gmud/model/gmud'
import { gmudDisplayTitle } from '@/features/gmud/lib/gmudTitle'
import { htmlToPlainText } from '@/features/gmud/lib/gmudText'
import { gmudDeadline } from '@/features/gmud/lib/gmudDeadline'
import { buildGmudTimeline } from '@/features/gmud/lib/gmudTimeline'
import { GmudApprovalModal } from '@/features/gmud/ui/GmudApprovalModal'
import { GmudLinksModal } from '@/features/gmud/ui/GmudLinksModal'
import { GmudRescheduleModal } from '@/features/gmud/ui/GmudRescheduleModal'
import { GmudLinkedMassivasCard, GmudScopeCard, GmudTimelineCard } from '@/features/gmud/ui/detail/GmudDetailCards'
import { GmudDetailSummary } from '@/features/gmud/ui/detail/GmudDetailSummary'
import { buildGmudCloseDescription, closeGmudInElleven } from '@/features/gmud/api/closeGmudInElleven'
import { updateGmudApproval } from '@/features/gmud/api/updateGmudApproval'
import { gmudPodeAvaliar, gmudPodeCancelar, gmudPodeConcluir } from '@/features/gmud/lib/gmudLifecycle'
import { CARD } from '@/features/gmud/ui/indicators/indicatorTheme'
import { cn } from '@/shared/lib/utils'

/** Adapta o detalhe ao formato que os modais existentes (avaliar/vincular) já usam. */
function toListItem(d: GmudDetail): GmudListItem {
  const r = d.request
  const assignmentId = r?.assignmentId ?? d.voalle.assignmentId ?? null
  return {
    protocol: d.voalle.protocol,
    assignmentId,
    title: d.voalle.title,
    description: d.voalle.description,
    openedAt: d.voalle.openedAt,
    slaDate: d.voalle.slaDate,
    conclusionDate: d.voalle.conclusionDate,
    status: d.voalle.status,
    requester: d.voalle.requester,
    requesterEmail: d.voalle.requesterEmail,
    massivaLinksCount: d.links.length,
    extra: r
      ? {
          assignmentId,
          tipo: r.tipo,
          assunto: r.assunto,
          popSite: r.popSite,
          impactoParada: r.impactoParada,
          comunicaCliente: r.comunicaCliente,
          statusComite: r.statusComite,
          statusExec: r.statusExec,
          rnc: r.rnc,
          dataCab: r.dataCab,
          ambienteAfetado: r.ambienteAfetado,
          ellevenEncerradoEm: r.ellevenEncerradoEm,
          ellevenEncerradoStatus: r.ellevenEncerradoStatus,
        }
      : null,
  }
}

function toAgendaItem(d: GmudDetail): GmudAgendaItem | null {
  const r = d.request
  if (!r?.dataInicio || !r.horaInicio) return null
  return {
    voalleProtocol: d.voalle.protocol,
    assignmentId: r.assignmentId ?? d.voalle.assignmentId,
    titulo: r.titulo,
    tipo: r.tipo,
    assunto: r.assunto,
    popSite: r.popSite,
    statusExec: r.statusExec,
    ellevenEncerradoEm: r.ellevenEncerradoEm,
    ellevenStatusId: d.voalle.statusId,
    ellevenStatus: d.voalle.status,
    dataInicio: r.dataInicio,
    horaInicio: r.horaInicio,
    dataFim: r.dataFim || r.dataInicio,
    horaFim: r.horaFim || r.horaInicio,
  }
}

const ACTION =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-40'

export function GmudDetailScreen() {
  const { protocol: raw } = useParams()
  const protocol = Number.parseInt(String(raw ?? ''), 10)
  const canApprove = useAccessAuthStore((s) => s.hasPermission('canApproveGmud'))
  const [modal, setModal] = useState<'approve' | 'links' | 'reschedule' | null>(null)

  const query = useQuery({
    queryKey: ['gmud', 'detail', protocol],
    queryFn: () => fetchGmudDetail(protocol),
    enabled: Number.isFinite(protocol) && protocol > 0,
  })
  const d = query.data
  const timeline = useMemo(
    () =>
      d
        ? buildGmudTimeline({
            openedAt: d.voalle.openedAt,
            conclusionDate: d.voalle.conclusionDate,
            voalleStatus: d.voalle.status,
            events: d.events,
          })
        : [],
    [d],
  )

  const profile = useAccessAuthStore((s) => s.profile)
  const currentUser = profile?.displayName || profile?.email || ''

  // Concluir (encerra no Elleven, status 4) ou Cancelar (status 8). Ambos exigem confirmação
  // e marcam o encerramento no nosso banco — o que torna a GMUD terminal (some os botões).
  const closeMutation = useMutation({
    mutationFn: async (mode: 'concluida' | 'cancelada') => {
      const data = query.data
      if (!data) return { aborted: true }
      const assignmentId = data.request?.assignmentId ?? data.voalle.assignmentId ?? null
      const verbo = mode === 'concluida' ? 'CONCLUIR' : 'CANCELAR'
      const efeito = mode === 'concluida' ? 'ENCERRAR' : 'CANCELAR'
      const ok = window.confirm(
        assignmentId != null
          ? `${verbo} esta GMUD vai ${efeito} o protocolo ${protocol} no Elleven. Confirmar?`
          : `Não identifiquei o atendimento no Elleven (assignmentId) do protocolo ${protocol}. ` +
              `A GMUD será marcada como ${mode}, mas encerre o protocolo manualmente no Elleven. Continuar?`,
      )
      if (!ok) return { aborted: true }
      if (assignmentId != null) {
        await closeGmudInElleven({ assignmentId, mode, description: buildGmudCloseDescription(mode, currentUser) })
      }
      await updateGmudApproval({
        voalleProtocol: protocol,
        ...(mode === 'concluida' ? { statusExec: 'concluida' as const } : {}),
        ellevenEncerrado: { status: mode },
      })
      return { aborted: false }
    },
    onSuccess: (r) => {
      if (!r?.aborted) void query.refetch()
    },
  })

  if (!Number.isFinite(protocol) || protocol <= 0) {
    return <div className={cn(CARD, 'mx-auto max-w-xl p-8 text-center text-sm')}>Protocolo inválido.</div>
  }

  const title = d ? (d.request?.titulo || gmudDisplayTitle({ title: d.voalle.title, protocol, requester: d.voalle.requester, descriptionText: htmlToPlainText(d.voalle.description) })) : `GMUD ${protocol}`
  const listItem = d ? toListItem(d) : null
  const agendaItem = d ? toAgendaItem(d) : null
  const approved = d?.request?.statusComite === 'aprovada'
  const closed = Boolean(d?.request?.ellevenEncerradoEm || d?.voalle.conclusionDate)

  return (
    <div className="mx-auto min-w-0 max-w-[1280px] space-y-4">
      <AppPageHeader
        badge={`GMUD ${protocol}`}
        title={title}
        description={d ? `${d.voalle.requester || 'Solicitante não informado'} · ${d.request ? 'Aberta pela plataforma' : 'Legado (Voalle)'}` : 'Carregando…'}
        icon={ClipboardList}
        primaryAction={{ to: '/gmud', label: 'Voltar às GMUDs' }}
      />

      {query.isLoading ? (
        <div className={cn(CARD, 'p-10 text-center text-sm text-on-surface-variant')}>Carregando a GMUD…</div>
      ) : query.isError || !d || !listItem ? (
        <div className={cn(CARD, 'p-8 text-center text-sm font-semibold text-red-600 dark:text-red-300')}>
          {query.error instanceof Error ? query.error.message : 'Falha ao carregar a GMUD.'}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && gmudPodeAvaliar(listItem) ? (
              <button
                type="button"
                onClick={() => setModal('approve')}
                className={cn(ACTION, 'bg-primary text-white ring-primary hover:bg-primary/90')}
              >
                <Gavel size={14} /> Avaliar
              </button>
            ) : null}
            {canApprove && gmudPodeConcluir(listItem) ? (
              <button
                type="button"
                onClick={() => closeMutation.mutate('concluida')}
                disabled={closeMutation.isPending}
                className={cn(ACTION, 'bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700 disabled:opacity-60')}
              >
                <CheckCircle2 size={14} /> Concluir GMUD
              </button>
            ) : null}
            {canApprove && gmudPodeCancelar(listItem) ? (
              <button
                type="button"
                onClick={() => closeMutation.mutate('cancelada')}
                disabled={closeMutation.isPending}
                title="Cancela a mudança e encerra o protocolo no Elleven"
                className={cn(ACTION, 'text-rose-700 ring-rose-300 hover:bg-rose-50 dark:text-rose-200 dark:ring-rose-800/60 dark:hover:bg-rose-950/40 disabled:opacity-60')}
              >
                <Ban size={14} /> Cancelar GMUD
              </button>
            ) : null}
            <button type="button" onClick={() => setModal('links')} className={cn(ACTION, 'text-on-surface ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10')}>
              <Link2 size={14} /> Massivas ({d.links.length})
            </button>
            {canApprove && agendaItem ? (
              <button
                type="button"
                onClick={() => setModal('reschedule')}
                disabled={!approved || closed}
                title={!approved ? 'Só GMUD aprovada pode ser reagendada' : closed ? 'GMUD encerrada' : undefined}
                className={cn(ACTION, 'text-on-surface ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10')}
              >
                <CalendarClock size={14} /> Reagendar
              </button>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
              <ListTree size={14} /> {d.events.length} evento{d.events.length === 1 ? '' : 's'} na trilha
            </span>
          </div>

          {closeMutation.isError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
              {closeMutation.error instanceof Error ? closeMutation.error.message : 'Falha ao encerrar a GMUD no Elleven.'}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <GmudScopeCard request={d.request} voalleDescription={d.voalle.description} />
              <GmudLinkedMassivasCard links={d.links} onManage={() => setModal('links')} />
            </div>
            <div className="space-y-4">
              <GmudDetailSummary detail={d} deadline={gmudDeadline(d.voalle)} />
              <GmudTimelineCard items={timeline} />
            </div>
          </div>

          {modal === 'approve' ? (
            <GmudApprovalModal
              gmud={listItem}
              onClose={() => setModal(null)}
              onSaved={() => {
                setModal(null)
                void query.refetch()
              }}
            />
          ) : null}
          {modal === 'links' ? (
            <GmudLinksModal
              gmud={listItem}
              onClose={() => {
                setModal(null)
                void query.refetch()
              }}
            />
          ) : null}
          {modal === 'reschedule' && agendaItem ? (
            <GmudRescheduleModal
              item={agendaItem}
              initialWindow={{
                dataInicio: agendaItem.dataInicio,
                horaInicio: agendaItem.horaInicio,
                dataFim: agendaItem.dataFim,
                horaFim: agendaItem.horaFim,
              }}
              canReschedule={canApprove}
              onClose={() => setModal(null)}
              onDone={() => void query.refetch()}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
