import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ClipboardList, Loader2, Send, Zap } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { createGmud } from '@/features/gmud/api/createGmud'
import { openGmudInElleven } from '@/features/gmud/api/openGmudInElleven'
import {
  emptyGmudForm,
  GMUD_AMBIENTE_OPTIONS,
  GMUD_AREA_OPTIONS,
  GMUD_LISTA_COR,
  GMUD_RECURSO_AREAS,
  GMUD_RECURSO_PAPEIS,
  GMUD_SIM_NAO,
  GMUD_TIPO_OPTIONS,
  type GmudFormState,
  type GmudRecursoPapel,
} from '@/features/gmud/model/gmudForm'
import { cn } from '@/shared/lib/utils'

const CARD =
  'rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 sm:p-5'
const LABEL = 'block text-xs font-semibold text-on-surface-variant'
const FIELD =
  'mt-1 w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={CARD}>
      <p className="mb-3 text-sm font-bold text-on-surface">{title}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export function GmudNewScreen() {
  const navigate = useNavigate()
  const profileEmail = useAccessAuthStore((s) => s.profile?.email ?? '')
  const [form, setForm] = useState<GmudFormState>(() => emptyGmudForm(profileEmail))
  const [abrirNoElleven, setAbrirNoElleven] = useState(false)
  const idempotencyKeyRef = useRef<string | null>(null)
  const set = <K extends keyof GmudFormState>(key: K, value: GmudFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const mutation = useMutation({
    mutationFn: async () => {
      let protocol = form.voalleProtocol
      if (abrirNoElleven) {
        if (idempotencyKeyRef.current === null) {
          idempotencyKeyRef.current =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
        }
        const result = await openGmudInElleven({
          solicitanteEmail: form.solicitanteEmail,
          titulo: form.titulo,
          descricao: form.descricao || form.titulo,
          finalDateLocal: `${form.dataFim}T${form.horaFim}:00`,
          idempotencyKey: idempotencyKeyRef.current,
        })
        if (result.protocol == null) {
          throw new Error('O Elleven não retornou o número do protocolo da GMUD.')
        }
        protocol = String(result.protocol)
      }
      await createGmud({ ...form, voalleProtocol: protocol })
      return protocol
    },
    onSuccess: () => {
      idempotencyKeyRef.current = null
      navigate('/gmud')
    },
  })

  const toggleAmbiente = (opt: string) =>
    set(
      'ambienteAfetado',
      form.ambienteAfetado.includes(opt)
        ? form.ambienteAfetado.filter((o) => o !== opt)
        : [...form.ambienteAfetado, opt],
    )

  const setRecurso = (area: string, papel: GmudRecursoPapel) =>
    set('recursosAdministrativos', { ...form.recursosAdministrativos, [area]: papel })

  const canSubmit =
    form.titulo.trim() !== '' &&
    !mutation.isPending &&
    (abrirNoElleven
      ? form.solicitanteEmail.trim() !== '' && form.dataFim !== '' && form.horaFim !== ''
      : form.voalleProtocol.trim() !== '')

  return (
    <div className="mx-auto min-w-0 max-w-[1100px] space-y-4">
      <AppPageHeader
        badge="Gestão de Mudança de Rede"
        title="Abrir GMUD"
        description="Requisição de mudança — mesmos campos do formulário. O protocolo Voalle é informado manualmente nesta etapa."
        icon={ClipboardList}
        primaryAction={{ to: '/gmud', label: 'Voltar às GMUDs' }}
      />

      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
          abrirNoElleven
            ? 'border-primary/40 bg-primary/5'
            : 'border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest',
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={abrirNoElleven}
          onChange={(e) => setAbrirNoElleven(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <Zap size={15} className="text-primary" /> Abrir o protocolo no Elleven automaticamente
          </span>
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            Ligado: a plataforma abre a GMUD no Elleven e preenche o protocolo sozinha (exige
            e-mail do solicitante e a janela de fim). Desligado: você informa o protocolo manualmente
            (como no formulário atual).
          </span>
        </span>
      </label>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) mutation.mutate()
        }}
      >
        <Section title="Identificação">
          <label>
            <span className={LABEL}>
              Protocolo Voalle da GMUD {abrirNoElleven ? '' : '*'}
            </span>
            <input
              className={cn(FIELD, abrirNoElleven && 'opacity-60')}
              inputMode="numeric"
              value={form.voalleProtocol}
              disabled={abrirNoElleven}
              onChange={(e) => set('voalleProtocol', e.target.value.replace(/\D/g, ''))}
              placeholder={abrirNoElleven ? 'Será gerado no Elleven ao abrir' : 'Ex.: 1833914'}
            />
          </label>
          <label>
            <span className={LABEL}>Tipo da GMUD *</span>
            <select className={FIELD} value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option value="">Escolher…</option>
              {GMUD_TIPO_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>Título da GMUD *</span>
            <input className={FIELD} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>Área do solicitante</span>
            <select
              className={FIELD}
              value={form.areaSolicitante}
              onChange={(e) => set('areaSolicitante', e.target.value)}
            >
              <option value="">Escolher…</option>
              {GMUD_AREA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>Nome do solicitante</span>
            <input
              className={FIELD}
              value={form.solicitanteNome}
              onChange={(e) => set('solicitanteNome', e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>E-mail do solicitante</span>
            <input
              type="email"
              className={FIELD}
              value={form.solicitanteEmail}
              onChange={(e) => set('solicitanteEmail', e.target.value)}
            />
          </label>
        </Section>

        <Section title="Atividade">
          <label className="sm:col-span-2">
            <span className={LABEL}>Descrição da atividade</span>
            <textarea
              className={cn(FIELD, 'min-h-[90px]')}
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
            />
          </label>
          <label>
            <span className={LABEL}>POP/Site</span>
            <input className={FIELD} value={form.popSite} onChange={(e) => set('popSite', e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>Risco(s) da não implementação</span>
            <input
              className={FIELD}
              value={form.riscoNaoImplementacao}
              onChange={(e) => set('riscoNaoImplementacao', e.target.value)}
            />
          </label>
        </Section>

        <div className={CARD}>
          <p className="mb-3 text-sm font-bold text-on-surface">Ambiente afetado</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GMUD_AMBIENTE_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={form.ambienteAfetado.includes(opt)}
                  onChange={() => toggleAmbiente(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <Section title="Impacto">
          <label>
            <span className={LABEL}>Comunica cliente?</span>
            <select
              className={FIELD}
              value={form.comunicaCliente}
              onChange={(e) => set('comunicaCliente', e.target.value)}
            >
              <option value="">Escolher…</option>
              {GMUD_SIM_NAO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>Haverá impacto de parada do serviço?</span>
            <select
              className={FIELD}
              value={form.impactoParada}
              onChange={(e) => set('impactoParada', e.target.value)}
            >
              <option value="">Escolher…</option>
              {GMUD_SIM_NAO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </Section>

        <Section title="Execução">
          <label className="sm:col-span-2">
            <span className={LABEL}>Plano de execução da GMUD</span>
            <textarea
              className={cn(FIELD, 'min-h-[80px]')}
              value={form.planoExecucao}
              onChange={(e) => set('planoExecucao', e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>Risco(s) durante a execução</span>
            <textarea
              className={cn(FIELD, 'min-h-[70px]')}
              value={form.riscoExecucao}
              onChange={(e) => set('riscoExecucao', e.target.value)}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={LABEL}>Plano de rollback (retorno)</span>
            <textarea
              className={cn(FIELD, 'min-h-[70px]')}
              value={form.planoRollback}
              onChange={(e) => set('planoRollback', e.target.value)}
            />
          </label>
        </Section>

        <div className={CARD}>
          <p className="mb-3 text-sm font-bold text-on-surface">Recursos administrativos</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70">
                  <th className="py-2 pr-4">Área</th>
                  {GMUD_RECURSO_PAPEIS.map((p) => (
                    <th key={p.value} className="px-3 py-2 text-center">
                      {p.label}
                    </th>
                  ))}
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

        <Section title="Janela de mudança">
          <label>
            <span className={LABEL}>Data início</span>
            <input
              type="date"
              className={FIELD}
              value={form.dataInicio}
              onChange={(e) => set('dataInicio', e.target.value)}
            />
          </label>
          <label>
            <span className={LABEL}>Horário início</span>
            <input
              type="time"
              className={FIELD}
              value={form.horaInicio}
              onChange={(e) => set('horaInicio', e.target.value)}
            />
          </label>
          <label>
            <span className={LABEL}>Data fim</span>
            <input
              type="date"
              className={FIELD}
              value={form.dataFim}
              onChange={(e) => set('dataFim', e.target.value)}
            />
          </label>
          <label>
            <span className={LABEL}>Horário fim (deadline)</span>
            <input
              type="time"
              className={FIELD}
              value={form.horaFim}
              onChange={(e) => set('horaFim', e.target.value)}
            />
          </label>
        </Section>

        <Section title="Alinhamento">
          <label className="sm:col-span-2">
            <span className={LABEL}>
              Caso necessário informar clientes, a lista de clientes impactados foi enviada ao COR?
            </span>
            <select
              className={FIELD}
              value={form.listaClientesCor}
              onChange={(e) => set('listaClientesCor', e.target.value)}
            >
              <option value="">Escolher…</option>
              {GMUD_LISTA_COR.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </Section>

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
            ) : abrirNoElleven ? (
              <Zap className="size-4" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {abrirNoElleven ? 'Abrir GMUD no Elleven' : 'Registrar GMUD'}
          </button>
        </div>
      </form>
    </div>
  )
}
