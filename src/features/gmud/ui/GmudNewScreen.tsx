import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastStore } from '@/shared/store/toastStore'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ClipboardList, Loader2, Zap } from 'lucide-react'
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
  GMUD_TIPO_OPTIONS,
  validateGmudForm,
  minDataProgramada,
  type GmudCategoria,
  type GmudFormState,
  type GmudRecursoPapel,
  type GmudSistemasInternosData,
  type GmudSistemasExternosData,
} from '@/features/gmud/model/gmudForm'
import { GmudPopSiteField } from '@/features/gmud/ui/GmudPopSiteField'
import { GmudMultiSelect } from '@/features/gmud/ui/GmudMultiSelect'
import {
  buildGmudDescription,
  buildGmudTitle,
} from '@/features/gmud/lib/buildGmudAssignmentMask'
import { fetchGmudConfigLists, type GmudConfigItem } from '@/features/gmud/api/gmudConfigLists'
import { cn } from '@/shared/lib/utils'

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
function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className={CARD}>
      <p className="mb-3 text-sm font-bold text-on-surface">{title}</p>
      {hint ? <p className="mb-3 text-xs text-on-surface-variant">{hint}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
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
      <Field label="Tipo da GMUD" required>
        <select className={FIELD} value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
          <option value="">Escolher…</option>
          {GMUD_TIPO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>
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
  const minInicio = form.tipo === 'Programada' ? minDataProgramada() : undefined
  return (
    <Section title="Janela de mudança">
      <Field label="Data início" required>
        <input type="date" className={FIELD} value={form.dataInicio} min={minInicio} onChange={(e) => set('dataInicio', e.target.value)} />
        {minInicio ? (
          <p className="mt-1 text-[11px] text-on-surface-variant">
            Programada: a partir de {minInicio.split('-').reverse().join('/')} (apresentação na terça + 7 dias).
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
// Seções específicas de Rede Externa
// ---------------------------------------------------------------------------
function RedeExternaFields({
  form, set,
}: {
  form: GmudFormState
  set: <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) => void
}) {
  const toggleAmbiente = (opt: string) =>
    set(
      'ambienteAfetado',
      form.ambienteAfetado.includes(opt)
        ? form.ambienteAfetado.filter((o) => o !== opt)
        : [...form.ambienteAfetado, opt],
    )
  const setRecurso = (area: string, papel: GmudRecursoPapel) =>
    set('recursosAdministrativos', { ...form.recursosAdministrativos, [area]: papel })

  return (
    <>
      <Section title="Atividade">
        <Field label="Descrição da atividade" required full>
          <textarea className={cn(FIELD, 'min-h-[90px]')} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} />
        </Field>
        <Field label="POP/Site" required>
          <GmudPopSiteField className={FIELD} value={form.popSite} onChange={(v) => set('popSite', v)} />
        </Field>
        <Field label="Risco(s) da não implementação" required>
          <input className={FIELD} value={form.riscoNaoImplementacao} onChange={(e) => set('riscoNaoImplementacao', e.target.value)} />
        </Field>
      </Section>

      <div className={CARD}>
        <p className="mb-3 text-sm font-bold text-on-surface">Ambiente afetado *</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GMUD_AMBIENTE_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-on-surface">
              <input type="checkbox" className="size-4 accent-primary" checked={form.ambienteAfetado.includes(opt)} onChange={() => toggleAmbiente(opt)} />
              {opt}
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className={LABEL}>Outro (especificar)</span>
          <input
            className={FIELD}
            value={form.ambienteOutro}
            onChange={(e) => set('ambienteOutro', e.target.value)}
            placeholder="Se o ambiente não estiver na lista acima"
          />
        </label>
      </div>

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

      <div className={CARD}>
        <p className="mb-3 text-sm font-bold text-on-surface">Recursos administrativos</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">
                <th className="py-2 pr-4">Área</th>
                {GMUD_RECURSO_PAPEIS.map((p) => <th key={p.value} className="px-3 py-2 text-center">{p.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {GMUD_RECURSO_AREAS.map((area) => (
                <tr key={area} className="border-t border-neutral-200/60 dark:border-white/5">
                  <td className="py-2 pr-4 font-medium text-on-surface">{area}</td>
                  {GMUD_RECURSO_PAPEIS.map((p) => (
                    <td key={p.value} className="px-3 py-2 text-center">
                      <input
                        type="radio"
                        name={`recurso-${area}`}
                        className="size-4 accent-primary"
                        checked={form.recursosAdministrativos[area] === p.value}
                        onChange={() => setRecurso(area, p.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
  const pushToast = useToastStore((s) => s.push)
  const profile = useAccessAuthStore((s) => s.profile)
  const [form, setForm] = useState<GmudFormState>(() =>
    emptyGmudForm(profile?.email ?? '', profile?.displayName ?? ''),
  )
  const [siData, setSiData] = useState<GmudSistemasInternosData>(emptyGmudSistemasInternosData)
  const [seData, setSeData] = useState<GmudSistemasExternosData>(emptyGmudSistemasExternosData)
  const [missing, setMissing] = useState<string[]>([])
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
    : null

  const mutation = useMutation({
    mutationFn: async () => {
      if (idempotencyKeyRef.current === null) {
        idempotencyKeyRef.current =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      }
      const result = await openGmudInElleven({
        solicitanteEmail: form.solicitanteEmail,
        titulo: buildGmudTitle(
          form,
          form.categoria === 'sistemas_internos' ? siData : null,
          form.categoria === 'sistemas_externos' ? seData : null,
        ),
        descricao: buildGmudDescription(
          form,
          form.categoria === 'sistemas_internos' ? siData : null,
          form.categoria === 'sistemas_externos' ? seData : null,
        ),
        finalDateLocal: `${form.dataFim}T${form.horaFim}:00`,
        idempotencyKey: idempotencyKeyRef.current,
      })
      if (result.protocol == null) {
        throw new Error('O Elleven não retornou o número do protocolo da GMUD.')
      }
      const protocol = String(result.protocol)
      await createGmud({
        ...form,
        voalleProtocol: protocol,
        assignmentId: result.assignmentId,
        ambienteAfetado: collectAmbienteAfetado(form),
        categoriaData: activeCategoriaData,
      })
      return protocol
    },
    onSuccess: (protocol) => {
      idempotencyKeyRef.current = null
      pushToast(`GMUD ${protocol} registrada com sucesso!`, 'success')
      navigate('/gmud')
    },
  })

  const handleSubmit = () => {
    const miss = validateGmudForm(
      form,
      form.categoria === 'sistemas_internos' ? siData : null,
      form.categoria === 'sistemas_externos' ? seData : null,
    )
    setMissing(miss)
    if (miss.length === 0) mutation.mutate()
  }

  const canSubmit = !mutation.isPending

  return (
    <div className="mx-auto min-w-0 max-w-[1100px] space-y-4">
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
                  ? 'border-primary bg-primary text-white shadow-sm'
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

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) handleSubmit()
        }}
      >
        {/* Campos comuns — Identificação + Solicitante */}
        <CamposComuns form={form} set={set} categoria={form.categoria} />

        {/* Campos dinâmicos por categoria */}
        {form.categoria === 'rede_externa' && (
          <RedeExternaFields form={form} set={set} />
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

        {/* Janela de mudança — comum a todas */}
        <JanelaDeMudanca form={form} set={set} />

        {/* Observações — comum a todas as categorias */}
        <Observacoes value={form.observacoes} onChange={(v) => set('observacoes', v)} />

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
          <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container-low p-3 font-mono text-xs leading-relaxed text-on-surface">
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

        {missing.length > 0 ? (
          <div className="rounded-xl border border-amber-300/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">Corrija antes de enviar:</p>
            <p className="mt-1">{missing.join(' · ')}</p>
          </div>
        ) : null}

        {mutation.isError ? (
          <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {mutation.error instanceof Error ? mutation.error.message : 'Falha ao registrar a GMUD.'}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/gmud')}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Zap className="size-4" aria-hidden />
            )}
            {mutation.isPending ? 'Abrindo no Elleven…' : 'Abrir GMUD no Elleven'}
          </button>
        </div>
      </form>
    </div>
  )
}
