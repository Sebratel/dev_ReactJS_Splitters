import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronDown, ListOrdered, Loader2, Pencil, PowerOff, Zap } from 'lucide-react'
import { useEscapeKey } from '@/features/gmud/hooks/useEscapeKey'
import { duracaoEmMinutos, resumoDaJanela, rotuloDaDuracao, type GmudJanela } from '@/features/gmud/lib/gmudJanela'
import {
  atencoesDoFormulario,
  numeroDeProtocolos,
  passosAoAbrirGmud,
  quemAprovaAGmud,
} from '@/features/gmud/lib/gmudRevisao'
import { pendenciasDaEtapa, type WizardStep } from '@/features/gmud/lib/gmudWizard'
import { formatEscopoRotas } from '@/features/gmud/model/gmudEscopoRede'
import {
  collectAmbienteAfetado,
  type GmudFormState,
  type GmudPendencia,
  type GmudSistemasExternosData,
  type GmudSistemasInternosData,
} from '@/features/gmud/model/gmudForm'
import { GmudRevisaoStatus } from '@/features/gmud/ui/GmudRevisaoStatus'
import { GmudTipoSelo } from '@/features/gmud/ui/GmudSelos'
import { cn } from '@/shared/lib/utils'

const CARD = 'rounded-2xl border border-neutral-200/90 bg-surface-container-lowest dark:border-white/15'
const SELO = 'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold'
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
const OUTRO = 'Outro (especificar)'

type Dados = { form: GmudFormState; siData: GmudSistemasInternosData; seData: GmudSistemasExternosData }

function janelaDoForm(form: GmudFormState): GmudJanela {
  return { dataInicio: form.dataInicio, horaInicio: form.horaInicio, dataFim: form.dataFim, horaFim: form.horaFim }
}

const protocolosDoForm = (form: GmudFormState) => numeroDeProtocolos(form.tipo, form.repeticaoVezes, form.repeticaoIntervaloDias)

// ---------------------------------------------------------------------------
// [item 1] Uma linha por etapa: os dados principais em texto curto, na mesma linha
// ---------------------------------------------------------------------------

/**
 * Um dado da linha: "Rótulo: valor". O valor é cortado com reticências (o texto inteiro fica no title) e,
 * vazio, vira "Não informado" em tom fraco. `children` serve para selos (tipo, parada, duração).
 */
function Dado({ rotulo, valor, children }: { rotulo?: string; valor?: string; children?: React.ReactNode }) {
  const texto = (valor ?? '').trim().replace(/\s+/g, ' ')
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 sm:max-w-[22rem]">
      {rotulo ? <span className="shrink-0 text-on-surface-variant">{rotulo}:</span> : null}
      {children ?? (texto !== '' ? (
        <span className="min-w-0 truncate text-on-surface" title={texto}>
          {texto}
        </span>
      ) : (
        <span className="shrink-0 text-on-surface-variant">Não informado</span>
      ))}
    </span>
  )
}

function DadosIdentificacao({ form, siData, seData }: Dados) {
  const natureza = form.categoria === 'rede_externa' ? form.assunto : form.categoria === 'sistemas_internos' ? siData.natureza : seData.natureza
  return (
    <>
      <Dado rotulo="Tipo">{form.tipo.trim() !== '' ? <GmudTipoSelo tipo={form.tipo} /> : undefined}</Dado>
      <Dado rotulo="Natureza" valor={natureza} />
      <Dado rotulo="Título" valor={form.titulo} />
    </>
  )
}

function DadosOQueSeraFeito({ form, siData, seData }: Dados) {
  if (form.categoria === 'sistemas_internos') {
    return (
      <>
        <Dado rotulo="Sistema" valor={siData.sistemaAfetado === OUTRO ? siData.sistemaAfetadoOutro : siData.sistemaAfetado} />
        <Dado rotulo="Ambiente" valor={siData.ambiente} />
      </>
    )
  }
  if (form.categoria === 'sistemas_externos') {
    return (
      <>
        <Dado rotulo="Sistema externo" valor={seData.sistemaExterno === OUTRO ? seData.sistemaExternoOutro : seData.sistemaExterno} />
        <Dado rotulo="Fornecedor" valor={seData.fornecedor} />
      </>
    )
  }
  const escopo = formatEscopoRotas(form.escopoRotas)
  const clientes = form.clientesSemSplitter.length
  return (
    <>
      <Dado rotulo="POP/site" valor={form.popSite} />
      <Dado rotulo="Abrangência" valor={escopo !== '' ? escopo : form.popSite.trim() !== '' ? 'POP/site inteiro' : ''} />
      <Dado rotulo="Ambiente afetado" valor={collectAmbienteAfetado(form).join(', ')} />
      <Dado rotulo="Ponto a ponto ou fibra apagada" valor={clientes > 0 ? `${clientes} escolhido${clientes === 1 ? '' : 's'}` : 'Nenhum escolhido'} />
    </>
  )
}

