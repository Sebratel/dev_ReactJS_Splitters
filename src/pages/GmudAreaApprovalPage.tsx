import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Loader2, ShieldAlert, XCircle } from 'lucide-react'
import {
  fetchAreaApprovalInfo,
  readApprovalTokenFromHash,
  submitAreaApproval,
  type AreaApprovalInfo,
  type AreaApprovalOutcome,
} from '@/features/gmud/api/gmudAreaApprovals'
import { formatWindow } from '@/features/gmud/lib/gmudSchedule'
import { GMUD_CATEGORIA_LABEL, type GmudCategoria } from '@/features/gmud/model/gmudForm'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-3xl border border-neutral-200/90 bg-surface-container-lowest p-5 shadow-sm dark:border-white/10 sm:p-7'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-surface px-4 py-8 text-on-surface">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden>
            <ClipboardList size={20} />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Gestão de mudança de rede</p>
            <h1 className="text-xl font-bold">Aprovação de GMUD</h1>
          </div>
        </header>
        {children}
      </div>
    </main>
  )
}

function Notice({ tone, title, children }: { tone: 'neutral' | 'success' | 'danger'; title: string; children?: React.ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? XCircle : ShieldAlert
  const color =
    tone === 'success' ? 'text-emerald-600 dark:text-emerald-300'
    : tone === 'danger' ? 'text-rose-600 dark:text-rose-300'
    : 'text-amber-600 dark:text-amber-300'
  return (
    <section className={cn(CARD, 'flex items-start gap-3')} role="status">
      <Icon className={cn('mt-0.5 shrink-0', color)} size={22} aria-hidden />
      <div className="space-y-1">
        <h2 className="text-base font-bold">{title}</h2>
        {children ? <div className="text-sm text-on-surface-variant">{children}</div> : null}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  if (value.trim() === '') return null
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm">{value}</dd>
    </div>
  )
}

function whenLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

function Summary({ info }: { info: AreaApprovalInfo }) {
  const g = info.gmud
  const janela = g.dataInicio && g.dataFim ? formatWindow({ dataInicio: g.dataInicio, horaInicio: g.horaInicio, dataFim: g.dataFim, horaFim: g.horaFim }) : ''
  const categoria = GMUD_CATEGORIA_LABEL[g.categoria as GmudCategoria] ?? ''
  return (
    <section className={cn(CARD, 'space-y-4')}>
      <div>
        <p className="font-mono text-xs text-on-surface-variant">GMUD {g.protocolo}</p>
        <h2 className="text-lg font-bold">{g.titulo || 'GMUD'}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Aprovação da área <span className="font-semibold text-on-surface">{info.area}</span> · {info.approver}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label="Tipo" value={g.tipo} />
        <Row label="Categoria" value={categoria} />
        <Row label="Janela de execução" value={janela} />
        <Row label="POP / Site" value={g.popSite} />
        <Row label="Abrangência na rede" value={g.escopoRede ?? ''} />
        <Row label="Solicitante" value={g.solicitante} />
      </dl>
      {g.descricao.trim() !== '' ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">Descrição</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{g.descricao}</p>
        </div>
      ) : null}
    </section>
  )
}

function Outcome({ outcome }: { outcome: AreaApprovalOutcome }) {
  if (outcome.decision === 'aprovada') {
    return (
      <Notice tone="success" title="Aprovação registrada">
        {outcome.gmudAprovada === true
          ? 'Obrigado. Todas as áreas aprovaram: a GMUD está aprovada.'
          : 'Obrigado. Quando todas as áreas aprovarem, a GMUD fica aprovada.'}
      </Notice>
    )
  }
  return (
    <Notice tone="danger" title="Negativa registrada">
      A GMUD foi negada.{' '}
      {outcome.canceladoNoElleven === true
        ? 'O protocolo foi cancelado no Elleven.'
        : 'O cancelamento do protocolo no Elleven não foi concluído; o Comitê vai cuidar disso.'}
    </Notice>
  )
}

