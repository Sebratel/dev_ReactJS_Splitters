import {
  isPrevisaoEncerramentoAjustadaExplicata,
  resolveExpectedCloseAtForDisplay,
} from '@/features/massiva/lib/massivaPrevisaoLocalEditor'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'
import {
  formatMassivaListDateDisplay,
  formatRestorationHoursLabel,
} from '@/features/massiva/lib/formatMassivaListDate'

type MassivaPrevisaoReferenceBlockProps = {
  ticket: MassivaTicket
}

function derivedRestorationHoursLabel(
  openedAt: Date | null,
  closeAt: Date | null,
): string | null {
  if (openedAt === null || closeAt === null) return null
  if (Number.isNaN(openedAt.getTime()) || Number.isNaN(closeAt.getTime())) return null
  const diffMs = closeAt.getTime() - openedAt.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return null
  return formatRestorationHoursLabel(diffMs / (60 * 60 * 1000))
}

export function MassivaPrevisaoReferenceBlock({ ticket }: MassivaPrevisaoReferenceBlockProps) {
  const displayClose = resolveExpectedCloseAtForDisplay(ticket)
  const hasExpectedClose =
    displayClose !== null && !Number.isNaN(displayClose.getTime())
  const dataLine = hasExpectedClose
    ? formatMassivaListDateDisplay(displayClose)
    : '—'
  const hoursLine =
    derivedRestorationHoursLabel(ticket.openedAt, displayClose) ??
    formatRestorationHoursLabel(ticket.estimateTimeOfRestoration)
  const mostrarAjustado = isPrevisaoEncerramentoAjustadaExplicata(ticket, {
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
