import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlarmClock, BarChart3, CheckCircle2, FolderOpen, Hourglass, Inbox, RefreshCw, TrendingUp } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { cn } from '@/shared/lib/utils'
import { fetchGmudIndicators, type GmudIndicators } from '@/features/gmud/api/gmudIndicators'
import { localDayKey } from '@/features/gmud/lib/gmudSchedule'
import { GmudHistorySection } from '@/features/gmud/ui/indicators/GmudHistorySection'
import { GmudPlatformSection } from '@/features/gmud/ui/indicators/GmudPlatformSection'
import { KpiCard, SectionTitle } from '@/features/gmud/ui/indicators/IndicatorPrimitives'
import { CARD, formatHours } from '@/features/gmud/ui/indicators/indicatorTheme'

type PeriodKey = '3m' | '6m' | '12m' | 'ano' | 'tudo'
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: '12m', label: '12 meses' },
  { key: 'ano', label: 'Este ano' },
  { key: 'tudo', label: 'Tudo' },
]

function periodRange(key: PeriodKey, now = new Date()): { from: string; to: string } {
  const to = localDayKey(now)
  const monthsBack = { '3m': 2, '6m': 5, '12m': 11 } as const
  if (key === 'ano') return { from: `${now.getFullYear()}-01-01`, to }
  if (key === 'tudo') return { from: '2020-01-01', to }
  return { from: localDayKey(new Date(now.getFullYear(), now.getMonth() - monthsBack[key], 1)), to }
}

/** Frase-resumo gerada dos números (o "recado" principal da tela). */
function buildHeadline(data: GmudIndicators): string | null {
  const m = data.voalle.period.monthly
  if (m.length < 2) return null
  const first = m[0].backlog
  const last = m[m.length - 1].backlog
  const { opened, closed } = data.voalle.period
  if (last > first) {
    return `O backlog de GMUDs em aberto subiu de ${first} para ${last} no período: entraram ${opened} e só ${closed} foram encerradas no Voalle. A maior parte são protocolos antigos que nunca foram encerrados no Elleven, mesmo com a mudança já executada.`
  }
  if (last < first) return `O backlog caiu de ${first} para ${last} no período (${opened} abertas, ${closed} encerradas).`
  return `Backlog estável em ${last} GMUDs no período (${opened} abertas, ${closed} encerradas).`
}

export function GmudIndicatorsScreen() {
  const [period, setPeriod] = useState<PeriodKey>('12m')
  const range = useMemo(() => periodRange(period), [period])
  const query = useQuery({
    queryKey: ['gmud', 'indicators', range.from, range.to],
    queryFn: () => fetchGmudIndicators(range.from, range.to),
    staleTime: 60_000,
  })
  const data = query.data
  const headline = data ? buildHeadline(data) : null

  return (
    <div className="mx-auto min-w-0 max-w-[1480px] space-y-4">
      <AppPageHeader
        badge="Gestão de Mudança de Rede"
        title="Indicadores de GMUD"
        description="Volume, backlog, prazos, Comitê, perfil das mudanças e impacto na rede."
        icon={BarChart3}
        primaryAction={{ to: '/gmud', label: 'Voltar às GMUDs' }}
        trailing={
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="inline-flex size-9 items-center justify-center rounded-lg text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
            aria-label="Atualizar"
            title="Atualizar"
          >
            <RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-surface-container-low p-0.5 ring-1 ring-neutral-200/70 dark:ring-white/10">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                period === p.key ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-on-surface-variant">
          {range.from.split('-').reverse().join('/')} a {range.to.split('-').reverse().join('/')}
        </p>
      </div>

      {query.isLoading ? (
        <div className={cn(CARD, 'p-10 text-center text-sm text-on-surface-variant')}>Calculando indicadores…</div>
      ) : query.isError || !data ? (
        <div className={cn(CARD, 'p-8 text-center text-sm font-semibold text-red-600 dark:text-red-300')}>
          {query.error instanceof Error ? query.error.message : 'Falha ao carregar os indicadores.'}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Em aberto agora" value={String(data.voalle.snapshot.openNow)} hint={`de ${data.voalle.snapshot.total} no histórico`} Icon={FolderOpen} tone="warning" />
            <KpiCard label="Prazo vencido" value={String(data.voalle.snapshot.overdueNow)} hint="abertas com SLA estourado" Icon={AlarmClock} tone="danger" />
            <KpiCard label="Abertas no período" value={String(data.voalle.period.opened)} Icon={Inbox} />
            <KpiCard label="Encerradas no período" value={String(data.voalle.period.closed)} hint={`${data.voalle.period.cancelled} canceladas`} Icon={CheckCircle2} tone="success" />
            <KpiCard
              label="Encerradas no prazo"
              value={data.voalle.period.onTimeRate == null ? '—' : `${data.voalle.period.onTimeRate}%`}
              hint={`${data.voalle.period.closedOnTime} de ${data.voalle.period.closed}`}
              Icon={TrendingUp}
              tone={data.voalle.period.onTimeRate != null && data.voalle.period.onTimeRate < 50 ? 'danger' : 'success'}
            />
            <KpiCard label="Tempo até encerrar" value={formatHours(data.voalle.period.medianHoursToClose)} hint="mediana, abertura → encerramento" Icon={Hourglass} />
          </div>

          {headline ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-on-surface">
              <span className="font-semibold text-primary">Destaque · </span>
              {headline}
            </div>
          ) : null}

          <SectionTitle
            eyebrow="Histórico Voalle"
            title="Fluxo e backlog dos protocolos"
            description="Todas as GMUDs do Elleven desde 2020: entrada, saída, prazos e quem solicita."
          />
          <GmudHistorySection data={data.voalle} />

          <SectionTitle
            eyebrow="Plataforma"
            title="Comitê, perfil das mudanças e impacto"
            description="Dados que só existem para GMUDs abertas por aqui: tipo, assunto, ambiente, aprovação, reagendamentos e massivas vinculadas."
          />
          <GmudPlatformSection data={data.platform} error={data.platformError} />

          <p className="pb-2 text-right text-[11px] text-on-surface-variant">
            Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}
          </p>
        </>
      )}
    </div>
  )
}
