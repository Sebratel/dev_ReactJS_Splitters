import { useId } from 'react'
import { AlertTriangle, ArrowDown, ArrowRight, CalendarClock, Check, Clock, MoonStar, Repeat } from 'lucide-react'
import type { GmudRepeticao } from '@/features/gmud/lib/gmudRecurrence'
import {
  ATALHOS_DE_DURACAO,
  aplicarMudancaNaJanela,
  dataBr,
  datasDasOcorrencias,
  diaMesBr,
  duracaoEmMinutos,
  formatarDiaCurto,
  posicaoNaBarraDoDia,
  resumoDaJanela,
  rotuloDaDuracao,
  somarDuracao,
  viraODia,
  type GmudJanela,
  type GmudJanelaCampo,
} from '@/features/gmud/lib/gmudJanela'
import { cn } from '@/shared/lib/utils'

const INPUT =
  'w-full rounded-lg border border-neutral-200 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-white/10'
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
const SELO = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold'

type Props = {
  janela: GmudJanela
  /** Recebe só os campos que mudaram. */
  onChange: (patch: Partial<GmudJanela>) => void
  /** Tipo da GMUD (texto do aviso da data mínima). */
  tipo?: string
  /** Primeira data de início permitida ('AAAA-MM-DD'); sem ela não há aviso nem `min`. */
  minInicio?: string
  /** Repetição da Pré-aprovada, já validada; mostra a prévia das ocorrências. */
  repeticao?: GmudRepeticao | null
}

// ---------------------------------------------------------------------------
// Cada bloco abaixo é independente: para tirar um, basta apagar a linha dele em GmudJanelaField.
// ---------------------------------------------------------------------------

/** [2] Aviso da data mínima, com o atalho "Usar dd/mm". */
function AvisoDataMinima({ tipo, minInicio, dataInicio, onUsar }: { tipo?: string; minInicio: string; dataInicio: string; onUsar: () => void }) {
  const foraDaRegra = dataInicio !== '' && dataInicio < minInicio
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-3 py-2.5 text-sm',
        foraDaRegra
          ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100'
          : 'border-neutral-300 bg-surface-container-low text-on-surface dark:border-white/20',
      )}
    >
      <p className="flex min-w-0 items-start gap-2">
        <CalendarClock size={16} aria-hidden className="mt-0.5 shrink-0" />
        <span>
          {tipo ? <span className="font-semibold">{tipo}: </span> : null}a partir de <span className="font-semibold">{dataBr(minInicio)}</span> (apresentação na
          terça + 7 dias).
        </span>
      </p>
      {dataInicio !== minInicio ? (
        <button
          type="button"
          onClick={onUsar}
          aria-label={`Usar ${diaMesBr(minInicio)} como data de início`}
          className={cn('rounded-lg border border-neutral-900/40 bg-primary px-3 py-1.5 text-sm font-bold text-neutral-900 transition-colors hover:bg-primary/90', FOCO)}
        >
          Usar {diaMesBr(minInicio)}
        </button>
      ) : null}
    </div>
  )
}

/** [4] Atalhos de duração: calculam o fim a partir do início. */
function AtalhosDeDuracao({ janela, onEscolher }: { janela: GmudJanela; onEscolher: (min: number) => void }) {
  const habilitado = somarDuracao(janela.dataInicio, janela.horaInicio, 0) !== null
  const atual = duracaoEmMinutos(janela)
  return (
    <div role="group" aria-label="Duração da janela" className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-on-surface-variant">Duração</span>
      {ATALHOS_DE_DURACAO.map((min) => {
        const ativo = habilitado && atual === min
        return (
          <button
            key={min}
            type="button"
            disabled={!habilitado}
            aria-pressed={ativo}
            onClick={() => onEscolher(min)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors disabled:cursor-not-allowed',
              FOCO,
              ativo
                ? 'bg-primary text-neutral-900 ring-neutral-900/40'
                : 'text-on-surface ring-neutral-300 hover:bg-surface-container-low disabled:text-on-surface-variant disabled:hover:bg-transparent dark:ring-white/20',
            )}
          >
            {ativo ? <Check size={12} aria-hidden /> : null}
            {rotuloDaDuracao(min)}
          </button>
        )
      })}
      {!habilitado ? <span className="text-xs text-on-surface-variant">Informe a data e o horário de início.</span> : null}
    </div>
  )
}

