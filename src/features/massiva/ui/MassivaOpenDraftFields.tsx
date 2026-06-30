import { type ReactNode } from 'react'
import { ChevronDown, FileText, Lock, Wand2 } from 'lucide-react'
import { MASSIVA_SOLICITATION_TYPE_LABEL } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'
import { cn } from '@/shared/lib/utils'

type DescriptionByApItem = {
  apCode: string
  apTitle: string
  description: string
}

type MassivaOpenDraftFieldsProps = {
  disabled: boolean
  descriptionByAp?: DescriptionByApItem[]
}

function DraftSection({
  title,
  hint,
  variant = 'neutral',
  children,
}: {
  title: string
  hint?: string
  variant?: 'neutral' | 'muted' | 'accent'
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-lg border p-2 sm:p-2.5',
        variant === 'accent' && 'border-violet-200/60 bg-violet-50/35',
        variant === 'muted' && 'border-neutral-200/70 bg-neutral-50/40',
        variant === 'neutral' && 'border-neutral-200/60 bg-white/70',
      )}
    >
      <div className="border-b border-neutral-200/50 pb-1.5">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
          {title}
        </h4>
        {hint ? (
          <p className="mt-0.5 text-[10px] leading-tight text-neutral-600">{hint}</p>
        ) : null}
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
    >
      {children}
    </label>
  )
}

const inputClassName =
  'w-full rounded-md border border-neutral-200/90 bg-white px-2.5 py-1.5 text-sm text-neutral-900 shadow-sm transition placeholder:text-neutral-400 hover:border-neutral-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60'

/**
 * Formulário de assignment (paridade com massiva_screen): tipo fixo, prazos, relato,
 * origem (técnico em campo vs rompimento) e descrição técnica em modelo obrigatório.
 */
