import { useMemo } from 'react'
import { AlertTriangle, Building2, Home, Lightbulb, TrendingDown, Zap } from 'lucide-react'
import { useSplitterCancellations } from '@/features/cancellations/hooks/useSplitterCancellations'
import {
  CANCELLATION_CATEGORY_LABELS,
  CANCELLATION_CATEGORY_ORDER,
} from '@/features/cancellations/model/cancellationsSummary'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type SplitterCancellationsSectionProps = {
  splitterTitle?: string | null
  /** Data da última massiva do splitter (para correlação churn × evento). */
  latestMassivaAt?: Date | null
  /** Classificação do local (do cadastro do splitter). */
  tipoLocal?: 'CONDOMÍNIO' | 'UNIDADE'
  nomeCondominio?: string | null
}

const WINDOW_DAYS = 30

function startIso12mAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d.toISOString().slice(0, 10)
}

const CATEGORY_DOT: Record<string, string> = {
  rede: 'bg-rose-500',
  tecnico: 'bg-amber-500',
  financeiro: 'bg-slate-400',
  pre_instalacao: 'bg-sky-400',
  mudanca: 'bg-violet-400',
  operacional: 'bg-neutral-300 dark:bg-white/15',
  outros: 'bg-neutral-200 dark:bg-white/10',
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const idx = Number.parseInt(m ?? '', 10) - 1
  return idx >= 0 && idx < 12 ? `${months[idx]}/${(y ?? '').slice(2)}` : key
}

