import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Ban, CalendarClock, CalendarDays, CheckCheck, ChevronLeft, ChevronRight, CircleCheck, Hourglass, Info, Loader2, PowerOff,
  type LucideIcon,
} from 'lucide-react'
import { useGmudReuniaoSemanal } from '@/features/gmud/api/gmudReuniaoSemanal'
import {
  addDias,
  agruparPorDia,
  diaDaSemana,
  diaMes,
  formatarIntervalo,
  hojeEmSaoPaulo,
  modoPadraoDaReuniao,
  ordenarFeito,
  resumoFeito,
  resumoVem,
  reuniaoComParada,
  rotuloDoDia,
  segundaDoFeito,
  semanasDaReuniao,
  type GmudReuniaoFeitoItem,
  type GmudReuniaoItem,
  type GmudReuniaoJanela,
  type GmudReuniaoModo,
  type GmudReuniaoResultado,
  type GmudReuniaoSemanal,
} from '@/features/gmud/lib/gmudReuniaoSemana'
import { gmudSituacao } from '@/features/gmud/lib/gmudSituacao'
import { GMUD_CATEGORIA_LABEL, type GmudCategoria } from '@/features/gmud/model/gmudForm'
import type { GmudExtra } from '@/features/gmud/model/gmud'
import { GmudSituacaoSelo, GmudTipoSelo } from '@/features/gmud/ui/GmudSelos'
import { cn } from '@/shared/lib/utils'

const CARD = 'rounded-2xl border border-neutral-200/90 bg-surface-container-lowest dark:border-white/15'
const PILL = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold'
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Selo do resultado no bloco "O que foi feito": cor + ícone + texto. */
const RESULTADO: Record<GmudReuniaoResultado, { label: string; tone: string; icon: LucideIcon; hint: string }> = {
  nao_concluida: {
    label: 'Não concluída',
    tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
    icon: AlertTriangle,
    hint: 'Estava liberada e a janela passou sem a GMUD ser concluída.',
  },
  reagendada: {
    label: 'Reagendada',
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    icon: CalendarClock,
    hint: 'Estava marcada para esta semana e a janela foi mudada para outra data.',
  },
  cancelada: { label: 'Cancelada', tone: 'bg-neutral-200 text-neutral-800 dark:bg-white/10 dark:text-neutral-200', icon: Ban, hint: 'GMUD cancelada.' },
  janela_aberta: {
    label: 'Janela em aberto',
    tone: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
    icon: Hourglass,
    hint: 'Liberada; a janela ainda não terminou.',
  },
  concluida: { label: 'Concluída', tone: 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900', icon: CheckCheck, hint: 'Execução concluída.' },
}

function horario(j: GmudReuniaoJanela): string {
  return `${j.horaInicio ?? '—'}–${j.horaFim ?? '—'}`
}

/** "até 17/11" quando a janela termina em outro dia. */
function terminaEm(j: GmudReuniaoJanela): string | null {
  return j.dataFim && j.dataInicio && j.dataFim !== j.dataInicio ? `até ${diaMes(j.dataFim)}` : null
}

function categoriaELocal(item: GmudReuniaoItem): string {
  // Sem categoria gravada = GMUD antiga, que era sempre de rede externa.
  const categoria = GMUD_CATEGORIA_LABEL[(item.categoria ?? 'rede_externa') as GmudCategoria] ?? item.categoria ?? ''
  return [categoria, item.popSite || item.sistema].filter((x) => x && x.trim() !== '').join(' · ')
}

/** Situação de aprovação, pela mesma regra do painel (gmudSituacao). */
function situacaoDoItem(item: GmudReuniaoItem) {
  const extra = {
    tipo: item.tipo,
    statusComite: item.statusComite,
    statusAreas: item.statusAreas,
    areasTotal: item.areasTotal,
    areasAprovadas: item.areasAprovadas,
    statusExec: item.statusExec,
    ellevenEncerradoEm: item.ellevenEncerradoEm,
    ellevenEncerradoStatus: item.ellevenEncerradoStatus,
  } as GmudExtra
  return gmudSituacao({ extra, conclusionDate: null, status: item.statusVoalle })
}

function Titulo({ item }: { item: GmudReuniaoItem }) {
  return (
    <Link to={`/gmud/${item.protocolo}`} className={cn('group block rounded', FOCO)}>
      <span className="font-mono text-xs tabular-nums text-on-surface-variant">{item.protocolo}</span>{' '}
      <span className="font-medium text-on-surface group-hover:underline">{item.titulo?.trim() || 'GMUD sem título'}</span>
    </Link>
  )
}

function Meta({ item }: { item: GmudReuniaoItem }) {
  const local = categoriaELocal(item)
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      {item.tipo ? <GmudTipoSelo tipo={item.tipo} /> : null}
      {local !== '' ? <span className="text-xs text-on-surface-variant">{local}</span> : null}
    </span>
  )
}

