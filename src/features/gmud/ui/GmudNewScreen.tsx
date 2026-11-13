import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkApprovalAreas } from '@/features/gmud/api/gmudAreaApprovals'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardList, Loader2, Zap } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { createGmud } from '@/features/gmud/api/createGmud'
import { openGmudInElleven } from '@/features/gmud/api/openGmudInElleven'
import {
  collectAmbienteAfetado,
  emptyGmudForm,
  emptyGmudSistemasInternosData,
  emptyGmudSistemasExternosData,
  GMUD_AMBIENTE_OPTIONS,
  GMUD_AMBIENTE_SI_OPTIONS,
  GMUD_AREA_OPTIONS,
  GMUD_CATEGORIA_LABEL,
  GMUD_LISTA_COR,
  GMUD_NATUREZA_RE_OPTIONS,
  GMUD_NATUREZA_SI_OPTIONS,
  GMUD_NATUREZA_SE_OPTIONS,
  GMUD_RECURSO_AREAS,
  GMUD_RECURSO_PAPEIS,
  GMUD_SIM_NAO,
  GMUD_TIPO_INDISPONIBILIDADE_OPTIONS,
  redeExternaCategoriaData,
  GMUD_TIPO_OPTIONS,
  GMUD_TIPO_PRE_APROVADA,
  validateGmudForm,
  validateGmudFormBySection,
  minDataProgramada,
  type GmudCategoria,
  type GmudFormState,
  type GmudRecursoPapel,
  type GmudSistemasInternosData,
  type GmudSistemasExternosData,
} from '@/features/gmud/model/gmudForm'
import {
  GMUD_REPETICAO_MAX_INTERVALO_DIAS,
  GMUD_REPETICAO_MAX_VEZES,
  buildGmudOccurrences,
  buildOccurrenceTitle,
  newSerieId,
  parseRepeticao,
} from '@/features/gmud/lib/gmudRecurrence'
import { openGmudOccurrences } from '@/features/gmud/lib/openGmudOccurrences'
import { GmudPopSiteField } from '@/features/gmud/ui/GmudPopSiteField'
import { GmudEscopoRedeField } from '@/features/gmud/ui/GmudEscopoRedeField'
import { emptyEscopoRede, hasEscopoRede } from '@/features/gmud/model/gmudEscopoRede'
import { GmudMultiSelect } from '@/features/gmud/ui/GmudMultiSelect'
import { GmudDropdownMultiSelect } from '@/features/gmud/ui/GmudDropdownMultiSelect'
import { GmudFormTrail } from '@/features/gmud/ui/GmudFormTrail'
import { pendenciasDaEtapa, primeiraEtapaPendente, wizardStates, wizardSteps } from '@/features/gmud/lib/gmudWizard'
import { clearGmudDraft, draftHasContent, gmudDraftKey, loadGmudDraft, saveGmudDraft } from '@/features/gmud/lib/gmudDraft'
import {
  buildGmudDescription,
  buildGmudTitle,
} from '@/features/gmud/lib/buildGmudAssignmentMask'
import { fetchGmudConfigLists, type GmudConfigItem } from '@/features/gmud/api/gmudConfigLists'
import { cn } from '@/shared/lib/utils'
import { showGmudError } from '@/features/gmud/lib/gmudFeedback'
import { showFeedbackDialog } from '@/shared/store/feedbackDialogStore'

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const CARD =
  'rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 sm:p-5'
const LABEL = 'block text-xs font-semibold text-on-surface-variant'
const FIELD =
  'mt-1 w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

const CATEGORIA_COLORS: Record<GmudCategoria, string> = {
  rede_externa: 'border-sky-300/60 bg-sky-50/60 dark:border-sky-700/40 dark:bg-sky-950/30',
  sistemas_internos: 'border-violet-300/60 bg-violet-50/60 dark:border-violet-700/40 dark:bg-violet-950/30',
  sistemas_externos: 'border-amber-300/60 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-950/30',
}