export function MassivaOpenDraftFields({
  disabled,
  descriptionByAp = [],
}: MassivaOpenDraftFieldsProps) {
  const enableDescriptionAutoSync = useMassivaOpenDraftStore((s) => s.enableDescriptionAutoSync)

  const assignmentForecastDate = useMassivaOpenDraftStore((s) => s.assignmentForecastDate)
  const assignmentForecastTime = useMassivaOpenDraftStore((s) => s.assignmentForecastTime)
  const setAssignmentForecastDate = useMassivaOpenDraftStore((s) => s.setAssignmentForecastDate)
  const setAssignmentForecastTime = useMassivaOpenDraftStore((s) => s.setAssignmentForecastTime)

  const eventStartDate = useMassivaOpenDraftStore((s) => s.eventStartDate)
  const eventStartTime = useMassivaOpenDraftStore((s) => s.eventStartTime)
  const setEventStartDate = useMassivaOpenDraftStore((s) => s.setEventStartDate)
  const setEventStartTime = useMassivaOpenDraftStore((s) => s.setEventStartTime)

  const eventIdentifiedDate = useMassivaOpenDraftStore((s) => s.eventIdentifiedDate)
  const eventIdentifiedTime = useMassivaOpenDraftStore((s) => s.eventIdentifiedTime)
  const setEventIdentifiedDate = useMassivaOpenDraftStore((s) => s.setEventIdentifiedDate)
  const setEventIdentifiedTime = useMassivaOpenDraftStore((s) => s.setEventIdentifiedTime)

  const initialReport = useMassivaOpenDraftStore((s) => s.initialReport)
  const setInitialReport = useMassivaOpenDraftStore((s) => s.setInitialReport)

  const fieldTechnicianRequesting = useMassivaOpenDraftStore((s) => s.fieldTechnicianRequesting)
  const setFieldTechnicianRequesting = useMassivaOpenDraftStore((s) => s.setFieldTechnicianRequesting)

  return (
    <div className="mt-2">
      <div
        className={cn(
          'space-y-2 rounded-2xl border border-neutral-200/80 bg-gradient-to-b from-neutral-50/80 to-white p-2.5 shadow-sm sm:p-3',
          'ring-1 ring-black/[0.03]',
        )}
      >
        <header className="border-b border-neutral-200/70 pb-2">
          <h3 className="text-sm font-bold tracking-tight text-neutral-900">
            Dados para abertura do protocolo
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
            Preencha para gerar a descrição e liberar o envio.
          </p>
        </header>

        <div className="space-y-2">
          <DraftSection
            title="Identificação do evento"
            hint="Quando o time percebeu ou confirmou o incidente na rede."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="massiva-event-identified-date">Data de identificação do evento</FieldLabel>
                <input
                  id="massiva-event-identified-date"
                  type="date"
                  className={inputClassName}
                  value={eventIdentifiedDate}
                  onChange={(e) => setEventIdentifiedDate(e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel htmlFor="massiva-event-identified-time">Hora da identificação</FieldLabel>
                <input
                  id="massiva-event-identified-time"
                  type="time"
                  className={inputClassName}
                  value={eventIdentifiedTime}
                  onChange={(e) => setEventIdentifiedTime(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          </DraftSection>

          <DraftSection
            title="Início do evento"
            hint="Data e hora em que o evento efetivamente começou na rede."
            variant="muted"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="massiva-event-start-date">Data de início do evento</FieldLabel>
                <input
                  id="massiva-event-start-date"
                  type="date"
                  className={inputClassName}
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel htmlFor="massiva-event-start-time">Hora de início</FieldLabel>
                <input
                  id="massiva-event-start-time"
                  type="time"
                  className={inputClassName}
                  value={eventStartTime}
                  onChange={(e) => setEventStartTime(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          </DraftSection>

          <DraftSection
            title="Classificação e prazo"
            hint="Tipo fixo pelo fluxo massiva. Informe a previsão de normalização."
            variant="accent"
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <FieldLabel htmlFor="massiva-solicitation-type">Tipo de solicitação</FieldLabel>
                <div className="relative">
                  <input
                    id="massiva-solicitation-type"
                    type="text"
                    readOnly
                    className={cn(inputClassName, 'cursor-not-allowed bg-neutral-50/90 pr-9')}
                    value={MASSIVA_SOLICITATION_TYPE_LABEL}
                    disabled={disabled}
                    aria-readonly="true"
                  />
                  <Lock
                    className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="massiva-forecast-date">Previsão de finalização</FieldLabel>
                <input
                  id="massiva-forecast-date"
                  type="date"
                  className={inputClassName}
                  value={assignmentForecastDate}
                  onChange={(e) => setAssignmentForecastDate(e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <FieldLabel htmlFor="massiva-forecast-time">Hora da previsão</FieldLabel>
                <input
                  id="massiva-forecast-time"
                  type="time"
                  className={inputClassName}
                  value={assignmentForecastTime}
                  onChange={(e) => setAssignmentForecastTime(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          </DraftSection>

          <div className="rounded-lg border border-neutral-200/70 bg-white p-2 sm:p-2.5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="massiva-initial-report"
                className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
              >
                Relato inicial
              </label>
              <span className="text-[10px] font-medium text-neutral-400">Opcional</span>
            </div>
            <textarea
              id="massiva-initial-report"
              rows={2}
              className={cn(inputClassName, 'mt-1 resize-y py-1.5 leading-snug min-h-[2.35rem]')}
              value={initialReport}
              onChange={(e) => setInitialReport(e.target.value)}
              disabled={disabled}
              placeholder="Resumo objetivo do que ocorreu (ex.: queda parcial, sintomas, escopo)."
            />
          </div>

          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 shadow-sm sm:px-3',
              fieldTechnicianRequesting
                ? 'border-blue-200/80 bg-blue-50/40'
                : 'border-red-200/80 bg-red-50/40',
              disabled && 'opacity-60',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight text-neutral-900">
                Técnico em campo solicitando abertura
              </p>
              <p className="mt-0.5 text-xs leading-snug text-neutral-600">
                {fieldTechnicianRequesting
                  ? 'Abertura solicitada pelo técnico no local.'
                  : 'Origem registrada como rompimento.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fieldTechnicianRequesting}
              aria-label={
                fieldTechnicianRequesting
                  ? 'Origem: técnico em campo (ativado)'
                  : 'Origem: rompimento (desativado)'
              }
              title={
                fieldTechnicianRequesting
                  ? 'Clique para registrar origem como rompimento'
                  : 'Clique para indicar técnico em campo'
              }
              disabled={disabled}
              onClick={() => setFieldTechnicianRequesting(!fieldTechnicianRequesting)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2',
                fieldTechnicianRequesting
                  ? 'border-blue-400 bg-blue-500'
                  : 'border-red-400 bg-red-500',
                disabled && 'cursor-not-allowed',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none absolute top-0.5 size-4 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform',
                  fieldTechnicianRequesting ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          <div className="rounded-lg border border-violet-200/70 bg-violet-50/50 p-2 sm:p-2.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                enableDescriptionAutoSync()
              }}
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition sm:w-auto',
                'bg-violet-600 text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Wand2 className="size-4 shrink-0 opacity-95" aria-hidden />
              Gerar descrição automática
            </button>
            <p className="mt-1.5 text-[10px] leading-snug text-neutral-600">
              Atualiza o modelo com a rota e os campos acima. Edição manual pausa o auto-sync até
              clicar de novo.
            </p>
          </div>

          <section className="rounded-lg border border-neutral-200/80 bg-white p-2 shadow-sm sm:p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 border-b border-neutral-100 pb-1.5">
              <FileText className="size-3.5 text-neutral-400" aria-hidden />
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                Descrição técnica
              </h4>
            </div>
            {descriptionByAp.length > 0 ? (
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-0.5">
                {descriptionByAp.map((item) => (
                  <details
                    key={item.apCode}
                    className="group overflow-hidden rounded-md border border-neutral-200/90 bg-neutral-50/30 open:bg-white"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-left text-xs font-semibold text-neutral-800 [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        className="size-3.5 shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.apTitle}{' '}
                        <span className="font-mono font-normal text-neutral-500">
                          ({item.apCode})
                        </span>
                      </span>
                    </summary>
                    <pre className="max-h-44 overflow-auto whitespace-pre-wrap border-t border-neutral-100 bg-white px-2 py-2 text-[11px] leading-relaxed text-neutral-800">
                      {item.description}
                    </pre>
                  </details>
                ))}
              </div>
            ) : (
              <p className="py-1.5 text-center text-[11px] text-neutral-500">
                A descrição por ponto de acesso aparece aqui quando houver rotas prontas.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