type Numero = { label: string; value: number; icon: LucideIcon; alerta?: 'perigo' | 'atencao' }

/** Quatro números do bloco. Os que a reunião precisa decidir ficam em destaque quando são maiores que zero. */
function Resumo({ numeros }: { numeros: Numero[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {numeros.map((n) => {
        const ativo = n.value > 0 ? n.alerta : undefined
        const Icon = n.icon
        return (
          <div
            key={n.label}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-3 py-2.5',
              ativo === 'perigo'
                ? 'border-rose-300 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-950/40'
                : ativo === 'atencao'
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-950/40'
                  : 'border-neutral-200/90 bg-surface-container-low dark:border-white/15',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                ativo === 'perigo'
                  ? 'bg-rose-200 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100'
                  : ativo === 'atencao'
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/70 dark:text-amber-100'
                    : 'bg-surface-container-lowest text-on-surface',
              )}
            >
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <dt
                className={cn(
                  'text-xs font-semibold',
                  ativo === 'perigo' ? 'text-rose-800 dark:text-rose-200' : ativo === 'atencao' ? 'text-amber-900 dark:text-amber-200' : 'text-on-surface-variant',
                )}
              >
                {n.label}
              </dt>
              <dd
                className={cn(
                  'text-2xl font-bold leading-tight tabular-nums',
                  ativo === 'perigo' ? 'text-rose-800 dark:text-rose-200' : ativo === 'atencao' ? 'text-amber-900 dark:text-amber-200' : 'text-on-surface',
                )}
              >
                {n.value.toLocaleString('pt-BR')}
              </dd>
            </div>
          </div>
        )
      })}
    </dl>
  )
}

function Bloco({ numero, titulo, intervalo, id, children }: { numero: number; titulo: string; intervalo: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn(CARD, 'space-y-4 p-4 sm:p-5')}>
      <h3 id={id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-neutral-900">
          {numero}
        </span>
        <span className="sr-only">{numero}. </span>
        <span className="text-lg font-bold text-on-surface">{titulo}</span>
        <span className="text-sm text-on-surface-variant">{intervalo}</span>
      </h3>
      {children}
    </section>
  )
}

const LINHA = 'grid gap-x-4 gap-y-2 px-3 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center'
const LISTA = 'divide-y divide-neutral-200/80 rounded-xl border border-neutral-200/90 dark:divide-white/10 dark:border-white/15'
const VAZIO = 'rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-on-surface-variant dark:border-white/20'

function LinhaFeito({ item }: { item: GmudReuniaoFeitoItem }) {
  const r = RESULTADO[item.resultado]
  const Icon = r.icon
  const { janela, novaJanela } = item
  const fim = terminaEm(janela)
  return (
    <li className={LINHA} data-resultado={item.resultado}>
      <p className="text-xs text-on-surface-variant">
        <span className="block font-semibold text-on-surface">
          {janela.dataInicio ? `${DIAS_CURTOS[diaDaSemana(janela.dataInicio)]} ${diaMes(janela.dataInicio)}` : 'Sem data'}
        </span>
        <span className="tabular-nums">{horario(janela)}</span>
        {fim ? <span className="block">{fim}</span> : null}
      </p>
      <div className="min-w-0">
        <Titulo item={item} />
        <Meta item={item} />
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <span className={cn(PILL, r.tone)} title={r.hint}>
          <Icon size={12} aria-hidden />
          {r.label}
        </span>
        {item.resultado === 'reagendada' && novaJanela?.dataInicio ? (
          <span className="text-xs text-on-surface-variant">
            Nova janela: {diaMes(novaJanela.dataInicio)} {novaJanela.horaInicio ?? ''}
          </span>
        ) : null}
      </div>
    </li>
  )
}

