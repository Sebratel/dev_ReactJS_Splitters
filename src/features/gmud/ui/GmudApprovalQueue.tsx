import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import { usePendingGmuds } from '@/features/gmud/hooks/useGmudApprovals'
import {
  updateGmudApproval,
  type GmudStatusComite,
} from '@/features/gmud/api/updateGmudApproval'
import { buildGmudCloseDescription, closeGmudInElleven } from '@/features/gmud/api/closeGmudInElleven'
import { GMUD_RECURSO_PAPEIS } from '@/features/gmud/model/gmudForm'
import type { GmudPendingItem } from '@/features/gmud/api/gmudApprovals'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest'

function fmtDate(iso: string | null): string {
  if (!iso || iso.length < 10) return iso || '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
function janela(g: GmudPendingItem): string {
  const ini = g.dataInicio ? `${fmtDate(g.dataInicio)}${g.horaInicio ? ` ${g.horaInicio}` : ''}` : '—'
  const fim = g.dataFim ? `${fmtDate(g.dataFim)}${g.horaFim ? ` ${g.horaFim}` : ''}` : '—'
  return `${ini}  →  ${fim}`
}
function recursos(g: GmudPendingItem): string {
  const r = g.recursosAdministrativos ?? {}
  const parts = Object.entries(r)
    .filter(([, papel]) => papel && papel !== 'na')
    .map(([area, papel]) => `${area}: ${GMUD_RECURSO_PAPEIS.find((p) => p.value === papel)?.label ?? papel}`)
  return parts.join('  •  ')
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const v = (value ?? '').toString().trim()
  if (v === '') return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-on-surface">{v}</p>
    </div>
  )
}

function PendingCard({
  gmud,
  onDecide,
  pending,
}: {
  gmud: GmudPendingItem
  onDecide: (gmud: GmudPendingItem, status: GmudStatusComite) => void
  pending: boolean
}) {
  const protocol = gmud.voalleProtocol
  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200/70 dark:border-white/10 bg-amber-50/40 dark:bg-amber-950/10 p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface">
            <span className="font-mono">{protocol ?? '—'}</span>
            {gmud.tipo ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{gmud.tipo}</span> : null}
            {gmud.popSite ? <span className="ml-1.5 text-xs font-normal text-on-surface-variant">{gmud.popSite}</span> : null}
          </p>
          <p className="mt-0.5 text-sm text-on-surface">{gmud.titulo || '—'}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Solicitante: {gmud.solicitanteNome || gmud.solicitanteEmail || '—'}
            {gmud.areaSolicitante ? ` · ${gmud.areaSolicitante}` : ''} · Janela: {janela(gmud)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={pending || protocol == null}
            onClick={() => protocol != null && onDecide(gmud, 'negada')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800/60 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-200 transition hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Negar
          </button>
          <button
            type="button"
            disabled={pending || protocol == null}
            onClick={() => protocol != null && onDecide(gmud, 'aprovada')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Aprovar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <Field label="Assunto da mudança" value={gmud.assunto} />
        <Field label="Comunica cliente" value={gmud.comunicaCliente} />
        <Field label="Impacto de parada" value={gmud.impactoParada} />
        <div className="sm:col-span-2">
          <Field label="Ambiente afetado" value={(gmud.ambienteAfetado ?? []).join('; ')} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Descrição da atividade" value={gmud.descricao} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Plano de execução" value={gmud.planoExecucao} />
        </div>
        <div className="sm:col-span-2">
          <Field label="Plano de rollback" value={gmud.planoRollback} />
        </div>
        <Field label="Risco da não implementação" value={gmud.riscoNaoImplementacao} />
        <Field label="Risco durante a execução" value={gmud.riscoExecucao} />
        <div className="sm:col-span-2">
          <Field label="Recursos administrativos" value={recursos(gmud)} />
        </div>
        <Field label="Lista de clientes ao COR" value={gmud.listaClientesCor} />
      </div>
    </div>
  )
}

export function GmudApprovalQueue() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = usePendingGmuds(true)
  const profile = useAccessAuthStore((s) => s.profile)
  const currentUser = profile?.displayName || profile?.email || ''

  const mutation = useMutation({
    mutationFn: async ({ gmud, status }: { gmud: GmudPendingItem; status: GmudStatusComite }) => {
      const protocol = gmud.voalleProtocol
      if (protocol == null) throw new Error('GMUD sem protocolo.')

      // "Negar" encerra o protocolo no Elleven (cancelamento). Confirmação obrigatória — é uma
      // ação real em produção. "Aprovar" não encerra nada.
      if (status === 'negada') {
        const jaEncerrado = Boolean(gmud.ellevenEncerradoEm)
        const assignmentId = gmud.assignmentId
        if (!jaEncerrado && assignmentId != null) {
          const ok = window.confirm(
            `Negar esta GMUD vai ENCERRAR o protocolo ${protocol} no Elleven (cancelamento). Confirmar?`,
          )
          if (!ok) return { aborted: true }
          await closeGmudInElleven({
            assignmentId,
            mode: 'negada',
            description: buildGmudCloseDescription('negada', currentUser),
          })
          await updateGmudApproval({
            voalleProtocol: protocol,
            statusComite: 'negada',
            ellevenEncerrado: { status: 'negada' },
          })
          return { aborted: false }
        }
        // Sem assignmentId (GMUD antiga/só no Voalle) ou já encerrado: só registra a decisão.
        const ok = window.confirm(
          jaEncerrado
            ? `O protocolo ${protocol} já foi encerrado no Elleven. Marcar a GMUD como negada?`
            : `Não identifiquei o atendimento no Elleven (assignmentId) do protocolo ${protocol}. ` +
                `A GMUD será marcada como negada, mas o protocolo deve ser encerrado manualmente no Elleven. Continuar?`,
        )
        if (!ok) return { aborted: true }
        await updateGmudApproval({ voalleProtocol: protocol, statusComite: 'negada' })
        return { aborted: false }
      }

      await updateGmudApproval({ voalleProtocol: protocol, statusComite: status })
      return { aborted: false }
    },
    onSuccess: (result) => {
      if (result?.aborted) return
      void queryClient.invalidateQueries({ queryKey: ['gmud', 'pending'] })
      void queryClient.invalidateQueries({ queryKey: ['gmud', 'pending-count'] })
      void queryClient.invalidateQueries({ queryKey: ['gmud', 'list'] })
    },
  })

  const items = data ?? []

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-on-surface-variant">Carregando pendentes…</p>
  }
  if (isError) {
    return (
      <div className={cn(CARD, 'p-8 text-center')}>
        <p className="text-sm font-semibold text-red-600 dark:text-red-300">
          {error instanceof Error ? error.message : 'Falha ao carregar as GMUDs pendentes.'}
        </p>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className={cn(CARD, 'p-10 text-center text-sm text-on-surface-variant')}>
        Nenhuma GMUD aguardando aprovação. 🎉
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {mutation.isError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {mutation.error instanceof Error ? mutation.error.message : 'Falha ao registrar a decisão.'}
        </div>
      ) : null}
      {items.map((g) => (
        <PendingCard
          key={g.voalleProtocol ?? g.createdAt}
          gmud={g}
          pending={mutation.isPending}
          onDecide={(gmud, status) => mutation.mutate({ gmud, status })}
        />
      ))}
    </div>
  )
}