function DadosImpacto({ form, siData, seData }: Dados) {
  const detalhe = form.categoria === 'rede_externa' ? form : form.categoria === 'sistemas_internos' ? siData : seData
  return (
    <>
      <Dado rotulo="Parada do serviço">
        {form.impactoParada === 'Sim' ? (
          <span className={cn(SELO, 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950')}>
            <PowerOff size={12} aria-hidden />
            Sim
          </span>
        ) : form.impactoParada !== '' ? (
          <span className={cn(SELO, 'bg-surface-container-low text-on-surface ring-1 ring-neutral-300 dark:ring-white/20')}>{form.impactoParada}</span>
        ) : undefined}
      </Dado>
      {detalhe.tipoIndisponibilidade.trim() !== '' ? <Dado rotulo="Indisponibilidade" valor={detalhe.tipoIndisponibilidade} /> : null}
      {detalhe.duracaoEstimada.trim() !== '' ? <Dado rotulo="Duração estimada" valor={detalhe.duracaoEstimada} /> : null}
      {form.riscoExecucao.trim() !== '' ? <Dado rotulo="Risco na execução" valor={form.riscoExecucao} /> : null}
    </>
  )
}

/** [item 2 da revisão anterior] Quem aprova, pela regra do servidor (lib/gmudRevisao.ts), em texto curto. */
function DadosQuemAprova({ form, siData, seData }: Dados) {
  const quem = quemAprovaAGmud({
    tipo: form.tipo,
    categoria: form.categoria,
    areasImpactadas: siData.areasImpactadas,
    areasAfetadas: seData.areasAfetadas,
    recursosAdministrativos: form.recursosAdministrativos,
  })
  const aprova = !quem.comite
    ? 'Ninguém: a Pré-aprovada já nasce liberada'
    : quem.areasQueAprovam.length > 0
      ? `Comitê e, em paralelo, ${quem.areasQueAprovam.join(', ')}`
      : 'Só o Comitê'
  return (
    <>
      <Dado rotulo="Quem aprova" valor={aprova} />
      {quem.areasSoAvisadas.length > 0 ? <Dado rotulo="Só recebem e-mail de aviso, sem aprovar" valor={quem.areasSoAvisadas.join(', ')} /> : null}
    </>
  )
}

function DadosAprovadores(dados: Dados) {
  const janela = janelaDoForm(dados.form)
  const duracao = duracaoEmMinutos(janela)
  return (
    <>
      <Dado rotulo="Janela" valor={resumoDaJanela(janela)} />
      {duracao !== null && duracao > 0 ? <span className={cn(SELO, 'bg-primary text-neutral-900')}>{rotuloDaDuracao(duracao)} de duração</span> : null}
      <DadosQuemAprova {...dados} />
    </>
  )
}

const CONTEUDO: Partial<Record<WizardStep['key'], (dados: Dados) => React.JSX.Element>> = {
  identificacao: DadosIdentificacao,
  oQueSeraFeito: DadosOQueSeraFeito,
  impacto: DadosImpacto,
  aprovadores: DadosAprovadores,
}

/** Editar como botão visível (lápis + texto), com o nome da etapa para leitor de tela. */
function BotaoEditar({ etapa, onClick }: { etapa: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar ${etapa}`}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low dark:border-white/20 sm:min-h-8 sm:px-2.5 sm:text-xs',
        FOCO,
      )}
    >
      <Pencil size={13} aria-hidden />
      Editar
    </button>
  )
}

/**
 * [item 1] Linha de uma etapa: nome com a situação, dados na mesma linha e Editar.
 * No celular quebra em duas: nome + Editar em cima, dados embaixo.
 */
function LinhaDaEtapa({ step, dados, pendencias, onEditar }: { step: WizardStep; dados: Dados; pendencias: GmudPendencia[]; onEditar: () => void }) {
  const id = useId()
  const Conteudo = CONTEUDO[step.key]
  const n = pendencias.length
  const faltando = pendencias.map((p) => p.message).join('; ')
  return (
    <li
      aria-labelledby={id}
      // Etapa com pendência: flash âmbar curto ao chegar na Revisão (só destaque; o "Falta: …" continua).
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[12.5rem_minmax(0,1fr)_auto] sm:px-4',
        n > 0 ? 'gmud-rv-flash' : '',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            n > 0 ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
          )}
        >
          {n > 0 ? <AlertTriangle size={12} /> : <Check size={12} strokeWidth={3} />}
        </span>
        <h3 id={id} className="min-w-0 truncate text-sm font-bold text-on-surface" title={step.label}>
          {step.label}
        </h3>
        <span className="sr-only">{n > 0 ? '' : 'Completa'}</span>
      </div>
      <div className="col-span-2 row-start-2 min-w-0 text-sm sm:col-span-1 sm:col-start-2 sm:row-start-1">
        {n > 0 ? (
          <p className="flex min-w-0 items-center gap-1.5 text-amber-900 dark:text-amber-200">
            <span className={cn(SELO, 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200')}>
              {n} pendência{n === 1 ? '' : 's'}
            </span>
            <span className="min-w-0 truncate" title={faltando}>
              Falta: {faltando}
            </span>
          </p>
        ) : null}
        {Conteudo ? (
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
            <Conteudo {...dados} />
          </p>
        ) : null}
      </div>
      <div className="col-start-2 row-start-1 sm:col-start-3">
        <BotaoEditar etapa={step.label} onClick={onEditar} />
      </div>
    </li>
  )
}

/**
 * [item 4] Atenção antes de abrir, em uma faixa compacta: com um motivo, uma linha só; com vários, lista
 * curta na mesma faixa. Não bloqueia. Para tirar: apagar a linha em GmudRevisao.
 */
function AtencaoAntesDeAbrir({ motivos }: { motivos: string[] }) {
  if (motivos.length === 0) return null
  const minuscula = (m: string) => m.charAt(0).toLocaleLowerCase('pt-BR') + m.slice(1)
  return (
    <section
      aria-label="Atenção antes de abrir"
      className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-100"
    >
      <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
      {motivos.length === 1 ? (
        <p>
          <span className="font-bold">Atenção:</span> {minuscula(motivos[0] as string)}
        </p>
      ) : (
        <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
          <span className="font-bold">Atenção:</span>
          <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-0.5">
            {motivos.map((m) => (
              <li key={m}>{minuscula(m)}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/**
 * [item 3] O que acontece ao abrir: recolhido por padrão, em uma linha clicável que abre os passos.
 * Para deixar sempre aberto, iniciar o estado em `true`; para tirar, apagar a linha em GmudRevisao.
 */
function OQueAconteceAoAbrir({ form }: { form: GmudFormState }) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const passos = passosAoAbrirGmud({ tipo: form.tipo, categoria: form.categoria, protocolos: protocolosDoForm(form) })
  return (
    <section className={cn(CARD, 'bg-surface-container-low')}>
      <h3>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={id}
          onClick={() => setAberto((a) => !a)}
          className={cn('flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-sm font-bold text-on-surface sm:min-h-10 sm:px-4', FOCO)}
        >
          <ListOrdered size={16} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">
            O que acontece ao abrir <span className="font-normal text-on-surface-variant">· {passos.length} passos</span>
          </span>
          <ChevronDown size={16} aria-hidden className={cn('shrink-0 transition-transform duration-150 motion-reduce:transition-none', aberto ? 'rotate-180' : '')} />
        </button>
      </h3>
      <ol id={id} hidden={!aberto} className="space-y-2 px-3 pb-3 sm:px-4">
        {passos.map((passo, i) => (
          <li key={passo} className="flex items-start gap-2.5 text-sm text-on-surface">
            <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-neutral-900">
              {i + 1}
            </span>
            <span>
              <span className="sr-only">Passo {i + 1}: </span>
              {passo}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Etapa de revisão do formulário de nova GMUD, compacta: uma linha por etapa com os dados principais, a faixa
 * de atenção e o "o que acontece ao abrir" recolhido. Só mostra: não valida, não envia e não muda o formulário.
 */
export function GmudRevisao({
  form,
  siData,
  seData,
  passos,
  pendencias,
  onEditar,
  agora,
}: Dados & {
  /** Etapas a revisar (sem a própria Revisão), na ordem do formulário. */
  passos: WizardStep[]
  pendencias: GmudPendencia[]
  /** Vai para a etapa de índice `i`. */
  onEditar: (i: number) => void
  /** Hora atual (para o aviso de janela próxima); padrão: agora. */
  agora?: Date
}) {
  const dados = { form, siData, seData }
  return (
    <div className="space-y-2.5">
      <p className="px-1 text-sm text-on-surface-variant">
        <span className="text-base font-bold text-on-surface">Revisão</span> · Confira cada etapa. Para mudar algo, use Editar.
      </p>
      {/* Faixa de situação animada; a contagem é a mesma da barra de ações (todas as pendências do formulário). */}
      <GmudRevisaoStatus pendencias={pendencias.length} />
      <AtencaoAntesDeAbrir motivos={atencoesDoFormulario(form, agora)} />
      {passos.length > 0 ? (
        <ul className={cn(CARD, 'divide-y divide-neutral-200/80 dark:divide-white/10')}>
          {passos.map((step, i) => (
            <LinhaDaEtapa key={step.key} step={step} dados={dados} pendencias={pendenciasDaEtapa(pendencias, step)} onEditar={() => onEditar(i)} />
          ))}
        </ul>
      ) : null}
      <OQueAconteceAoAbrir form={form} />
    </div>
  )
}

/**
 * [item 2] Barra de ações da Revisão, presa na base da tela (sticky): resumo à esquerda e Cancelar, Voltar e
 * o botão final à direita. Fica dentro do <form> (o botão final é o submit) e na coluna do conteúdo, então
 * não cobre o menu lateral nem o conteúdo: ocupa o próprio espaço no fim e só "gruda" enquanto se rola.
 */
export function GmudRevisaoBarra({
  pendencias,
  atencoes,
  textoBotao,
  enviando,
  podeEnviar,
  onCancelar,
  onVoltar,
}: {
  /** Quantas pendências faltam no formulário inteiro. */
  pendencias: number
  atencoes: string[]
  textoBotao: string
  enviando: boolean
  podeEnviar: boolean
  onCancelar: () => void
  onVoltar: () => void
}) {
  const BOTAO = 'rounded-lg px-3.5 py-2 text-sm font-semibold ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low dark:ring-white/20'
  return (
    <div
      role="group"
      aria-label="Ações da revisão"
      className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-t-2xl border border-b-0 border-neutral-300 bg-surface-container-lowest px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_16px_-8px_rgb(0_0_0/0.25)] dark:border-white/20 sm:px-4 lg:col-span-2"
    >
      <p aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
        {pendencias > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle size={15} aria-hidden />
            {pendencias} pendência{pendencias === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-200">
            <Check size={15} aria-hidden strokeWidth={3} />
            Tudo preenchido
          </span>
        )}
        {atencoes.length > 0 ? (
          <span className="font-semibold text-red-800 dark:text-red-200" title={atencoes.join(' ')}>
            · {atencoes.length} {atencoes.length === 1 ? 'atenção' : 'atenções'}
            <span className="sr-only">: {atencoes.join(' ')}</span>
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onCancelar} className={cn(BOTAO, 'text-on-surface-variant', FOCO)}>
          Cancelar
        </button>
        <button type="button" onClick={onVoltar} className={cn(BOTAO, 'text-on-surface', FOCO)}>
          Voltar
        </button>
        <button
          type="submit"
          disabled={!podeEnviar}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Zap className="size-4" aria-hidden />}
          {enviando ? 'Abrindo no Elleven…' : textoBotao}
        </button>
      </div>
    </div>
  )
}

/**
 * Confirmação final, só para os casos de maior risco (Emergencial e Pré-aprovada com repetição).
 * Mesmo padrão do GmudAvisoModal: portal no body, foco em Cancelar ao abrir, Esc e clique fora fecham.
 */
export function GmudConfirmarAbertura({ form, onConfirmar, onCancelar }: { form: GmudFormState; onConfirmar: () => void; onCancelar: () => void }) {
  const tituloId = useId()
  const resumoId = useId()
  const cancelarRef = useRef<HTMLButtonElement>(null)
  const confirmarRef = useRef<HTMLButtonElement>(null)
  useEscapeKey(onCancelar)

  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // O foco começa em Cancelar: um Enter por engano não abre nada.
    cancelarRef.current?.focus()
    return () => anterior?.focus()
  }, [])

  const protocolos = protocolosDoForm(form)
  const janela = resumoDaJanela(janelaDoForm(form))
  return createPortal(
    <div className="gmud-fade fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm" onClick={onCancelar} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={resumoId}
        onKeyDown={(e) => {
          // Dois botões: o Tab alterna entre eles, sem sair do diálogo.
          if (e.key === 'Tab') {
            e.preventDefault()
            const alvo = document.activeElement === confirmarRef.current ? cancelarRef.current : confirmarRef.current
            alvo?.focus()
          }
        }}
        className="gmud-enter relative w-full max-w-md rounded-2xl border border-neutral-200/80 bg-surface-container-lowest p-6 shadow-2xl dark:border-white/15"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-neutral-900" aria-hidden>
            <Zap size={22} />
          </span>
          <div className="min-w-0">
            <h2 id={tituloId} className="text-base font-bold text-on-surface">
              {protocolos > 1 ? `Abrir ${protocolos} protocolos no Elleven?` : 'Abrir 1 protocolo no Elleven?'}
            </h2>
            <p id={resumoId} className="mt-2 break-words text-sm text-on-surface">
              <span className="font-semibold">{form.tipo}</span>
              {form.titulo.trim() !== '' ? ` · ${form.titulo.trim()}` : ''}
              {janela !== '' ? ` · ${janela}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancelar}
            className={cn('rounded-lg px-4 py-2 text-sm font-semibold text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low dark:ring-white/20', FOCO)}
          >
            Cancelar
          </button>
          <button
            ref={confirmarRef}
            type="button"
            onClick={onConfirmar}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/60 focus-visible:ring-offset-2"
          >
            Sim, abrir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
