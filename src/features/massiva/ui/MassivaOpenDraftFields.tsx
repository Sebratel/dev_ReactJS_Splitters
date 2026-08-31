import { type ReactNode } from 'react'
import {
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Lock,
  Search,
  Wand2,
} from 'lucide-react'
import { MASSIVA_SOLICITATION_TYPE_LABEL } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'
import {
  MASSIVA_INFRA_PROTOCOL_OPTIONS,
  infraProtocolOption,
} from '@/features/massiva/model/massivaInfraProtocol'
import { InfraSiteSelect } from '@/features/massiva/ui/InfraSiteSelect'
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
  icon,
  variant = 'neutral',
  children,
}: {
  title: string
  hint?: string
  icon?: ReactNode
  variant?: 'neutral' | 'muted' | 'accent'
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'rounded-xl border p-3 sm:p-3.5',
        variant === 'accent' && 'border-violet-200/60 dark:border-violet-800/50 bg-violet-50/35 dark:bg-violet-950/40',
        variant === 'muted' && 'border-neutral-200/70 dark:border-white/10 bg-surface-container-low/50',
        variant === 'neutral' && 'border-neutral-200/70 dark:border-white/10 bg-surface-container-lowest/80',
      )}
    >
      <div className="flex items-start gap-2.5 border-b border-neutral-200/60 dark:border-white/10 pb-2">
        {icon ? (
          <span
            className={cn(
              'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg ring-1',
              variant === 'accent'
                ? 'bg-violet-100/70 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300 ring-violet-200/70 dark:ring-violet-800/50'
                : 'bg-surface-container-lowest text-on-surface-variant ring-neutral-200/80 dark:ring-white/10',
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            {title}
          </h4>
          {hint ? (
            <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">{hint}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-2.5">{children}</div>
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
      className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"
    >
      {children}
    </label>
  )
}

const inputClassName =
  'w-full rounded-lg border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface shadow-sm transition placeholder:text-on-surface-variant/60 hover:border-neutral-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:opacity-60'

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

  const eventIdentifiedBy = useMassivaOpenDraftStore((s) => s.eventIdentifiedBy)
  const setEventIdentifiedBy = useMassivaOpenDraftStore((s) => s.setEventIdentifiedBy)

  const infraProtocolType = useMassivaOpenDraftStore((s) => s.infraProtocolType)
  const setInfraProtocolType = useMassivaOpenDraftStore((s) => s.setInfraProtocolType)
  const infraSignalDbm = useMassivaOpenDraftStore((s) => s.infraSignalDbm)
  const setInfraSignalDbm = useMassivaOpenDraftStore((s) => s.setInfraSignalDbm)
  const infraAvaria = useMassivaOpenDraftStore((s) => s.infraAvaria)
  const setInfraAvaria = useMassivaOpenDraftStore((s) => s.setInfraAvaria)
  const infraSiteCode = useMassivaOpenDraftStore((s) => s.infraSiteCode)
  const setInfraSiteCode = useMassivaOpenDraftStore((s) => s.setInfraSiteCode)
  const infraManualField = infraProtocolOption(infraProtocolType)?.manualField ?? null

  return (
    <div className="mt-2">
      <div
        className={cn(
          'space-y-3 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-gradient-to-b from-neutral-50/80 dark:from-white/5 to-white dark:to-surface-container-lowest p-3 shadow-sm sm:p-4',
          'ring-1 ring-black/[0.03]',
        )}
      >
        <header className="flex items-start gap-3 border-b border-neutral-200/70 dark:border-white/10 pb-3">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100/70 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300 ring-1 ring-violet-200/70 dark:ring-violet-800/50"
            aria-hidden
          >
            <ClipboardList className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-on-surface">
              Dados para abertura do protocolo
            </h3>
            <p className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">
              Preencha para gerar a descrição e liberar o envio.
            </p>
          </div>
        </header>

        <div className="space-y-3">
          <DraftSection
            title="Identificação do evento"
            hint="Quando o time percebeu ou confirmou o incidente na rede."
            icon={<Search className="size-3.5" />}
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
            icon={<Clock className="size-3.5" />}
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
            icon={<CalendarClock className="size-3.5" />}
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
                    className={cn(inputClassName, 'cursor-not-allowed bg-surface-container-low/90 pr-9')}
                    value={MASSIVA_SOLICITATION_TYPE_LABEL}
                    disabled={disabled}
                    aria-readonly="true"
                  />
                  <Lock
                    className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60"
                    aria-hidden
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="massiva-forecast-date">
                  Previsão de finalização <span className="text-red-500">*</span>
                </FieldLabel>
                <input
                  id="massiva-forecast-date"
                  type="date"
                  required
                  aria-required="true"
                  className={inputClassName}
                  value={assignmentForecastDate}
                  onChange={(e) => setAssignmentForecastDate(e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <FieldLabel htmlFor="massiva-forecast-time">
                  Hora da previsão <span className="text-red-500">*</span>
                </FieldLabel>
                <input
                  id="massiva-forecast-time"
                  type="time"
                  required
                  aria-required="true"
                  className={inputClassName}
                  value={assignmentForecastTime}
                  onChange={(e) => setAssignmentForecastTime(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          </DraftSection>

          <div className="rounded-xl border border-neutral-200/70 dark:border-white/10 bg-surface-container-lowest p-2.5 sm:p-3">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="massiva-initial-report"
                className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"
              >
                Relato inicial
              </label>
              <span className="text-[10px] font-medium text-on-surface-variant/60">Opcional</span>
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

          {/* Quem identificou o evento — seletor segmentado */}
          <div className={cn('space-y-1.5 rounded-xl border border-neutral-200/70 dark:border-white/10 bg-surface-container-lowest px-3 py-2.5', disabled && 'opacity-60')}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Quem identificou o evento
            </p>
            <div
              role="radiogroup"
              aria-label="Quem identificou o evento"
              className="flex gap-1.5"
            >
              {(
                [
                  { value: 'tecnico', label: 'Técnico' },
                  { value: 'zabbix',  label: 'Zabbix'  },
                  { value: 'int6',    label: 'INT6'     },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={eventIdentifiedBy === value}
                  disabled={disabled}
                  onClick={() => setEventIdentifiedBy(value)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-1',
                    'disabled:cursor-not-allowed',
                    eventIdentifiedBy === value
                      ? 'border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-sm ring-1 ring-amber-200/70 dark:ring-amber-800/50'
                      : 'border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant hover:border-neutral-300 hover:bg-surface-container-low hover:text-on-surface-variant',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Protocolo de infraestrutura (opcional) */}
          <div className={cn('space-y-2 rounded-xl border border-neutral-200/70 dark:border-white/10 bg-surface-container-lowest px-3 py-2.5', disabled && 'opacity-60')}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                Protocolo de infraestrutura
              </p>
              <span className="text-[10px] font-medium text-on-surface-variant/60">Opcional</span>
            </div>
            <div className="relative">
              <select
                value={infraProtocolType}
                onChange={(e) =>
                  setInfraProtocolType(e.target.value as typeof infraProtocolType)
                }
                disabled={disabled}
                className="w-full cursor-pointer appearance-none rounded-lg border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest py-2 pl-3 pr-8 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:cursor-not-allowed"
              >
                <option value="none">Não abrir protocolo de infra</option>
                {MASSIVA_INFRA_PROTOCOL_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60"
                aria-hidden
              />
            </div>

            {infraManualField === 'signal' ? (
              <div>
                <label
                  htmlFor="infra-signal"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant"
                >
                  Sinal aferido (dBm)
                </label>
                <input
                  id="infra-signal"
                  type="text"
                  inputMode="decimal"
                  value={infraSignalDbm}
                  onChange={(e) => setInfraSignalDbm(e.target.value)}
                  disabled={disabled}
                  placeholder="Ex.: -24.0"
                  className="w-full rounded-lg border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            ) : null}

            {infraManualField === 'avaria' ? (
              <div>
                <label
                  htmlFor="infra-avaria"
                  className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant"
                >
                  Tipo de avaria
                </label>
                <textarea
                  id="infra-avaria"
                  rows={2}
                  value={infraAvaria}
                  onChange={(e) => setInfraAvaria(e.target.value)}
                  disabled={disabled}
                  placeholder="Descreva a avaria (ex.: parte interna da CTO quebrada)"
                  className="w-full resize-y rounded-lg border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            ) : null}

            {infraManualField === 'site' ? (
              <InfraSiteSelect
                value={infraSiteCode}
                onChange={setInfraSiteCode}
                disabled={disabled}
              />
            ) : null}

            {infraProtocolType !== 'none' ? (
              <p className="text-[10px] leading-snug text-on-surface-variant">
                Abre 1 protocolo de infraestrutura vinculado à massiva, agregando todos os APs no
                descritivo.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-violet-200/70 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/40 p-2.5 sm:p-3">
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
            <p className="mt-1.5 text-[10px] leading-snug text-on-surface-variant">
              Atualiza o modelo com a rota e os campos acima. Edição manual pausa o auto-sync até
              clicar de novo.
            </p>
          </div>

          <section className="rounded-xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest p-2.5 shadow-sm sm:p-3">
            <div className="mb-1.5 flex items-center gap-1.5 border-b border-neutral-100 dark:border-white/5 pb-1.5">
              <FileText className="size-3.5 text-on-surface-variant/60" aria-hidden />
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Descrição técnica
              </h4>
            </div>
            {descriptionByAp.length > 0 ? (
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-0.5">
                {descriptionByAp.map((item) => (
                  <details
                    key={item.apCode}
                    className="group overflow-hidden rounded-md border border-neutral-200/90 dark:border-white/10 bg-surface-container-low/30 open:bg-surface-container-lowest"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-left text-xs font-semibold text-on-surface [&::-webkit-details-marker]:hidden">
                      <ChevronDown
                        className="size-3.5 shrink-0 text-on-surface-variant/60 transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.apTitle}{' '}
                        <span className="font-mono font-normal text-on-surface-variant">
                          ({item.apCode})
                        </span>
                      </span>
                    </summary>
                    <pre className="max-h-44 overflow-auto whitespace-pre-wrap border-t border-neutral-100 dark:border-white/5 bg-surface-container-lowest px-2 py-2 text-[11px] leading-relaxed text-on-surface">
                      {item.description}
                    </pre>
                  </details>
                ))}
              </div>
            ) : (
              <p className="py-1.5 text-center text-[11px] text-on-surface-variant">
                A descrição por ponto de acesso aparece aqui quando houver rotas prontas.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
