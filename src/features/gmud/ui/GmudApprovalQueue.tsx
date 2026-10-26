import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'
import { usePendingGmuds } from '@/features/gmud/hooks/useGmudApprovals'
import {
  updateGmudApproval,
  type GmudStatusComite,
} from '@/features/gmud/api/updateGmudApproval'
import { buildGmudCloseDescription, closeGmudInElleven } from '@/features/gmud/api/closeGmudInElleven'
import { GMUD_RECURSO_PAPEIS, type GmudSistemasInternosData, type GmudSistemasExternosData } from '@/features/gmud/model/gmudForm'
import type { GmudPendingItem } from '@/features/gmud/api/gmudApprovals'
import { GmudSistemasInternosCard, GmudSistemasExternosCard } from '@/features/gmud/ui/detail/GmudCategoryDataCards'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest'

function fmtDate(iso: string | null): string {
  if (!iso || iso.length < 10) return iso || '—'
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
function janela(g: GmudPendingItem): string {
  const ini = g.dataInicio ? `${fmtDate(g.dataInicio)}${g.horaInicio ? ` ${g.horaInicio}` : ''}` : '—'
  const fim = g.dataFim ? `${fmtDate(g.dataFim)}${g.horaFim ? ` ${g.horaFim}` : ''}` : '—'
  return `${ini} → ${fim}`
}
function recursos(g: GmudPendingItem): string {
  const r = g.recursosAdministrativos ?? {}
  const parts = Object.entries(r)
    .filter(([, papel]) => papel && papel !== 'na')
    .map(([area, papel]) => `${area}: ${GMUD_RECURSO_PAPEIS.find((p) => p.value === papel)?.label ?? papel}`)
  return parts.join(' • ')
}

function Chip({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-xs ring-1',
      danger
        ? 'bg-rose-50 ring-rose-200 text-rose-700 dark:bg-rose-950/30 dark:ring-rose-800/40 dark:text-rose-300'
        : 'bg-surface-container-low ring-neutral-200/70 dark:ring-white/10 text-on-surface-variant',
    )}>
      <span className="font-semibold text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      {value}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const v = (value ?? '').toString().trim()
  if (v === '') return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/60">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-xs text-on-surface">{v}</p>
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
  const [expanded, setExpanded] = useState(false)
  const protocol = gmud.voalleProtocol
  const ambienteStr = (gmud.ambienteAfetado ?? []).join('; ')
  const recursosStr = recursos(gmud)

  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      {/* ── Cabeçalho compacto ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 bg-amber-50/50 dark:bg-amber-950/10 border-b border-neutral-200/70 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-on-surface">{protocol ?? '—'}</span>
            {gmud.tipo ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{gmud.tipo}</span>
            ) : null}
            {gmud.popSite ? (
              <span className="text-xs text-on-surface-variant">{gmud.popSite}</span>
            ) : null}
            <span className="text-xs text-on-surface-variant">·</span>
            <span className="text-xs text-on-surface-variant truncate max-w-[260px]">
              {gmud.solicitanteNome || gmud.solicitanteEmail || '—'}
              {gmud.areaSolicitante ? ` · ${gmud.areaSolicitante}` : ''}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-on-surface leading-snug">{gmud.titulo || '—'}</p>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">📅 {janela(gmud)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={pending || protocol == null}
            onClick={() => protocol != null && onDecide(gmud, 'negada')}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 dark:border-rose-800/60 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-200 transition hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Negar
          </button>
          <button
            type="button"
            disabled={pending || protocol == null}
            onClick={() => protocol != null && onDecide(gmud, 'aprovada')}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Aprovar
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Recolher detalhes' : 'Ver detalhes'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant ring-1 ring-neutral-200/70 dark:ring-white/10 transition hover:bg-surface-container-low"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── Linha de chips (sempre visível) ── */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-neutral-200/50 dark:border-white/5">
        {gmud.assunto ? <Chip label="Assunto" value={gmud.assunto} /> : null}
        {gmud.impactoParada ? <Chip label="Impacto" value={gmud.impactoParada} danger={gmud.impactoParada === 'Sim'} /> : null}
        {gmud.comunicaCliente ? <Chip label="Comunica cliente" value={gmud.comunicaCliente} /> : null}
        {ambienteStr ? <Chip label="Ambiente" value={ambienteStr} /> : null}
        {gmud.listaClientesCor ? <Chip label="COR" value={gmud.listaClientesCor} /> : null}
      </div>

      {/* ── Detalhes expansíveis ── */}
      {expanded ? (
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
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
          {recursosStr ? (
            <div className="sm:col-span-2">
              <Field label="Recursos administrativos" value={recursosStr} />
            </div>
          ) : null}

          {gmud.categoria === 'sistemas_internos' && gmud.categoriaData ? (
            <div className="sm:col-span-2 border-t border-neutral-200/60 dark:border-white/5 pt-3">
              <GmudSistemasInternosCard data={gmud.categoriaData as GmudSistemasInternosData} />
            </div>
          ) : null}
          {gmud.categoria === 'sistemas_externos' && gmud.categoriaData ? (
            <div className="sm:col-span-2 border-t border-neutral-200/60 dark:border-white/5 pt-3">
              <GmudSistemasExternosCard data={gmud.categoriaData as GmudSistemasExternosData} />
            </div>
          ) : null}
        </div>
      ) : null}
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