function LinhaVem({ item }: { item: GmudReuniaoItem }) {
  const fim = terminaEm(item.janela)
  return (
    <li className={LINHA}>
      <p className="text-xs text-on-surface-variant">
        <span className="block font-semibold tabular-nums text-on-surface">{horario(item.janela)}</span>
        {fim ? <span className="block">{fim}</span> : null}
      </p>
      <div className="min-w-0">
        <Titulo item={item} />
        <Meta item={item} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[22rem] sm:justify-end">
        {reuniaoComParada(item) ? (
          <span className={cn(PILL, 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950')} title="Há parada do serviço durante a execução.">
            <PowerOff size={12} aria-hidden />
            Com parada
          </span>
        ) : null}
        <GmudSituacaoSelo situacao={situacaoDoItem(item)} wrap />
      </div>
    </li>
  )
}

/** Tela da reunião semanal (só apresentação; os dados chegam por props). */
export function GmudWeeklyMeetingView({
  hoje,
  segunda,
  onSegunda,
  data,
  isLoading = false,
  error = null,
  onRetry,
}: {
  /** Hoje em Brasília (YYYY-MM-DD), para os atalhos. */
  hoje: string
  /** Segunda-feira da semana do "feito". */
  segunda: string
  onSegunda: (segunda: string) => void
  data: GmudReuniaoSemanal | undefined
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}) {
  const semanas = semanasDaReuniao(segunda)
  const atalhos: { modo: GmudReuniaoModo; label: string; hint: string }[] = [
    { modo: 'passada', label: 'Semana passada', hint: 'Feito na semana passada; vem esta semana' },
    { modo: 'esta', label: 'Esta semana', hint: 'Feito nesta semana; vem a próxima' },
  ]
  const feito = ordenarFeito(data?.feito ?? [])
  const vem = data?.vem ?? []
  const rFeito = resumoFeito(feito)
  const rVem = resumoVem(vem)
  const dias = agruparPorDia(vem, semanas.vemDe)

  return (
    <div className="space-y-4">
      <div className={cn(CARD, 'flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4')}>
        <div role="group" aria-label="Semana da reunião" className="flex flex-wrap items-center gap-1.5">
          {atalhos.map((a) => {
            const alvo = segundaDoFeito(hoje, a.modo)
            const ativo = alvo === segunda
            return (
              <button
                key={a.modo}
                type="button"
                aria-pressed={ativo}
                title={a.hint}
                onClick={() => onSegunda(alvo)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors',
                  FOCO,
                  ativo
                    ? 'bg-primary text-neutral-900 ring-neutral-900/40'
                    : 'text-on-surface-variant ring-neutral-300 hover:bg-surface-container-low hover:text-on-surface dark:ring-white/20',
                )}
              >
                {ativo ? <CircleCheck size={13} aria-hidden /> : null}
                {a.label}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSegunda(addDias(segunda, -7))}
            aria-label="Semana anterior"
            title="Semana anterior"
            className={cn('inline-flex size-8 items-center justify-center rounded-lg text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low dark:ring-white/20', FOCO)}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <p aria-live="polite" className="text-sm text-on-surface">
            <span className="font-semibold">Feito:</span> {formatarIntervalo(semanas.feitoDe, semanas.feitoAte)}
            <span className="text-on-surface-variant"> · </span>
            <span className="font-semibold">Próxima:</span> {formatarIntervalo(semanas.vemDe, semanas.vemAte)}
          </p>
          <button
            type="button"
            onClick={() => onSegunda(addDias(segunda, 7))}
            aria-label="Semana seguinte"
            title="Semana seguinte"
            className={cn('inline-flex size-8 items-center justify-center rounded-lg text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low dark:ring-white/20', FOCO)}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className={cn(CARD, 'p-6 text-center')}>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className={cn('mt-3 rounded-lg px-3 py-1.5 text-sm font-semibold text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low dark:ring-white/20', FOCO)}
            >
              Tentar de novo
            </button>
          ) : null}
        </div>
      ) : isLoading || !data ? (
        <p role="status" className={cn(CARD, 'flex items-center justify-center gap-2 p-8 text-sm text-on-surface-variant')}>
          <Loader2 size={16} aria-hidden className="animate-spin motion-reduce:animate-none" /> Carregando a reunião…
        </p>
      ) : (
        <>
          <Bloco numero={1} id="reuniao-feito" titulo="O que foi feito" intervalo={formatarIntervalo(semanas.feitoDe, semanas.feitoAte)}>
            <Resumo
              numeros={[
                { label: 'Concluídas', value: rFeito.concluidas, icon: CheckCheck },
                { label: 'Reagendadas', value: rFeito.reagendadas, icon: CalendarClock },
                { label: 'Canceladas', value: rFeito.canceladas, icon: Ban },
                { label: 'Janela passou sem concluir', value: rFeito.naoConcluidas, icon: AlertTriangle, alerta: 'perigo' },
              ]}
            />
            {feito.length === 0 ? (
              <p className={VAZIO}>Nenhuma GMUD executada nessa semana.</p>
            ) : (
              <ul className={LISTA}>
                {feito.map((item) => (
                  <LinhaFeito key={`${item.protocolo}-${item.resultado}`} item={item} />
                ))}
              </ul>
            )}
          </Bloco>

          <Bloco numero={2} id="reuniao-vem" titulo="O que vem" intervalo={formatarIntervalo(semanas.vemDe, semanas.vemAte)}>
            <Resumo
              numeros={[
                { label: 'Programadas', value: rVem.programadas, icon: CalendarDays },
                { label: 'Liberadas', value: rVem.liberadas, icon: CircleCheck },
                { label: 'Aguardando aprovação', value: rVem.aguardando, icon: Hourglass, alerta: 'atencao' },
                { label: 'Com parada de serviço', value: rVem.comParada, icon: PowerOff, alerta: 'perigo' },
              ]}
            />
            {dias.length === 0 ? (
              <p className={VAZIO}>Nenhuma GMUD programada para essa semana.</p>
            ) : (
              <div className="space-y-4">
                {dias.map((d) => (
                  <div key={d.dia}>
                    <h4 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-on-surface">
                      {rotuloDoDia(d.dia)}
                      <span className="text-xs font-normal text-on-surface-variant">
                        {d.items.length} GMUD{d.items.length === 1 ? '' : 's'}
                      </span>
                    </h4>
                    <ul className={LISTA}>
                      {d.items.map((item) => (
                        <LinhaVem key={item.protocolo} item={item} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Bloco>
        </>
      )}

      <p className="flex items-start gap-2 px-1 text-xs text-on-surface-variant">
        <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          Só aparecem GMUDs registradas na plataforma. As legadas (só no Voalle) não têm janela cadastrada e ficam de fora. No bloco 1 entram as
          GMUDs que estavam liberadas para a semana, além das canceladas e das reagendadas para outra data.
        </span>
      </p>
    </div>
  )
}

/** Aba "Reunião semanal": o que foi feito numa semana e o que vem na seguinte. */
export function GmudWeeklyMeeting() {
  const hoje = hojeEmSaoPaulo()
  const [segunda, setSegunda] = useState(() => segundaDoFeito(hoje, modoPadraoDaReuniao(hoje)))
  const query = useGmudReuniaoSemanal(semanasDaReuniao(segunda))
  return (
    <GmudWeeklyMeetingView
      hoje={hoje}
      segunda={segunda}
      onSegunda={setSegunda}
      data={query.data}
      isLoading={query.isLoading}
      error={query.isError ? (query.error instanceof Error ? query.error.message : 'Falha ao carregar a reunião semanal de GMUDs.') : null}
      onRetry={() => void query.refetch()}
    />
  )
}
