import {
  isPrevisaoEncerramentoAjustadaExplicata,
  resolveExpectedCloseAtForDisplay,
} from '@/features/massiva/lib/massivaPrevisaoLocalEditor'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'
import {
  computeProjectedRestorationAt,
  formatMassivaListDateDisplay,
  formatRestorationHoursLabel,
} from '@/features/massiva/lib/formatMassivaListDate'

function datesEqualWithin(
  a: Date | null,
  b: Date | null,
  toleranceMs: number,
): boolean {
  if (a === null || b === null) return false
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false
  return Math.abs(a.getTime() - b.getTime()) <= toleranceMs
}

type MassivaPrevisaoReferenceBlockProps = {
  ticket: MassivaTicket
}

export function MassivaPrevisaoReferenceBlock({ ticket }: MassivaPrevisaoReferenceBlockProps) {
  const displayClose = resolveExpectedCloseAtForDisplay(ticket)
  const hasExpectedClose =
    displayClose !== null && !Number.isNaN(displayClose.getTime())
  const dataLine = hasExpectedClose
    ? formatMassivaListDateDisplay(displayClose)
    : '—'
  const hoursLine = formatRestorationHoursLabel(ticket.estimateTimeOfRestoration)
  const projected = computeProjectedRestorationAt(
    ticket.openedAt,
    ticket.estimateTimeOfRestoration,
  )
  const matchesSla =
    hasExpectedClose &&
    displayClose !== null &&
    projected !== null &&
    datesEqualWithin(displayClose, projected, 2 * 60 * 1000)
  const hasValidProjection = projected !== null
  const mostrarAjustado = isPrevisaoEncerramentoAjustadaExplicata(ticket, {
    matchesSla,
    hasValidProjection,
    effectiveCloseAt: displayClose,
  })

  return (
    <div className="mt-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900/80">
        Previsão e SLA
      </p>
      <div
        className="mt-2 space-y-3.5 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3.5 py-3.5 sm:px-4"
        data-massiva-pdf-amber
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            Prazo de encerramento
          </p>
          <p className="mt-0.5 text-base leading-relaxed text-neutral-900">
            {mostrarAjustado ? (
              <>
                <span className="font-semibold text-neutral-600">Ajustado para </span>
                <span className="font-bold">{dataLine}</span>
              </>
            ) : (
              <span className="font-bold">{dataLine}</span>
            )}
          </p>
        </div>
        {hoursLine !== null ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Estimativa (h)
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-relaxed text-neutral-900">
              {hoursLine}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