export function SplitterCancellationsSection({
  splitterTitle,
  latestMassivaAt,
  tipoLocal,
  nomeCondominio,
}: SplitterCancellationsSectionProps) {
  const startIso = useMemo(startIso12mAgo, [])
  const title = splitterTitle?.trim() ?? ''

  const params = useMemo(() => {
    if (title === '') return null
    return {
      title,
      startIso,
      eventAt:
        latestMassivaAt && !Number.isNaN(latestMassivaAt.getTime())
          ? latestMassivaAt.toISOString()
          : null,
      windowDays: WINDOW_DAYS,
    }
  }, [title, startIso, latestMassivaAt])

  const query = useSplitterCancellations(params)

  const card = (children: React.ReactNode) => (
    <section
      className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm"
      aria-labelledby="splitter-cancellations-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-300/40 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300">
          <TrendingDown size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Voalle · últimos 12 meses
          </p>
          <h2
            id="splitter-cancellations-heading"
            className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
          >
            Cancelamentos deste splitter
          </h2>
        </div>
        {tipoLocal === 'CONDOMÍNIO' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/50 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-200">
            <Building2 size={12} aria-hidden />
            Condomínio{nomeCondominio ? `: ${nomeCondominio}` : ''}
          </span>
        ) : tipoLocal === 'UNIDADE' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-white/10 bg-surface-container-low px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
            <Home size={12} aria-hidden />
            Rua / unidade
          </span>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )

  if (title === '') {
    return card(
      <p className="text-sm text-on-surface-variant/70">
        Splitter sem título de rede — não é possível cruzar com os cancelamentos da Voalle.
      </p>,
    )
  }

  if (query.isPending) {
    return card(<LoadingState label="Carregando cancelamentos vinculados…" />)
  }

  if (query.isError) {
    return card(
      <ErrorState message={formatQueryError(query.error)} onRetry={() => query.refetch()} />,
    )
  }

  const data = query.data
  const totalRede = data.totalsByCategory.rede
  const redeShare = data.total > 0 ? Math.round((totalRede / data.total) * 100) : 0
  const post = data.postEvent
  const maxMonth = data.monthly.reduce((max, m) => Math.max(max, m.total), 0)

  const redeReading =
    redeShare >= 40
      ? 'a rede pesa bastante no churn deste splitter.'
      : redeShare >= 20
        ? 'a rede tem peso relevante no churn aqui.'
        : 'a maior parte do churn aqui não é por rede.'
  const postReading = post
    ? post.redeCount > 0
      ? ` Após a última massiva, ${post.redeCount} cancelamento(s) de rede em ${post.windowDays} dias — vale investigar.`
      : ' A última massiva não foi seguida de churn de rede na janela.'
    : ''

  if (data.total === 0) {
    return card(
      <p className="text-sm text-on-surface-variant/70">
        Nenhum cancelamento vinculado a este splitter nos últimos 12 meses. 🎉
      </p>,
    )
  }

  return card(
    <div className="space-y-4">
      {/* Leitura rápida */}
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-sm leading-snug text-on-surface-variant/90 ring-1 ring-outline-variant/40">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        <span>
          Dos <span className="font-semibold text-on-surface">{data.total.toLocaleString('pt-BR')}</span>{' '}
          cancelamentos em 12 meses,{' '}
          <span className="font-semibold text-rose-600 dark:text-rose-300">{totalRede.toLocaleString('pt-BR')} ({redeShare}%)</span>{' '}
          foram por rede/qualidade — {redeReading}
          {postReading}
        </span>
      </p>

      {/* Resumo */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <p className="text-2xl font-bold tabular-nums text-on-surface">
            {data.total.toLocaleString('pt-BR')}
          </p>
          <p className="text-[11px] text-on-surface-variant/60">cancelamentos no período</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-300">
            {totalRede.toLocaleString('pt-BR')}
            <span className="ml-1 text-sm font-semibold text-rose-500">({redeShare}%)</span>
          </p>
          <p className="text-[11px] text-on-surface-variant/60">rede / qualidade</p>
        </div>
      </div>

      {/* Correlação com a última massiva */}
      {post ? (
        <div
          className={`flex items-start gap-3 rounded-xl border p-3 ${
            post.redeCount > 0
              ? 'border-rose-300/60 bg-rose-50/70 dark:bg-rose-950/40'
              : 'border-emerald-300/50 bg-emerald-50/60 dark:bg-emerald-950/40'
          }`}
        >
          <Zap
            size={16}
            strokeWidth={2}
            className={post.redeCount > 0 ? 'mt-0.5 text-rose-600 dark:text-rose-300' : 'mt-0.5 text-emerald-600 dark:text-emerald-300'}
            aria-hidden
          />
          <div className="min-w-0 text-sm leading-snug">
            <p className="font-semibold text-on-surface">
              Após a última massiva ({fmtDate(post.at)}) · janela de {post.windowDays} dias
            </p>
            <p className="mt-0.5 text-on-surface-variant/80">
              {post.totalCount === 0 ? (
                'Nenhum cancelamento na janela pós-evento.'
              ) : (
                <>
                  <span className="font-bold text-rose-600 dark:text-rose-300">{post.redeCount}</span> de rede/qualidade
                  {' '}de <span className="font-semibold">{post.totalCount}</span> cancelamentos no
                  período. {post.redeCount > 0
                    ? 'Vale investigar se o evento influenciou o churn nesta área.'
                    : 'Churn não parece ligado à rede.'}
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}

      {/* Categorias */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CANCELLATION_CATEGORY_ORDER.filter((cat) => data.totalsByCategory[cat] > 0).map((cat) => {
          const value = data.totalsByCategory[cat]
          const isRede = cat === 'rede'
          return (
            <div
              key={cat}
              className={`rounded-lg border px-2.5 py-2 ${
                isRede ? 'border-rose-300 bg-rose-50/70 dark:bg-rose-950/40' : 'border-outline-variant/60 bg-surface-container-lowest'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${CATEGORY_DOT[cat]}`} aria-hidden />
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/60">
                  {CANCELLATION_CATEGORY_LABELS[cat]}
                </p>
              </div>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  isRede ? 'text-rose-700 dark:text-rose-200' : 'text-on-surface'
                }`}
              >
                {value.toLocaleString('pt-BR')}
              </p>
            </div>
          )
        })}
      </div>

      {/* Mini-tendência mensal */}
      {data.monthly.length > 1 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-on-surface-variant/70">
            Tendência mensal (barra cheia = total; rosa = rede)
          </p>
          <div className="flex items-end gap-1.5" style={{ height: 56 }}>
            {data.monthly.map((m) => {
              const totalH = maxMonth > 0 ? Math.max(3, (m.total / maxMonth) * 48) : 3
              const redeH = m.total > 0 ? (m.rede / m.total) * totalH : 0
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="relative w-full max-w-[22px] overflow-hidden rounded-t bg-neutral-200 dark:bg-white/10"
                    style={{ height: totalH }}
                    title={`${monthLabel(m.key)}: ${m.total} total, ${m.rede} rede`}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 bg-rose-500"
                      style={{ height: redeH }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-on-surface-variant/50">
                    {monthLabel(m.key).slice(0, 3)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/55">
        <AlertTriangle size={12} className="text-amber-500" aria-hidden />
        "Rede/Qualidade" = insatisfação com o serviço + migração para a concorrência. Financeiro e
        pré-instalação não indicam problema de rede.
      </p>
    </div>,
  )
}