/** [3] Resumo vivo: "Terça 24/11, 22:00 até quarta 25/11, 01:00", duração e "vira o dia"; ou o erro. */
function ResumoDaJanela({ janela }: { janela: GmudJanela }) {
  const duracao = duracaoEmMinutos(janela)
  return (
    <div aria-live="polite">
      {duracao === null ? null : duracao <= 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
          O fim precisa ser depois do início.
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-neutral-200/90 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface dark:border-white/15">
          <span className="font-semibold">{resumoDaJanela(janela)}</span>
          <span className={cn(SELO, 'bg-primary text-neutral-900')}>
            <Clock size={12} aria-hidden />
            {rotuloDaDuracao(duracao)} de duração
          </span>
          {viraODia(janela) ? (
            <span className={cn(SELO, 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900')}>
              <MoonStar size={12} aria-hidden />
              vira o dia
            </span>
          ) : null}
        </p>
      )}
    </div>
  )
}

/** [6] Barra do dia (decorativa): onde a janela cai nas 24 h do dia de início. */
function BarraDoDia({ janela }: { janela: GmudJanela }) {
  const pos = posicaoNaBarraDoDia(janela)
  if (!pos) return null
  return (
    <div aria-hidden className="px-0.5">
      <div className="relative h-2.5 rounded-full bg-surface-container-low ring-1 ring-neutral-300 dark:ring-white/20">
        <span
          className={cn('absolute inset-y-0 bg-primary ring-1 ring-neutral-900/50', pos.continua ? 'rounded-l-full' : 'rounded-full')}
          style={{ left: `${pos.inicioPct}%`, width: `${Math.max(pos.larguraPct, 1)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-on-surface-variant">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>
      {pos.continua ? <p className="text-right text-[11px] text-on-surface-variant">continua no dia seguinte</p> : null}
    </div>
  )
}

/** [7] Pré-aprovada com repetição: as datas de cada ocorrência. */
function PreviaDasOcorrencias({ janela, repeticao }: { janela: GmudJanela; repeticao?: GmudRepeticao | null }) {
  const datas = datasDasOcorrencias(janela, repeticao)
  if (datas.length <= 1) return null
  return (
    <div className="rounded-xl border border-neutral-200/90 px-3 py-2.5 dark:border-white/15">
      <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
        <Repeat size={15} aria-hidden className="shrink-0" />
        {datas.length} ocorrências, com o mesmo horário
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {datas.map((data) => (
          <li key={data} className="rounded-md border border-neutral-300 bg-surface-container-low px-2 py-0.5 text-xs font-semibold tabular-nums text-on-surface dark:border-white/20">
            {formatarDiaCurto(data)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** [1] Um lado da janela (Início ou Fim): data e horário na mesma linha, a data mais larga. */
function Lado({
  titulo, rotuloData, rotuloHora, data, hora, min, onData, onHora,
}: {
  titulo: string
  rotuloData: string
  rotuloHora: string
  data: string
  hora: string
  min?: string
  onData: (v: string) => void
  onHora: (v: string) => void
}) {
  const id = useId()
  return (
    <fieldset className="min-w-0 rounded-xl border border-neutral-200/90 p-3 dark:border-white/15">
      <legend className="px-1 text-xs font-bold text-on-surface">{titulo} *</legend>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-data`} className="block text-xs font-semibold text-on-surface-variant">
            {rotuloData}
          </label>
          <input id={`${id}-data`} type="date" aria-required="true" className={cn(INPUT, 'mt-1')} value={data} min={min} onChange={(e) => onData(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-hora`} className="block text-xs font-semibold text-on-surface-variant">
            {rotuloHora}
          </label>
          <input id={`${id}-hora`} type="time" aria-required="true" className={cn(INPUT, 'mt-1')} value={hora} onChange={(e) => onHora(e.target.value)} />
        </div>
      </div>
    </fieldset>
  )
}

/**
 * Janela de mudança da GMUD: início e fim lado a lado, com aviso da data mínima, atalhos de duração, resumo
 * e barra do dia. Só apresentação: o estado (dataInicio/horaInicio/dataFim/horaFim) continua no formulário,
 * e as validações/pendências continuam em model/gmudForm.ts.
 */
export function GmudJanelaField({ janela, onChange, tipo, minInicio, repeticao }: Props) {
  /** Manda ao formulário só o que mudou. */
  const emitir = (next: GmudJanela) => {
    const patch: Partial<GmudJanela> = {}
    for (const campo of Object.keys(next) as GmudJanelaCampo[]) {
      if (next[campo] !== janela[campo]) patch[campo] = next[campo]
    }
    if (Object.keys(patch).length > 0) onChange(patch)
  }
  // [5] Preenchimento inteligente (data de fim acompanha o início; fim antes do início no mesmo dia vira o dia).
  // Para tirar: trocar por `emitir({ ...janela, [campo]: valor })`.
  const mudar = (campo: GmudJanelaCampo) => (valor: string) => emitir(aplicarMudancaNaJanela(janela, campo, valor))
  const usarDuracao = (min: number) => {
    const fim = somarDuracao(janela.dataInicio, janela.horaInicio, min)
    if (fim) emitir({ ...janela, ...fim })
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      {minInicio ? <AvisoDataMinima tipo={tipo} minInicio={minInicio} dataInicio={janela.dataInicio} onUsar={() => mudar('dataInicio')(minInicio)} /> : null}

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <Lado
          titulo="Início"
          rotuloData="Data início"
          rotuloHora="Horário início"
          data={janela.dataInicio}
          hora={janela.horaInicio}
          min={minInicio}
          onData={mudar('dataInicio')}
          onHora={mudar('horaInicio')}
        />
        <span aria-hidden className="flex justify-center text-on-surface-variant md:pt-2">
          <ArrowRight size={18} className="hidden md:block" />
          <ArrowDown size={18} className="md:hidden" />
        </span>
        <Lado
          titulo="Fim (prazo final)"
          rotuloData="Data fim"
          rotuloHora="Horário fim"
          data={janela.dataFim}
          hora={janela.horaFim}
          min={janela.dataInicio || undefined}
          onData={mudar('dataFim')}
          onHora={mudar('horaFim')}
        />
      </div>

      <AtalhosDeDuracao janela={janela} onEscolher={usarDuracao} />
      <ResumoDaJanela janela={janela} />
      <BarraDoDia janela={janela} />
      <PreviaDasOcorrencias janela={janela} repeticao={repeticao} />
    </div>
  )
}
