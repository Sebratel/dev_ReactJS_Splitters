import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, CircleCheck, ListOrdered, Mail, Pencil, PowerOff, Users, Zap } from 'lucide-react'
import { useEscapeKey } from '@/features/gmud/hooks/useEscapeKey'
import { duracaoEmMinutos, resumoDaJanela, rotuloDaDuracao, type GmudJanela } from '@/features/gmud/lib/gmudJanela'
import {
  motivosDeAtencao,
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
import { GmudTipoSelo } from '@/features/gmud/ui/GmudSelos'
import { cn } from '@/shared/lib/utils'

const CARD = 'rounded-2xl border border-neutral-200/90 bg-surface-container-lowest p-4 dark:border-white/15 sm:p-5'
const SELO = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold'
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
const OUTRO = 'Outro (especificar)'

type Dados = { form: GmudFormState; siData: GmudSistemasInternosData; seData: GmudSistemasExternosData }

function janelaDoForm(form: GmudFormState): GmudJanela {
  return { dataInicio: form.dataInicio, horaInicio: form.horaInicio, dataFim: form.dataFim, horaFim: form.horaFim }
}

const protocolosDoForm = (form: GmudFormState) => numeroDeProtocolos(form.tipo, form.repeticaoVezes, form.repeticaoIntervaloDias)

/** Texto longo encurtado para caber no cartão (o texto inteiro fica no title). */
function curto(texto: string, max = 160): string {
  const t = texto.trim().replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/** Valor de um par rótulo/valor; vazio vira "Não informado" em tom fraco (nunca quebra). */
function Valor({ children }: { children: React.ReactNode }) {
  const vazio = children == null || children === false || (typeof children === 'string' && children.trim() === '')
  return vazio ? <span className="text-on-surface-variant">Não informado</span> : <>{children}</>
}

function Par({ rotulo, children, largo = false }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={cn('min-w-0', largo ? 'sm:col-span-2' : '')}>
      <dt className="text-xs font-semibold text-on-surface-variant">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm text-on-surface">
        <Valor>{children}</Valor>
      </dd>
    </div>
  )
}

function Etiquetas({ itens }: { itens: readonly string[] }) {
  if (itens.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {itens.map((item) => (
        <span key={item} className="rounded-md border border-neutral-300 bg-surface-container-low px-2 py-0.5 text-xs font-semibold text-on-surface dark:border-white/20">
          {item}
        </span>
      ))}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Conteúdo de cada cartão [item 1]
// ---------------------------------------------------------------------------

function DadosIdentificacao({ form, siData, seData }: Dados) {
  const natureza = form.categoria === 'rede_externa' ? form.assunto : form.categoria === 'sistemas_internos' ? siData.natureza : seData.natureza
  return (
    <>
      <Par rotulo="Tipo">{form.tipo.trim() !== '' ? <GmudTipoSelo tipo={form.tipo} /> : null}</Par>
      <Par rotulo="Natureza da mudança">{natureza}</Par>
      <Par rotulo="Título" largo>
        {form.titulo}
      </Par>
    </>
  )
}

function DadosOQueSeraFeito({ form, siData, seData }: Dados) {
  if (form.categoria === 'sistemas_internos') {
    return (
      <>
        <Par rotulo="Sistema">{siData.sistemaAfetado === OUTRO ? siData.sistemaAfetadoOutro : siData.sistemaAfetado}</Par>
        <Par rotulo="Ambiente">{siData.ambiente}</Par>
      </>
    )
  }
  if (form.categoria === 'sistemas_externos') {
    return (
      <>
        <Par rotulo="Sistema externo">{seData.sistemaExterno === OUTRO ? seData.sistemaExternoOutro : seData.sistemaExterno}</Par>
        <Par rotulo="Fornecedor">{seData.fornecedor}</Par>
      </>
    )
  }
  const ambiente = collectAmbienteAfetado(form)
  const escopo = formatEscopoRotas(form.escopoRotas)
  const clientes = form.clientesSemSplitter.length
  return (
    <>
      <Par rotulo="POP/site">{form.popSite}</Par>
      <Par rotulo="Abrangência">{escopo !== '' ? escopo : form.popSite.trim() !== '' ? 'POP/site inteiro' : ''}</Par>
      <Par rotulo="Ambiente afetado" largo>
        {ambiente.length > 0 ? <Etiquetas itens={ambiente} /> : null}
      </Par>
      <Par rotulo="Clientes ponto a ponto ou fibra apagada" largo>
        {clientes > 0 ? `${clientes} escolhido${clientes === 1 ? '' : 's'}` : 'Nenhum escolhido'}
      </Par>
    </>
  )
}

function DadosImpacto({ form, siData, seData }: Dados) {
  const detalhe = form.categoria === 'rede_externa' ? form : form.categoria === 'sistemas_internos' ? siData : seData
  return (
    <>
      <Par rotulo="Parada do serviço">
        {form.impactoParada === 'Sim' ? (
          <span className={cn(SELO, 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950')}>
            <PowerOff size={12} aria-hidden />
            Sim
          </span>
        ) : form.impactoParada !== '' ? (
          <span className={cn(SELO, 'bg-surface-container-low text-on-surface ring-1 ring-neutral-300 dark:ring-white/20')}>{form.impactoParada}</span>
        ) : null}
      </Par>
      {detalhe.tipoIndisponibilidade.trim() !== '' ? <Par rotulo="Tipo de indisponibilidade">{detalhe.tipoIndisponibilidade}</Par> : null}
      {detalhe.duracaoEstimada.trim() !== '' ? <Par rotulo="Duração estimada">{detalhe.duracaoEstimada}</Par> : null}
      {form.riscoExecucao.trim() !== '' ? (
        <Par rotulo="Risco durante a execução" largo>
          <span title={form.riscoExecucao}>{curto(form.riscoExecucao)}</span>
        </Par>
      ) : null}
    </>
  )
}

/** [item 2] Quem aprova, pela regra do servidor (ver lib/gmudRevisao.ts). Para tirar: apagar a linha em DadosAprovadores. */
function QuemAprova({ form, siData, seData }: Dados) {
  const quem = quemAprovaAGmud({
    tipo: form.tipo,
    categoria: form.categoria,
    areasImpactadas: siData.areasImpactadas,
    areasAfetadas: seData.areasAfetadas,
    recursosAdministrativos: form.recursosAdministrativos,
  })
  return (
    <div className="min-w-0 sm:col-span-2">
      <dt className="text-xs font-semibold text-on-surface-variant">Quem aprova</dt>
      <dd className="mt-1 space-y-2 text-sm text-on-surface">
        {quem.comite ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className={cn(SELO, 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900')}>
              <Users size={12} aria-hidden />
              Comitê
            </span>
            {quem.areasQueAprovam.length > 0 ? <span className="text-on-surface-variant">e as áreas abaixo, em paralelo:</span> : null}
          </p>
        ) : (
          <p className="flex items-start gap-2">
            <CircleCheck size={16} aria-hidden className="mt-0.5 shrink-0" />
            Ninguém: a Pré-aprovada já nasce liberada.
          </p>
        )}
        <Etiquetas itens={quem.areasQueAprovam} />
        {quem.areasSoAvisadas.length > 0 ? (
          <div className="space-y-1.5">
            <p className="flex items-start gap-2 text-on-surface-variant">
              <Mail size={15} aria-hidden className="mt-0.5 shrink-0" />
              Só recebem e-mail de aviso, sem aprovar:
            </p>
            <Etiquetas itens={quem.areasSoAvisadas} />
          </div>
        ) : null}
      </dd>
    </div>
  )
}

function DadosAprovadores(dados: Dados) {
  const janela = janelaDoForm(dados.form)
  const resumo = resumoDaJanela(janela)
  const duracao = duracaoEmMinutos(janela)
  return (
    <>
      <Par rotulo="Janela" largo>
        {resumo !== '' ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {resumo}
            {duracao !== null && duracao > 0 ? <span className={cn(SELO, 'bg-primary text-neutral-900')}>{rotuloDaDuracao(duracao)} de duração</span> : null}
          </span>
        ) : null}
      </Par>
      <QuemAprova {...dados} />
    </>
  )
}

const CONTEUDO: Partial<Record<WizardStep['key'], (dados: Dados) => React.JSX.Element>> = {
  identificacao: DadosIdentificacao,
  oQueSeraFeito: DadosOQueSeraFeito,
  impacto: DadosImpacto,
  aprovadores: DadosAprovadores,
}

/** [item 5] Editar como botão visível. Para voltar ao link pequeno, trocar as classes aqui. */
function BotaoEditar({ etapa, onClick }: { etapa: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar ${etapa}`}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low dark:border-white/20 sm:min-h-9',
        FOCO,
      )}
    >
      <Pencil size={14} aria-hidden />
      Editar
    </button>
  )
}

/** [item 1] Cartão de uma etapa: situação, dados principais e Editar. */
function CartaoDaEtapa({ step, dados, pendencias, onEditar }: { step: WizardStep; dados: Dados; pendencias: GmudPendencia[]; onEditar: () => void }) {
  const id = useId()
  const Conteudo = CONTEUDO[step.key]
  const n = pendencias.length
  return (
    <section aria-labelledby={id} className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h3 id={id} className="text-base font-bold text-on-surface">
            {step.label}
          </h3>
          {n > 0 ? (
            <span className={cn(SELO, 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200')}>
              <AlertTriangle size={12} aria-hidden />
              {n} pendência{n === 1 ? '' : 's'}
            </span>
          ) : (
            <span className={cn(SELO, 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200')}>
              <Check size={12} aria-hidden strokeWidth={3} />
              Completa
            </span>
          )}
        </div>
        <BotaoEditar etapa={step.label} onClick={onEditar} />
      </div>
      {n > 0 ? (
        <ul className="mt-2 list-inside list-disc text-sm text-amber-900 dark:text-amber-200">
          {pendencias.map((p) => (
            <li key={p.message}>{p.message}</li>
          ))}
        </ul>
      ) : null}
      {Conteudo ? (
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Conteudo {...dados} />
        </dl>
      ) : null}
    </section>
  )
}

/** [item 4] Atenção antes de abrir: faixa vermelha, não bloqueia. Para tirar: apagar a linha em GmudRevisao. */
function AtencaoAntesDeAbrir({ form, agora }: { form: GmudFormState; agora: Date }) {
  const motivos = motivosDeAtencao({ tipo: form.tipo, impactoParada: form.impactoParada, janela: form, protocolos: protocolosDoForm(form), agora })
  if (motivos.length === 0) return null
  return (
    <section
      aria-label="Atenção antes de abrir"
      className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-100"
    >
      <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold">Atenção antes de abrir</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
          {motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** [item 3] O que acontece ao clicar em abrir, em passos. Para tirar: apagar a linha em GmudRevisao. */
function OQueAconteceAoAbrir({ form }: { form: GmudFormState }) {
  const id = useId()
  const passos = passosAoAbrirGmud({ tipo: form.tipo, categoria: form.categoria, protocolos: protocolosDoForm(form) })
  return (
    <section aria-labelledby={id} className={cn(CARD, 'bg-surface-container-low')}>
      <h3 id={id} className="flex items-center gap-2 text-base font-bold text-on-surface">
        <ListOrdered size={18} aria-hidden className="shrink-0" />O que acontece ao clicar em abrir
      </h3>
      <ol className="mt-3 space-y-2.5">
        {passos.map((passo, i) => (
          <li key={passo} className="flex items-start gap-3 text-sm text-on-surface">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-neutral-900">
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
 * Etapa de revisão do formulário de nova GMUD: um cartão por etapa com os dados principais, o aviso de
 * atenção e o que acontece ao abrir. Só mostra: não valida, não envia e não muda o formulário.
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
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="text-lg font-bold text-on-surface">Revisão</h2>
        <p className="text-sm text-on-surface-variant">Confira cada etapa. Para mudar algo, use Editar.</p>
      </div>
      <AtencaoAntesDeAbrir form={form} agora={agora ?? new Date()} />
      {passos.map((step, i) => (
        <CartaoDaEtapa key={step.key} step={step} dados={dados} pendencias={pendenciasDaEtapa(pendencias, step)} onEditar={() => onEditar(i)} />
      ))}
      <OQueAconteceAoAbrir form={form} />
    </div>
  )
}

/**
 * [item 7] Confirmação final, só para os casos de maior risco (Emergencial e Pré-aprovada com repetição).
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