// ---------------------------------------------------------------------------
// Componentes internos
// ---------------------------------------------------------------------------
/** Âncora estável de uma seção (índice lateral). */
function sectionId(title: string): string {
  return 'gmud-sec-' + title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Etapa atual do formulário: só os cartões das seções da etapa aparecem; os demais ficam montados e ocultos (não perdem o que foi digitado). */
const FormStepContext = createContext<{ visible: ReadonlySet<string> } | null>(null)

function FormCard({ title, children, hint, grid = true }: { title: string; children: React.ReactNode; hint?: string; grid?: boolean }) {
  const ctx = useContext(FormStepContext)
  const visible = ctx ? ctx.visible.has(title) : true
  return (
    <div className={cn(CARD, 'scroll-mt-24')} data-gmud-section={title} id={sectionId(title)} hidden={!visible}>
      <p className="mb-3 text-sm font-bold text-on-surface">{title}</p>
      {hint ? <p className="mb-3 text-xs text-on-surface-variant">{hint}</p> : null}
      {grid ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div> : children}
    </div>
  )
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return <FormCard title={title} hint={hint}>{children}</FormCard>
}

function Field({ label, required, children, full }: { label: string; required?: boolean; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? 'sm:col-span-2' : undefined}>
      <span className={LABEL}>{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  )
}

function SimNaoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className={FIELD} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Escolher…</option>
      {GMUD_SIM_NAO.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Seção: campos comuns (todas as categorias)
// ---------------------------------------------------------------------------
/** Pré-aprovada: não passa por aprovação e pode repetir (a cada N dias, M vezes). */
function PreAprovadaRepeticao({
  form, set,
}: {
  form: GmudFormState
  set: <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) => void
}) {
  const rep = parseRepeticao(form.repeticaoVezes, form.repeticaoIntervaloDias)
  const ocorrencias =
    rep && rep.vezes > 1 && form.dataInicio !== ''
      ? buildGmudOccurrences({ dataInicio: form.dataInicio, dataFim: form.dataFim || form.dataInicio, vezes: rep.vezes, intervaloDias: rep.intervaloDias })
      : []
  const br = (ymd: string) => ymd.split('-').reverse().slice(0, 2).join('/')
  return (
    <div className="col-span-full rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs text-on-surface-variant">
      <p>
        <span className="font-semibold text-on-surface">Pré-aprovada:</span> não passa por aprovação (nem das áreas, nem do
        Comitê). O protocolo já nasce liberado.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-semibold text-on-surface">Quantos protocolos abrir</span>
          <input
            type="number" min={1} max={GMUD_REPETICAO_MAX_VEZES} className={FIELD}
            value={form.repeticaoVezes} onChange={(e) => set('repeticaoVezes', e.target.value)}
          />
          <span className="mt-1 block text-[11px]">1 = sem repetição. Máximo {GMUD_REPETICAO_MAX_VEZES}.</span>
        </label>
        <label className="block">
          <span className="font-semibold text-on-surface">Repetir a cada (dias)</span>
          <input
            type="number" min={1} max={GMUD_REPETICAO_MAX_INTERVALO_DIAS} className={FIELD}
            value={form.repeticaoIntervaloDias} onChange={(e) => set('repeticaoIntervaloDias', e.target.value)}
            disabled={(rep?.vezes ?? Number(form.repeticaoVezes)) <= 1}
          />
          <span className="mt-1 block text-[11px]">Mesmo horário de início e fim em todas.</span>
        </label>
      </div>
      {ocorrencias.length > 0 ? (
        <p className="mt-3">
          Serão abertos <span className="font-semibold text-on-surface">{ocorrencias.length} protocolos</span> agora, cada um
          com a sua data: {ocorrencias.map((o) => br(o.dataInicio)).join(', ')}.
        </p>
      ) : null}
    </div>
  )
}

const TIPO_DESCRICAO: Record<string, string> = {
  Programada: 'Passa pelas áreas e pelo Comitê',
  Emergencial: 'Vai direto ao Comitê',
  'Pré-aprovada': 'Sem aprovação · pode repetir',
}

function CamposComuns({
  form, set, categoria,
}: {
  form: GmudFormState
  set: <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) => void
  categoria: GmudCategoria
}) {
  const naturezaOptions =
    categoria === 'rede_externa' ? GMUD_NATUREZA_RE_OPTIONS
    : categoria === 'sistemas_internos' ? GMUD_NATUREZA_SI_OPTIONS
    : GMUD_NATUREZA_SE_OPTIONS

  return (
    <Section title="Identificação">
      <div className="sm:col-span-2">
        <span className={LABEL}>Tipo da GMUD *</span>
        <div role="radiogroup" aria-label="Tipo da GMUD" className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {GMUD_TIPO_OPTIONS.map((o) => {
            const bloqueada = o === GMUD_TIPO_PRE_APROVADA && categoria !== 'rede_externa'
            const ativo = form.tipo === o
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={ativo}
                disabled={bloqueada}
                onClick={() => set('tipo', o)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                  ativo
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-neutral-200/80 bg-surface-container-lowest hover:bg-surface-container-low dark:border-white/10',
                )}
              >
                <span className="block text-sm font-semibold text-on-surface">{o}</span>
                <span className="mt-0.5 block text-[11px] text-on-surface-variant">
                  {bloqueada ? 'Só para Rede Externa' : (TIPO_DESCRICAO[o] ?? '')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {form.tipo === GMUD_TIPO_PRE_APROVADA ? <PreAprovadaRepeticao form={form} set={set} /> : null}
      {categoria === 'rede_externa' ? (
        <Field label="Natureza da mudança" required>
          <select className={FIELD} value={form.assunto} onChange={(e) => set('assunto', e.target.value)}>
            <option value="">Escolher…</option>
            {naturezaOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Título da GMUD" required full>
        <input className={FIELD} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
      </Field>
      <Field label="Área do solicitante">
        <select className={FIELD} value={form.areaSolicitante} onChange={(e) => set('areaSolicitante', e.target.value)}>
          <option value="">Escolher…</option>
          {GMUD_AREA_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="Nome do solicitante">
        <input className={FIELD} value={form.solicitanteNome} onChange={(e) => set('solicitanteNome', e.target.value)} />
      </Field>
      <Field label="E-mail do solicitante" full>
        <input
          type="email"
          className={FIELD}
          value={form.solicitanteEmail}
          onChange={(e) => set('solicitanteEmail', e.target.value)}
        />
        <span className="mt-1 block text-[11px] text-on-surface-variant/70">
          Preenchido do seu login — edite se estiver abrindo para outra pessoa (define o solicitante no Elleven).
        </span>
      </Field>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Seção: Janela de mudança (comum a todas as categorias)
// ---------------------------------------------------------------------------
function JanelaDeMudanca({
  form, set,
}: {
  form: GmudFormState
  set: <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) => void
}) {
  const minInicio = form.tipo === 'Programada' || form.tipo === GMUD_TIPO_PRE_APROVADA ? minDataProgramada() : undefined
  return (
    <Section title="Janela de mudança">
      <Field label="Data início" required>
        <input type="date" className={FIELD} value={form.dataInicio} min={minInicio} onChange={(e) => set('dataInicio', e.target.value)} />
        {minInicio ? (
          <p className="mt-1 text-[11px] text-on-surface-variant">
            {form.tipo}: a partir de {minInicio.split('-').reverse().join('/')} (apresentação na terça + 7 dias).
          </p>
        ) : null}
      </Field>
      <Field label="Horário início" required>
        <input type="time" className={FIELD} value={form.horaInicio} onChange={(e) => set('horaInicio', e.target.value)} />
      </Field>
      <Field label="Data fim" required>
        <input type="date" className={FIELD} value={form.dataFim} min={form.dataInicio || undefined} onChange={(e) => set('dataFim', e.target.value)} />
      </Field>
      <Field label="Horário fim (deadline)" required>
        <input type="time" className={FIELD} value={form.horaFim} onChange={(e) => set('horaFim', e.target.value)} />
      </Field>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Seção: Observações (comum)
// ---------------------------------------------------------------------------
function Observacoes({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <Section title="Observações (opcional)">
      <Field label="Observações" full>
        <textarea
          className={cn(FIELD, 'min-h-[70px]')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Qualquer detalhe adicional — entra na máscara do protocolo no Elleven"
        />
      </Field>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Matriz "Recursos administrativos" — comum às 3 categorias
// ---------------------------------------------------------------------------
function RecursosAdministrativosCard({
  form, set, areas, destacar = [],
}: {
  form: GmudFormState
  set: <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) => void
  /** Linhas da matriz: as áreas da configuração. */
  areas: string[]
  /** Áreas já marcadas como impactadas/afetadas: aparecem mesmo em N/A. */
  destacar?: string[]
}) {
  // Rede externa não tem lista de áreas marcadas acima: a matriz é o único lugar para escolher.
  const [todas, setTodas] = useState(form.categoria === 'rede_externa')
  const setRecurso = (area: string, papel: GmudRecursoPapel) =>
    set('recursosAdministrativos', { ...form.recursosAdministrativos, [area]: papel })
  const complemento =
    form.categoria === 'rede_externa'
      ? ''
      : ` Valem também as áreas ${form.categoria === 'sistemas_internos' ? 'impactadas' : 'afetadas'} marcadas acima.`
  const lista = areas.length > 0 ? areas : [...GMUD_RECURSO_AREAS]
  const emUso = (area: string) => (form.recursosAdministrativos[area] ?? 'na') !== 'na' || destacar.includes(area)
  const visiveis = todas ? lista : lista.filter(emUso)
  const escondidas = lista.length - visiveis.length

  return (
    <FormCard title="Recursos administrativos" grid={false}>
      <p className="mb-3 mt-0.5 text-xs text-on-surface-variant">
        {form.tipo === 'Pré-aprovada' || form.tipo === 'Emergencial'
          ? `${form.tipo === 'Emergencial' ? 'Emergencial vai direto ao Comitê' : 'Pré-aprovada não passa por aprovação'}: as áreas marcadas como Executor, Validador ou Observador só são avisadas por e-mail.${complemento}`
          : `Áreas marcadas como Executor, Validador ou Observador aprovam a GMUD (basta uma pessoa por área; com todas as áreas e o Comitê aprovando, a GMUD é liberada). N/A não aprova.${complemento}`}
      </p>
      <ul className="divide-y divide-neutral-200/60 dark:divide-white/5">
        {visiveis.map((area) => {
          const atual = form.recursosAdministrativos[area] ?? 'na'
          return (
            <li key={area} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm font-medium text-on-surface">{area}</span>
              <div role="radiogroup" aria-label={`Papel de ${area}`} className="flex rounded-lg bg-surface-container-low p-0.5 ring-1 ring-neutral-200/70 dark:ring-white/10">
                {GMUD_RECURSO_PAPEIS.map((p) => (
                  <label
                    key={p.value}
                    className={cn(
                      'cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition focus-within:ring-2 focus-within:ring-primary/50',
                      atual === p.value
                        ? p.value === 'na'
                          ? 'bg-surface-container-lowest text-on-surface shadow-sm ring-1 ring-neutral-300 dark:ring-white/20'
                          : 'bg-primary/25 text-on-surface shadow-sm ring-1 ring-primary'
                        : 'text-on-surface-variant hover:text-on-surface',
                    )}
                  >
                    <input
                      type="radio"
                      name={`recurso-${area}`}
                      className="sr-only"
                      checked={atual === p.value}
                      onChange={() => setRecurso(area, p.value)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </li>
          )
        })}
        {visiveis.length === 0 ? <li className="py-2 text-xs text-on-surface-variant">Nenhuma área em uso. Mostre todas para escolher.</li> : null}
      </ul>
      {escondidas > 0 || todas ? (
        <button
          type="button"
          onClick={() => setTodas((v) => !v)}
          className="mt-2 text-xs font-semibold text-primary hover:underline"
        >
          {todas ? 'Mostrar só as áreas em uso' : `Mostrar todas as áreas (+${escondidas} em N/A)`}
        </button>
      ) : null}
    </FormCard>
  )
}

/** Agrupa as opções de ambiente pelo prefixo ("Serviço:", "Sistemas:"); o resto é rede e infraestrutura. */
function groupAmbienteOptions(options: readonly string[]): Array<{ title: string; items: Array<{ value: string; label: string }> }> {
  const groups: Array<{ title: string; prefix: string; items: Array<{ value: string; label: string }> }> = [
    { title: 'Rede e infraestrutura', prefix: '', items: [] },
    { title: 'Serviços', prefix: 'Serviço:', items: [] },
    { title: 'Sistemas', prefix: 'Sistemas:', items: [] },
  ]
  for (const value of options) {
    const g = groups.find((x) => x.prefix !== '' && value.startsWith(x.prefix)) ?? groups[0]
    g?.items.push({ value, label: g.prefix !== '' ? value.slice(g.prefix.length).trim() : value })
  }
  return groups.filter((g) => g.items.length > 0)
}

/** Seleção do ambiente afetado: uma linha com as etiquetas escolhidas; a lista agrupada abre sobre a tela. */
function AmbienteAfetadoPicker({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (value: string) => void }) {
  const groups = groupAmbienteOptions(options)
  return (
    <GmudDropdownMultiSelect
      options={groups.flatMap((g) => g.items.map((it) => ({ value: it.value, label: it.label, group: g.title })))}
      selected={selected}
      onToggle={onToggle}
      placeholder="Selecionar ambientes…"
      ariaLabel="Ambiente afetado"
    />
  )
}

// ---------------------------------------------------------------------------
// Seções específicas de Rede Externa
// ---------------------------------------------------------------------------
function RedeExternaFields({
  form, set, areas,
}: {
  form: GmudFormState
  set: <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) => void
  /** Linhas da matriz "Recursos administrativos": as áreas da configuração. */
  areas: string[]
}) {
  const toggleAmbiente = (opt: string) =>
    set(
      'ambienteAfetado',
      form.ambienteAfetado.includes(opt)
        ? form.ambienteAfetado.filter((o) => o !== opt)
        : [...form.ambienteAfetado, opt],
    )

  return (
    <>
      <Section title="Atividade">
        <Field label="Descrição da atividade" required full>
          <textarea className={cn(FIELD, 'min-h-[90px]')} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
        </Field>
        <Field label="POP/Site" required>
          <GmudPopSiteField
            className={FIELD}
            value={form.popSite}
            onChange={(v) => {
              set('popSite', v)
              // O afunilamento pertence ao site escolhido: trocar o site descarta a escolha anterior.
              if (hasEscopoRede(form.escopoRede)) set('escopoRede', emptyEscopoRede())
            }}
          />
        </Field>
        <Field label="Risco(s) da não implementação" required>
          <input className={FIELD} value={form.riscoNaoImplementacao} onChange={(e) => set('riscoNaoImplementacao', e.target.value)} />
        </Field>
        <GmudEscopoRedeField popSite={form.popSite} value={form.escopoRede} onChange={(v) => set('escopoRede', v)} />
      </Section>

      <FormCard title="Ambiente afetado" grid={false}>
        <p className="text-xs font-semibold text-on-surface-variant">Ambiente afetado *</p>
        <AmbienteAfetadoPicker options={GMUD_AMBIENTE_OPTIONS} selected={form.ambienteAfetado} onToggle={toggleAmbiente} />
        <label className="mt-3 block">
          <span className={LABEL}>Outro (especificar)</span>
          <input
            className={FIELD}
            value={form.ambienteOutro}
            onChange={(e) => set('ambienteOutro', e.target.value)}
            placeholder="Se o ambiente não estiver na lista acima"
          />
        </label>
      </FormCard>

      <Section title="Impacto">
        <Field label="Comunica cliente?" required>
          <select className={FIELD} value={form.comunicaCliente} onChange={(e) => set('comunicaCliente', e.target.value)}>
            <option value="">Escolher…</option>
            {GMUD_SIM_NAO.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Haverá impacto de parada do serviço?" required>
          <select className={FIELD} value={form.impactoParada} onChange={(e) => set('impactoParada', e.target.value)}>
            <option value="">Escolher…</option>
            {GMUD_SIM_NAO.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        {form.impactoParada === 'Sim' ? (
          <>
            <Field label="Indisponibilidade parcial ou total">
              <select className={FIELD} value={form.tipoIndisponibilidade} onChange={(e) => set('tipoIndisponibilidade', e.target.value)}>
                <option value="">Escolher…</option>
                {GMUD_TIPO_INDISPONIBILIDADE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Duração estimada">
              <input className={FIELD} value={form.duracaoEstimada} onChange={(e) => set('duracaoEstimada', e.target.value)} placeholder="Ex.: 30 minutos, 2 horas" />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="Execução">
        <Field label="Plano de execução da GMUD" required full>
          <textarea className={cn(FIELD, 'min-h-[80px]')} value={form.planoExecucao} onChange={(e) => set('planoExecucao', e.target.value)} />
        </Field>
        <Field label="Risco(s) durante a execução" required full>
          <textarea className={cn(FIELD, 'min-h-[70px]')} value={form.riscoExecucao} onChange={(e) => set('riscoExecucao', e.target.value)} />
        </Field>
        <Field label="Plano de rollback (retorno)" required full>
          <textarea className={cn(FIELD, 'min-h-[70px]')} value={form.planoRollback} onChange={(e) => set('planoRollback', e.target.value)} />
        </Field>
      </Section>

      <RecursosAdministrativosCard form={form} set={set} areas={areas} />

      <Section title="Alinhamento">
        <Field label="Caso necessário informar clientes, a lista de clientes impactados foi enviada ao COR?" required full>
          <select className={FIELD} value={form.listaClientesCor} onChange={(e) => set('listaClientesCor', e.target.value)}>
            <option value="">Escolher…</option>
            {GMUD_LISTA_COR.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Seções específicas de Sistemas Internos
// ---------------------------------------------------------------------------
function SistemasInternosFields({
  si, setSi, impactoParada, setImpactoParada, descricao, setDescricao, planoExecucao, setPlanoExecucao, planoRollback, setPlanoRollback, areasOptions, sistemasInternosOptions, listsLoading,
}: {
  si: GmudSistemasInternosData
  setSi: (updater: (prev: GmudSistemasInternosData) => GmudSistemasInternosData) => void
  impactoParada: string
  setImpactoParada: (v: string) => void
  descricao: string
  setDescricao: (v: string) => void
  planoExecucao: string
  setPlanoExecucao: (v: string) => void
  planoRollback: string
  setPlanoRollback: (v: string) => void
  areasOptions: GmudConfigItem[]
  sistemasInternosOptions: GmudConfigItem[]
  listsLoading: boolean
}) {
  const s = <K extends keyof GmudSistemasInternosData>(key: K, value: GmudSistemasInternosData[K]) =>
    setSi((prev) => ({ ...prev, [key]: value }))

  return (
    <>
      <Section title="Sistema">
        <Field label="Sistema afetado" required>
          <select className={FIELD} value={si.sistemaAfetado} onChange={(e) => s('sistemaAfetado', e.target.value)}>
            <option value="">Escolher…</option>
            {sistemasInternosOptions.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
            <option value="Outro (especificar)">Outro (especificar)</option>
          </select>
        </Field>
        {si.sistemaAfetado === 'Outro (especificar)' ? (
          <Field label="Nome do sistema" required>
            <input className={FIELD} value={si.sistemaAfetadoOutro} onChange={(e) => s('sistemaAfetadoOutro', e.target.value)} placeholder="Nome do sistema interno" />
          </Field>
        ) : null}
        <Field label="Ambiente" required>
          <select className={FIELD} value={si.ambiente} onChange={(e) => s('ambiente', e.target.value)}>
            <option value="">Escolher…</option>
            {GMUD_AMBIENTE_SI_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Natureza da mudança" required>
          <select className={FIELD} value={si.natureza} onChange={(e) => s('natureza', e.target.value)}>
            <option value="">Escolher…</option>
            {GMUD_NATUREZA_SI_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Descrição">
        <Field label="Objetivo / Descrição da mudança" required full>
          <textarea className={cn(FIELD, 'min-h-[90px]')} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o objetivo e o que será feito" />
        </Field>
      </Section>

      <Section title="Impacto">
        <Field label="Áreas impactadas" required full>
          <GmudMultiSelect
            label="Áreas"
            options={areasOptions}
            value={si.areasImpactadas}
            onChange={(v) => s('areasImpactadas', v)}
            loading={listsLoading}
          />
          <span className="mt-1 block text-[11px] text-on-surface-variant/70">
            As pessoas cadastradas nas áreas marcadas serão avisadas por e-mail quando o Comitê aprovar a GMUD.
          </span>
        </Field>
        <Field label="Haverá indisponibilidade?" required>
          <SimNaoSelect value={impactoParada} onChange={setImpactoParada} />
        </Field>
        {impactoParada === 'Sim' ? (
          <>
            <Field label="Indisponibilidade parcial ou total">
              <select className={FIELD} value={si.tipoIndisponibilidade} onChange={(e) => s('tipoIndisponibilidade', e.target.value)}>
                <option value="">Escolher…</option>
                {GMUD_TIPO_INDISPONIBILIDADE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Duração estimada">
              <input className={FIELD} value={si.duracaoEstimada} onChange={(e) => s('duracaoEstimada', e.target.value)} placeholder="Ex.: 30 minutos, 2 horas" />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="Execução">
        <Field label="Plano de execução" required full>
          <textarea className={cn(FIELD, 'min-h-[80px]')} value={planoExecucao} onChange={(e) => setPlanoExecucao(e.target.value)} />
        </Field>
        <Field label="Plano de rollback" required full>
          <textarea className={cn(FIELD, 'min-h-[70px]')} value={planoRollback} onChange={(e) => setPlanoRollback(e.target.value)} />
        </Field>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Seções específicas de Sistemas Externos
// ---------------------------------------------------------------------------
function SistemasExternosFields({
  se, setSe, impactoParada, setImpactoParada, descricao, setDescricao, planoExecucao, setPlanoExecucao, areasOptions, sistemasExternosOptions, listsLoading,
}: {
  se: GmudSistemasExternosData
  setSe: (updater: (prev: GmudSistemasExternosData) => GmudSistemasExternosData) => void
  impactoParada: string
  setImpactoParada: (v: string) => void
  descricao: string
  setDescricao: (v: string) => void
  planoExecucao: string
  setPlanoExecucao: (v: string) => void
  areasOptions: GmudConfigItem[]
  sistemasExternosOptions: GmudConfigItem[]
  listsLoading: boolean
}) {
  const s = <K extends keyof GmudSistemasExternosData>(key: K, value: GmudSistemasExternosData[K]) =>
    setSe((prev) => ({ ...prev, [key]: value }))

  return (
    <>
      <Section title="Sistema e fornecedor">
        <Field label="Sistema externo afetado" required>
          <select className={FIELD} value={se.sistemaExterno} onChange={(e) => s('sistemaExterno', e.target.value)}>
            <option value="">Escolher…</option>
            {sistemasExternosOptions.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
            <option value="Outro (especificar)">Outro (especificar)</option>
          </select>
        </Field>
        {se.sistemaExterno === 'Outro (especificar)' ? (
          <Field label="Nome do sistema" required>
            <input className={FIELD} value={se.sistemaExternoOutro} onChange={(e) => s('sistemaExternoOutro', e.target.value)} placeholder="Nome do sistema ou fornecedor" />
          </Field>
        ) : null}
        <Field label="Fornecedor">
          <input className={FIELD} value={se.fornecedor} onChange={(e) => s('fornecedor', e.target.value)} />
        </Field>
        <Field label="Natureza da mudança" required>
          <select className={FIELD} value={se.natureza} onChange={(e) => s('natureza', e.target.value)}>
            <option value="">Escolher…</option>
            {GMUD_NATUREZA_SE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Chamado no fornecedor">
          <input
            className={FIELD}
            value={se.chamadoFornecedor}
            onChange={(e) => s('chamadoFornecedor', e.target.value)}
            placeholder="Opcional — referência ao chamado no fornecedor"
          />
        </Field>
      </Section>

      <Section title="Mudança prevista">
        <Field label="Descrição da mudança" required full>
          <textarea className={cn(FIELD, 'min-h-[90px]')} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que o fornecedor vai fazer e qual o impacto esperado" />
        </Field>
      </Section>

      <Section title="Impacto">
        <Field label="Áreas afetadas" required full>
          <GmudMultiSelect
            label="Áreas"
            options={areasOptions}
            value={se.areasAfetadas}
            onChange={(v) => s('areasAfetadas', v)}
            loading={listsLoading}
          />
          <span className="mt-1 block text-[11px] text-on-surface-variant/70">
            As pessoas cadastradas nas áreas marcadas serão avisadas por e-mail quando o Comitê aprovar a GMUD.
          </span>
        </Field>
        <Field label="Haverá indisponibilidade?" required>
          <SimNaoSelect value={impactoParada} onChange={setImpactoParada} />
        </Field>
        {impactoParada === 'Sim' ? (
          <>
            <Field label="Indisponibilidade parcial ou total">
              <select className={FIELD} value={se.tipoIndisponibilidade} onChange={(e) => s('tipoIndisponibilidade', e.target.value)}>
                <option value="">Escolher…</option>
                {GMUD_TIPO_INDISPONIBILIDADE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Duração estimada">
              <input className={FIELD} value={se.duracaoEstimada} onChange={(e) => s('duracaoEstimada', e.target.value)} placeholder="Ex.: 2 horas, janela de manutenção" />
            </Field>
          </>
        ) : null}
      </Section>

      <Section title="Contingência">
        <Field label="Plano de contingência/execução" required full>
          <textarea className={cn(FIELD, 'min-h-[80px]')} value={planoExecucao} onChange={(e) => setPlanoExecucao(e.target.value)} />
        </Field>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
export function GmudNewScreen() {
  const navigate = useNavigate()
  const profile = useAccessAuthStore((s) => s.profile)
  const rascunhoKey = gmudDraftKey(profile?.email ?? '')
  // Rascunho guardado neste navegador: recupera na abertura (o aviso permite descartar).
  const [rascunhoInicial] = useState(() =>
    typeof window === 'undefined'
      ? null
      : loadGmudDraft(window.localStorage, rascunhoKey, {
          form: emptyGmudForm(profile?.email ?? '', profile?.displayName ?? ''),
          si: emptyGmudSistemasInternosData(),
          se: emptyGmudSistemasExternosData(),
        }),
  )
  const [rascunhoRecuperadoEm, setRascunhoRecuperadoEm] = useState<string | null>(rascunhoInicial?.savedAt ?? null)
  const enviadoRef = useRef(false)
  const [form, setForm] = useState<GmudFormState>(() =>
    rascunhoInicial?.form ?? emptyGmudForm(profile?.email ?? '', profile?.displayName ?? ''),
  )
  const [siData, setSiData] = useState<GmudSistemasInternosData>(() => rascunhoInicial?.si ?? emptyGmudSistemasInternosData())
  const [seData, setSeData] = useState<GmudSistemasExternosData>(() => rascunhoInicial?.se ?? emptyGmudSistemasExternosData())
  const idempotencyKeyRef = useRef<string | null>(null)

  const { data: configLists, isLoading: listsLoading } = useQuery({
    queryKey: ['gmud-config-lists'],
    queryFn: fetchGmudConfigLists,
    staleTime: 5 * 60 * 1000,
  })
  const areasOptions = configLists?.areas ?? []
  const sistemasInternosOptions = configLists?.sistemas_internos ?? []
  const sistemasExternosOptions = configLists?.sistemas_externos ?? []

  const set = <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleCategoriaChange = (cat: GmudCategoria) => {
    // Troca de categoria não descarta dados já preenchidos — apenas muda a visualização.
    set('categoria', cat)
    // Limpa assunto quando sai de Rede Externa (campo é RE-específico).
    if (cat !== 'rede_externa') set('assunto', '')
  }

  const activeCategoriaData =
    form.categoria === 'sistemas_internos' ? siData
    : form.categoria === 'sistemas_externos' ? seData
    : redeExternaCategoriaData(form)

  const serieIdRef = useRef<string | null>(null)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    onError: (error) => showGmudError(error, 'Não foi possível registrar a GMUD'),
    mutationFn: async () => {
      if (idempotencyKeyRef.current === null) {
        idempotencyKeyRef.current =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      }
      // Toda área que precisa aprovar tem de ter quem aprove ANTES de abrir o protocolo no Elleven,
      // para não deixar protocolo aberto sem como seguir.
      const areasCheck = await checkApprovalAreas({
        tipo: form.tipo,
        categoria: form.categoria,
        categoriaData: activeCategoriaData,
        recursosAdministrativos: form.recursosAdministrativos,
      })
      if (areasCheck.semResponsavel.length > 0) {
        throw new Error(
          `Sem responsável cadastrado para aprovar: ${areasCheck.semResponsavel.join(', ')}. Peça ao administrador para cadastrar em GMUD > Configurações.`,
        )
      }
      // Pré-aprovada pode repetir (a cada N dias, M vezes): cada ocorrência é um protocolo próprio, aberto agora,
      // com a mesma máscara e a janela deslocada. A ligação entre elas (categoriaData.serie) é só informativa.
      const rep = form.tipo === GMUD_TIPO_PRE_APROVADA ? parseRepeticao(form.repeticaoVezes, form.repeticaoIntervaloDias) : null
      const occurrences =
        rep && rep.vezes > 1
          ? buildGmudOccurrences({ dataInicio: form.dataInicio, dataFim: form.dataFim, vezes: rep.vezes, intervaloDias: rep.intervaloDias })
          : [{ indice: 1, total: 1, dataInicio: form.dataInicio, dataFim: form.dataFim }]
      if (occurrences.length > 1 && serieIdRef.current === null) serieIdRef.current = newSerieId()
      return openGmudOccurrences({
        occurrences,
        idempotencyKeyBase: idempotencyKeyRef.current,
        openOne: async (occ, idempotencyKey) => {
          const occForm = { ...form, dataInicio: occ.dataInicio, dataFim: occ.dataFim }
          const result = await openGmudInElleven({
            solicitanteEmail: occForm.solicitanteEmail,
            titulo: buildOccurrenceTitle(
              buildGmudTitle(
                occForm,
                occForm.categoria === 'sistemas_internos' ? siData : null,
                occForm.categoria === 'sistemas_externos' ? seData : null,
              ),
              occ.indice,
              occ.total,
            ),
            descricao: buildGmudDescription(
              occForm,
              occForm.categoria === 'sistemas_internos' ? siData : null,
              occForm.categoria === 'sistemas_externos' ? seData : null,
            ),
            finalDateLocal: `${occ.dataFim}T${occForm.horaFim}:00`,
            idempotencyKey: idempotencyKey ?? undefined,
          })
          if (result.protocol == null) {
            throw new Error('O Elleven não retornou o número do protocolo da GMUD.')
          }
          return { protocol: String(result.protocol), assignmentId: result.assignmentId }
        },
        registerOne: async (occ, opened) => {
          const occForm = { ...form, dataInicio: occ.dataInicio, dataFim: occ.dataFim }
          const base = activeCategoriaData
          const categoriaData = occurrences.length > 1 && serieIdRef.current !== null && rep
            ? {
                ...(base ?? { tipoIndisponibilidade: '', duracaoEstimada: '' }),
                serie: { id: serieIdRef.current, indice: occ.indice, total: occ.total, intervaloDias: rep.intervaloDias },
              }
            : base
          await createGmud({
            ...occForm,
            voalleProtocol: opened.protocol,
            assignmentId: opened.assignmentId,
            ambienteAfetado: collectAmbienteAfetado(occForm),
            categoriaData,
          })
        },
      })
    },
    onSuccess: (protocols) => {
      enviadoRef.current = true
      clearGmudDraft(window.localStorage, rascunhoKey)
      idempotencyKeyRef.current = null
      serieIdRef.current = null
      // A lista e a agenda precisam mostrar a GMUD nova assim que a tela voltar.
      void queryClient.invalidateQueries({ queryKey: ['gmud'] })
      navigate('/gmud')
      const first = protocols[0]
      const preAprovada = form.tipo === GMUD_TIPO_PRE_APROVADA
      showFeedbackDialog({
        variant: 'success',
        title: protocols.length > 1 ? `${protocols.length} GMUDs registradas` : `GMUD ${first} registrada`,
        message:
          preAprovada
            ? protocols.length > 1
              ? `Foram abertos os protocolos ${protocols.join(', ')} no Elleven. A GMUD Pré-aprovada não passa por aprovação: todos já estão liberados.`
              : 'O protocolo foi aberto no Elleven. A GMUD Pré-aprovada não passa por aprovação: já está liberada.'
            : form.tipo === 'Emergencial'
              ? 'O protocolo foi aberto no Elleven e a GMUD segue direto para o Comitê.'
              : 'O protocolo foi aberto no Elleven e registrado na plataforma. As áreas envolvidas vão receber por e-mail o pedido de aprovação.',
        secondary: { label: 'Ver GMUD', onClick: () => navigate(`/gmud/${first}`) },
      })
    },
  })

  const handleSubmit = () => {
    const miss = validateGmudForm(
      form,
      form.categoria === 'sistemas_internos' ? siData : null,
      form.categoria === 'sistemas_externos' ? seData : null,
    )
    if (miss.length > 0) {
      const idx = primeiraEtapaPendente(passos, pendenciasDetalhe)
      if (idx >= 0) irParaEtapa(idx)
      showFeedbackDialog({
        variant: 'warning',
        title: 'Corrija antes de enviar',
        message: 'Ajuste os pontos abaixo e envie novamente.',
        items: miss,
      })
      return
    }
    mutation.mutate()
  }

  const canSubmit = !mutation.isPending
  const pendenciasDetalhe = validateGmudFormBySection(
    form,
    form.categoria === 'sistemas_internos' ? siData : null,
    form.categoria === 'sistemas_externos' ? seData : null,
  )
  const passos = wizardSteps(form.categoria)
  const ultimaEtapa = passos.length - 1
  const [etapa, setEtapa] = useState(rascunhoInicial?.etapa ?? 0)
  const [maxEtapa, setMaxEtapa] = useState(rascunhoInicial?.maxEtapa ?? 0)
  const [aviso, setAviso] = useState<string[]>([])
  const trailRef = useRef<HTMLDivElement>(null)
  const irParaEtapa = (i: number) => {
    const destino = Math.min(Math.max(i, 0), ultimaEtapa)
    setEtapa(destino)
    setMaxEtapa((m) => Math.max(m, destino))
    setAviso([])
    window.setTimeout(() => trailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }
  const proximaEtapa = () => {
    const passo = passos[etapa]
    const pend = passo ? pendenciasDaEtapa(pendenciasDetalhe, passo) : []
    if (pend.length > 0) {
      setAviso(pend.map((p) => p.message))
      return
    }
    irParaEtapa(etapa + 1)
  }
  // O aviso some sozinho conforme a pessoa resolve cada pendência.
  const avisoAtual = aviso.filter((m) => pendenciasDetalhe.some((p) => p.message === m))
  const estados = wizardStates(passos, etapa, maxEtapa, pendenciasDetalhe)
  const contagens = passos.map((p) => pendenciasDaEtapa(pendenciasDetalhe, p).length)
  const secoesVisiveis = new Set(passos[etapa]?.sections ?? [])

  // Rascunho: guarda o que foi digitado (sem formulário em branco) e some ao enviar.
  useEffect(() => {
    if (enviadoRef.current) return
    const t = window.setTimeout(() => {
      if (enviadoRef.current) return
      if (!draftHasContent(form, emptyGmudForm(profile?.email ?? '', profile?.displayName ?? ''))) {
        clearGmudDraft(window.localStorage, rascunhoKey)
        return
      }
      saveGmudDraft(window.localStorage, rascunhoKey, { etapa, maxEtapa, form, si: siData, se: seData })
    }, 600)
    return () => window.clearTimeout(t)
  }, [form, siData, seData, etapa, maxEtapa, rascunhoKey, profile?.email, profile?.displayName])

  const descartarRascunho = () => {
    clearGmudDraft(window.localStorage, rascunhoKey)
    setForm(emptyGmudForm(profile?.email ?? '', profile?.displayName ?? ''))
    setSiData(emptyGmudSistemasInternosData())
    setSeData(emptyGmudSistemasExternosData())
    setEtapa(0)
    setMaxEtapa(0)
    setAviso([])
    setRascunhoRecuperadoEm(null)
  }

  const janelaResumo =
    form.dataInicio !== ''
      ? `${form.dataInicio.split('-').reverse().slice(0, 2).join('/')} ${form.horaInicio} → ${form.dataFim.split('-').reverse().slice(0, 2).join('/')} ${form.horaFim}`.trim()
      : ''
  const aprovam = Object.values(form.recursosAdministrativos).filter((p) => p !== 'na').length
  const resumoEtapa = (i: number): string => {
    if (i === 0) return [form.tipo, form.titulo].filter((x) => x.trim() !== '').join(' · ')
    if (i === 1) {
      if (form.categoria === 'rede_externa') return [form.popSite, collectAmbienteAfetado(form).join(', ')].filter((x) => x.trim() !== '').join(' · ')
      return form.categoria === 'sistemas_internos' ? siData.sistemaAfetado : seData.sistemaExterno
    }
    if (i === 2) return form.impactoParada !== '' ? `Parada do serviço: ${form.impactoParada}` : ''
    if (i === 3) return [janelaResumo, aprovam > 0 ? `${aprovam} área${aprovam === 1 ? '' : 's'} aprova${aprovam === 1 ? '' : 'm'}` : ''].filter((x) => x !== '').join(' · ')
    return ''
  }

  return (
    <div className="mx-auto min-w-0 max-w-[1480px] space-y-4">
      <AppPageHeader
        badge="Gestão de Mudança de Rede"
        title="Abrir GMUD"
        description="Requisição de mudança — abre o protocolo no Elleven e registra na plataforma em um passo só."
        icon={ClipboardList}
        primaryAction={{ to: '/gmud', label: 'Voltar às GMUDs' }}
      />

      <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-on-surface-variant">
        <Zap size={15} className="mt-0.5 shrink-0 text-primary" />
        <span>
          Ao registrar, a plataforma <span className="font-semibold text-on-surface">abre o
          protocolo no Elleven automaticamente</span> e preenche o número sozinha — igual à abertura
          de massiva. O e-mail do solicitante define o responsável no Elleven.
        </span>
      </div>

      {/* Seletor de categoria — em destaque no topo do formulário */}
      <div className={`${CARD} ${CATEGORIA_COLORS[form.categoria]}`}>
        <p className="mb-3 text-sm font-bold text-on-surface">Categoria da GMUD *</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['rede_externa', 'sistemas_internos', 'sistemas_externos'] as GmudCategoria[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoriaChange(cat)}
              className={cn(
                'rounded-lg border px-4 py-3 text-left text-sm font-semibold transition',
                form.categoria === cat
                  ? 'border-primary bg-primary/15 text-on-surface shadow-sm ring-1 ring-primary'
                  : 'border-neutral-200/70 dark:border-white/10 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low',
              )}
            >
              {GMUD_CATEGORIA_LABEL[cat]}
              <span className="mt-1 block text-[11px] font-normal opacity-80">
                {cat === 'rede_externa' && 'Infraestrutura, OLTs, backbone, sites'}
                {cat === 'sistemas_internos' && 'Hub Apps, plataformas, sistemas Sebratel'}
                {cat === 'sistemas_externos' && 'Voalle, GeoGrid, Matrix, fornecedores'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {rascunhoRecuperadoEm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200/90 bg-surface-container-lowest px-4 py-2.5 text-xs text-on-surface-variant dark:border-white/10">
          <span>
            Rascunho recuperado, salvo em{' '}
            {new Date(rascunhoRecuperadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
          </span>
          <button type="button" onClick={descartarRascunho} className="font-semibold text-on-surface underline-offset-2 hover:underline">
            Começar do zero
          </button>
        </div>
      ) : null}

      <div ref={trailRef} className="scroll-mt-24">
        <GmudFormTrail steps={passos} states={estados} current={etapa} maxReached={maxEtapa} pendCounts={contagens} onSelect={irParaEtapa} />
      </div>

      <form
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]"
        onSubmit={(e) => {
          e.preventDefault()
          if (etapa < ultimaEtapa) proximaEtapa()
          else if (canSubmit) handleSubmit()
        }}
      >
        <FormStepContext.Provider value={{ visible: secoesVisiveis }}>
        <div className="min-w-0 space-y-4">
        {/* Campos comuns — Identificação + Solicitante */}
        <CamposComuns form={form} set={set} categoria={form.categoria} />

        {/* Campos dinâmicos por categoria */}
        {form.categoria === 'rede_externa' && (
          <RedeExternaFields form={form} set={set} areas={areasOptions.map((a) => a.label)} />
        )}

        {form.categoria === 'sistemas_internos' && (
          <SistemasInternosFields
            si={siData}
            setSi={setSiData}
            impactoParada={form.impactoParada}
            setImpactoParada={(v) => set('impactoParada', v)}
            descricao={form.descricao}
            setDescricao={(v) => set('descricao', v)}
            planoExecucao={form.planoExecucao}
            setPlanoExecucao={(v) => set('planoExecucao', v)}
            planoRollback={form.planoRollback}
            setPlanoRollback={(v) => set('planoRollback', v)}
            areasOptions={areasOptions}
            sistemasInternosOptions={sistemasInternosOptions}
            listsLoading={listsLoading}
          />
        )}

        {form.categoria === 'sistemas_internos' && (
          <RecursosAdministrativosCard form={form} set={set} areas={areasOptions.map((a) => a.label)} destacar={siData.areasImpactadas} />
        )}

        {form.categoria === 'sistemas_externos' && (
          <SistemasExternosFields
            se={seData}
            setSe={setSeData}
            impactoParada={form.impactoParada}
            setImpactoParada={(v) => set('impactoParada', v)}
            descricao={form.descricao}
            setDescricao={(v) => set('descricao', v)}
            planoExecucao={form.planoExecucao}
            setPlanoExecucao={(v) => set('planoExecucao', v)}
            areasOptions={areasOptions}
            sistemasExternosOptions={sistemasExternosOptions}
            listsLoading={listsLoading}
          />
        )}

        {form.categoria === 'sistemas_externos' && (
          <RecursosAdministrativosCard form={form} set={set} areas={areasOptions.map((a) => a.label)} destacar={seData.areasAfetadas} />
        )}

        {/* Janela de mudança — comum a todas */}
        <JanelaDeMudanca form={form} set={set} />

        {/* Observações — comum a todas as categorias */}
        <Observacoes value={form.observacoes} onChange={(v) => set('observacoes', v)} />

        {etapa === ultimaEtapa ? (
          <div className={CARD}>
            <p className="mb-1 text-sm font-bold text-on-surface">Revisão</p>
            <p className="mb-2 text-xs text-on-surface-variant">Confira cada etapa. Para mudar algo, use Editar.</p>
            <ul className="divide-y divide-neutral-200/60 dark:divide-white/5">
              {passos.slice(0, ultimaEtapa).map((p, i) => {
                const n = contagens[i] ?? 0
                return (
                  <li key={p.key} className="flex items-start gap-3 py-2.5">
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                        n > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                      )}
                      aria-hidden
                    >
                      {n > 0 ? <span className="text-[11px] font-bold">{n}</span> : <Check size={12} strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-on-surface">{p.label}</p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {n > 0 ? `${n} pendência${n === 1 ? '' : 's'}: ${pendenciasDaEtapa(pendenciasDetalhe, p).map((x) => x.message).join(', ')}` : resumoEtapa(i) || 'Sem dados para mostrar'}
                      </p>
                    </div>
                    <button type="button" onClick={() => irParaEtapa(i)} className="shrink-0 text-xs font-semibold text-on-surface underline-offset-2 hover:underline">
                      Editar
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {avisoAtual.length > 0 ? (
          <div role="alert" className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-semibold">Falta preencher para continuar:</p>
            <ul className="mt-1 list-inside list-disc">
              {avisoAtual.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/gmud')}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            {etapa > 0 ? (
              <button
                type="button"
                onClick={() => irParaEtapa(etapa - 1)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
              >
                Voltar
              </button>
            ) : null}
            {etapa < ultimaEtapa ? (
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-primary/90"
              >
                Próximo
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Zap className="size-4" aria-hidden />}
                {mutation.isPending ? 'Abrindo no Elleven…' : 'Abrir GMUD no Elleven'}
              </button>
            )}
          </div>
        </div>
        </div>
        </FormStepContext.Provider>

        {/* Coluna lateral: pré-visualização + envio (no celular fica abaixo do formulário) */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
        {/* Pré-visualização da máscara */}
        <div className={CARD}>
          <p className="mb-2 text-sm font-bold text-on-surface">
            Pré-visualização — como vai ficar no Elleven
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">Título</p>
          <p className="mt-0.5 break-words font-mono text-sm text-on-surface">
            {buildGmudTitle(
              form,
              form.categoria === 'sistemas_internos' ? siData : null,
              form.categoria === 'sistemas_externos' ? seData : null,
            )}
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">Descrição (máscara)</p>
          <pre className="mt-1 max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-low p-3 font-mono text-xs leading-relaxed text-on-surface">
            {buildGmudDescription(
              form,
              form.categoria === 'sistemas_internos' ? siData : null,
              form.categoria === 'sistemas_externos' ? seData : null,
            )}
          </pre>
          <p className="mt-2 text-[11px] text-on-surface-variant/70">
            Classificação: Catálogo GMUD · Tipo "Gestão de Mudança de Rede" · Categoria "Infraestrutura
            (GMUD)" · Equipe CGR.
          </p>
        </div>

        </aside>
      </form>
    </div>
  )
}
