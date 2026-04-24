import { Lock, Wand2 } from 'lucide-react'
import { MASSIVA_SOLICITATION_TYPE_LABEL } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'

type DescriptionByApItem = {
  apCode: string
  apTitle: string
  description: string
}

type MassivaOpenDraftFieldsProps = {
  disabled: boolean
  descriptionByAp?: DescriptionByApItem[]
}

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

  const inputClass =
    'mt-1 w-full rounded-xl border border-neutral-200/90 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-violet-500/80 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-60'

  return (
    <div className="mt-3">
      <div className="space-y-3 rounded-2xl border border-neutral-200/85 bg-gradient-to-br from-violet-50/70 via-white to-white p-3 shadow-[0_2px_12px_-4px_rgba(109,40,217,0.08)] ring-1 ring-violet-100/40 sm:p-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Dados para abertura do protocolo</p>
          <p className="mt-0.5 text-xs text-neutral-600">
            Preencha para gerar a descrição e liberar o envio.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="massiva-event-start-date" className="block text-xs font-medium text-neutral-700">
              Data de abertura
            </label>
            <input
              id="massiva-event-start-date"
              type="date"
              className={inputClass}
              value={eventStartDate}
              onChange={(e) => setEventStartDate(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div>
            <label htmlFor="massiva-event-start-time" className="block text-xs font-medium text-neutral-700">
              Hora de abertura
            </label>
            <input
              id="massiva-event-start-time"
              type="time"
              className={inputClass}
              value={eventStartTime}
              onChange={(e) => setEventStartTime(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="massiva-event-identified-date" className="block text-xs font-medium text-neutral-700">
              Data em que o evento foi identificado
            </label>
            <input
              id="massiva-event-identified-date"
              type="date"
              className={inputClass}
              value={eventIdentifiedDate}
              onChange={(e) => setEventIdentifiedDate(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div>
            <label htmlFor="massiva-event-identified-time" className="block text-xs font-medium text-neutral-700">
              Hora em que o evento foi identificado
            </label>
            <input
              id="massiva-event-identified-time"
              type="time"
              className={inputClass}
              value={eventIdentifiedTime}
              onChange={(e) => setEventIdentifiedTime(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <label htmlFor="massiva-solicitation-type" className="block text-xs font-medium text-neutral-700">
              Tipo de solicitação
            </label>
            <div className="relative mt-1">
              <input
                id="massiva-solicitation-type"
                type="text"
                readOnly
                className={`${inputClass} pr-9`}
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
            <label htmlFor="massiva-forecast-date" className="block text-xs font-medium text-neutral-700">
              Previsão de finalização
            </label>
            <input
              id="massiva-forecast-date"
              type="date"
              className={inputClass}
              value={assignmentForecastDate}
              onChange={(e) => setAssignmentForecastDate(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="massiva-forecast-time" className="block text-xs font-medium text-neutral-700">
              Hora da previsão
            </label>
            <input
              id="massiva-forecast-time"
              type="time"
              className={inputClass}
              value={assignmentForecastTime}
              onChange={(e) => setAssignmentForecastTime(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div>
          <label htmlFor="massiva-initial-report" className="block text-xs font-medium text-neutral-700">
            Relato inicial
          </label>
          <input
            id="massiva-initial-report"
            type="text"
            className={inputClass}
            value={initialReport}
            onChange={(e) => setInitialReport(e.target.value)}
            disabled={disabled}
            placeholder="Opcional - 'Não informado' se vazio"
          />
        </div>

        <div className={`rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 ${disabled ? 'opacity-60' : ''}`}>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 disabled:cursor-not-allowed"
              checked={fieldTechnicianRequesting}
              onChange={(e) => setFieldTechnicianRequesting(e.target.checked)}
              disabled={disabled}
            />
            <span className="text-sm text-neutral-800">
              <span className="font-medium">Técnico em campo solicitando abertura</span>
              <span className="mt-0.5 block text-xs text-neutral-600">
                Se desmarcado, origem como rompimento.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/50 px-3 py-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              enableDescriptionAutoSync()
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 className="size-4 shrink-0" aria-hidden />
            Gerar descrição automática
          </button>
          <p className="mt-1 text-[11px] leading-snug text-neutral-600">
            Atualiza o modelo com a rota e os campos acima. Edição manual pausa o
            auto-sync até clicar de novo.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Descrição técnica</p>
          {descriptionByAp.length > 0 ? (
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {descriptionByAp.map((item) => (
                <details key={item.apCode} className="overflow-hidden rounded-lg border border-neutral-200">
                  <summary className="cursor-pointer bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
                    {item.apTitle} ({item.apCode})
                  </summary>
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed text-neutral-800">
                    {item.description}
                  </pre>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              A descrição por ponto de acesso aparece aqui quando houver rotas prontas.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