export function GmudAreaApprovalPage() {
  const { hash } = useLocation()
  const token = readApprovalTokenFromHash(hash)
  const [denying, setDenying] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [outcome, setOutcome] = useState<AreaApprovalOutcome | null>(null)

  const query = useQuery({
    queryKey: ['gmud', 'area-approval', 'info', token],
    queryFn: () => fetchAreaApprovalInfo(token),
    enabled: token !== '',
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const decide = useMutation({
    mutationFn: (decision: 'aprovada' | 'negada') =>
      submitAreaApproval({ token, decision, motivo: decision === 'negada' ? motivo.trim() : undefined }),
    onSuccess: setOutcome,
  })

  if (token === '') {
    return (
      <Shell>
        <Notice tone="neutral" title="Link incompleto">Abra o pedido pelo link que você recebeu por e-mail.</Notice>
      </Shell>
    )
  }
  if (query.isPending) {
    return (
      <Shell>
        <div className={cn(CARD, 'flex items-center gap-2 text-sm text-on-surface-variant')}>
          <Loader2 size={16} className="animate-spin" aria-hidden /> Carregando o pedido…
        </div>
      </Shell>
    )
  }
  if (query.isError || !query.data) {
    return (
      <Shell>
        <Notice tone="neutral" title="Link inválido ou expirado">
          Peça ao solicitante da GMUD para reenviar o pedido, ou procure o Comitê.
        </Notice>
      </Shell>
    )
  }

  const info = query.data
  if (outcome) {
    return (
      <Shell>
        <Summary info={info} />
        <Outcome outcome={outcome} />
      </Shell>
    )
  }

  if (info.state === 'decided') {
    return (
      <Shell>
        <Summary info={info} />
        <Notice tone={info.decision === 'aprovada' ? 'success' : 'danger'} title={`Esta área já ${info.decision === 'aprovada' ? 'aprovou' : 'negou'} a GMUD`}>
          {info.decidedByName ? `${info.decidedByName} · ` : ''}
          {whenLabel(info.decidedAt)}
        </Notice>
      </Shell>
    )
  }
  if (info.state === 'closed') {
    return (
      <Shell>
        <Summary info={info} />
        <Notice tone="danger" title="Esta GMUD já foi negada">Outra área negou a GMUD; não há mais o que decidir.</Notice>
      </Shell>
    )
  }
  if (info.state === 'expired') {
    return (
      <Shell>
        <Summary info={info} />
        <Notice tone="neutral" title="Este link expirou">Procure o Comitê para aprovar em nome da área.</Notice>
      </Shell>
    )
  }

  return (
    <Shell>
      <Summary info={info} />
      <section className={cn(CARD, 'space-y-4')}>
        <p className="text-sm text-on-surface-variant">
          Basta uma pessoa da área decidir. Se você negar, a GMUD fica negada e o protocolo é cancelado no Elleven.
        </p>

        {denying ? (
          <div className="space-y-2">
            <label htmlFor="motivo" className="block text-xs font-semibold text-on-surface-variant">
              Motivo da negativa (obrigatório)
            </label>
            <textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              className="min-h-[90px] w-full rounded-xl border border-neutral-200 bg-surface-container-lowest px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-white/10"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {denying ? (
            <>
              <button
                type="button"
                disabled={decide.isPending || motivo.trim().length < 3}
                onClick={() => decide.mutate('negada')}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {decide.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Confirmar negativa
              </button>
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => { setDenying(false); setMotivo('') }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-on-surface-variant ring-1 ring-neutral-200 transition hover:bg-surface-container-low dark:ring-white/10"
              >
                Voltar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate('aprovada')}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {decide.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Aprovar
              </button>
              <button
                type="button"
                disabled={decide.isPending}
                onClick={() => setDenying(true)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-300 transition hover:bg-rose-50 dark:text-rose-200 dark:ring-rose-800/60 dark:hover:bg-rose-950/40"
              >
                <XCircle size={14} /> Negar
              </button>
            </>
          )}
        </div>

        {decide.isError ? (
          <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
            {decide.error instanceof Error ? decide.error.message : 'Não foi possível registrar a decisão.'}
          </p>
        ) : null}
      </section>
    </Shell>
  )
}
