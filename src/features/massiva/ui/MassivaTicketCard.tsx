import { useEffect, useRef, useState, type MouseEventHandler } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import {
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  FileDown,
  IdCard,
  Loader2,
  Megaphone,
  Network,
  Pencil,
  ScrollText,
  UserPlus,
  Users,
} from 'lucide-react'
import { getOidcUserDisplayName } from '@/app/auth/oidcUserDisplayName'
import { updateMassivaExpectedClose } from '@/features/massiva/api/updateMassivaExpectedClose'
import {
  recordMassivaPrevisaoEncerramentoEdit,
  resolveExpectedCloseAtForDisplay,
} from '@/features/massiva/lib/massivaPrevisaoLocalEditor'
import { exportElementToPdf } from '@/features/massiva/lib/exportElementToPdf'
import {
  formatMassivaListDateDisplay,
  formatRestorationHoursLabel,
  pickRestorationHoursForDisplay,
  restorationHoursBetweenDates,
  normalizeDateTimeLocalString,
  parseDateTimeLocalToDate,
  toDateTimeLocalInputValue,
} from '@/features/massiva/lib/formatMassivaListDate'
import {
  preprocessOccurrenceTextForDisplay,
  splitOccurrenceIntoParagraphs,
} from '@/features/massiva/lib/massivaOccurrenceText'
import { isMassivaCatalogOutOfBand } from '@/features/massiva/lib/massivaCatalogTitle'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { ApiError } from '@/shared/api/apiError'
import { env } from '@/shared/config/env'
import { effectiveMassivaStatus } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import {
  formatMassivaTicketStatusLabel,
  type MassivaTicket,
} from '@/features/massiva/model/massivaTicket'
import { MassivaPrevisaoReferenceBlock } from '@/features/massiva/ui/MassivaPrevisaoReferenceBlock'
import { cn } from '@/shared/lib/utils'

type MassivaTicketCardProps = {
  ticket: MassivaTicket
  closeConfigured: boolean
  onRequestClose: (protocol: number) => void
}

function displayOrDash(value: string, emptyLabel = 'Não informado'): string {
  const t = value.trim()
  return t !== '' ? t : emptyLabel
}

function defaultDraftExpectedClose(ticket: MassivaTicket): string {
  const display = resolveExpectedCloseAtForDisplay(ticket)
  if (display !== null && !Number.isNaN(display.getTime())) {
    return toDateTimeLocalInputValue(display)
  }
  if (ticket.openedAt !== null && !Number.isNaN(ticket.openedAt.getTime())) {
    return toDateTimeLocalInputValue(
      new Date(ticket.openedAt.getTime() + 3 * 60 * 60 * 1000),
    )
  }
  return toDateTimeLocalInputValue(new Date(Date.now() + 3 * 60 * 60 * 1000))
}

type MassivaRecordKind = 'incidente' | 'evento' | 'outro'

function classifyMassivaRecordKind(ticket: MassivaTicket): MassivaRecordKind {
  const source = `${ticket.title} ${ticket.description}`.trim().toLowerCase()
  if (source.includes('incidente massivo') || source.includes('incidente')) return 'incidente'
  if (source.includes('evento massivo') || source.includes('evento')) return 'evento'
  return 'outro'
}

function expectedCloseDisplayForCard(ticket: MassivaTicket): string {
  const closeAt = resolveExpectedCloseAtForDisplay(ticket) ?? ticket.expectedCloseAt
  // Previsão de encerramento deve aparecer como DATA (dd/mm/aaaa hh:mm), não como
  // duração em horas. Só cai para horas de restauração (SLA) quando não há data válida.
  const dateLabel = formatMassivaListDateDisplay(closeAt)
  if (closeAt !== null && dateLabel !== '—') return dateLabel

  const hours = pickRestorationHoursForDisplay(
    ticket.openedAt,
    closeAt,
    ticket.estimateTimeOfRestoration,
  )
  return formatRestorationHoursLabel(hours) ?? dateLabel
}

function ProtocolOccurrenceContent({ text }: { text: string }) {
  const normalized = preprocessOccurrenceTextForDisplay(text)
  if (normalized === '') {
    return (
      <p className="text-sm text-neutral-500">
        Não há texto de ocorrência associado a este registro.
      </p>
    )
  }

  const blocks = splitOccurrenceIntoParagraphs(normalized)
  const toRender = blocks.length > 0 ? blocks : [normalized]

  return (
    <div className="space-y-3">
      {toRender.map((block, i) => (
        <div
          key={i}
          className="rounded-lg border border-neutral-200/80 bg-white/90 px-3.5 py-2.5 shadow-sm sm:px-4 sm:py-3"
        >
          <p className="whitespace-pre-line [overflow-wrap:anywhere] text-[0.9375rem] leading-[1.75] text-neutral-800">
            {block}
          </p>
        </div>
      ))}
    </div>
  )
}

function ProtocolDescriptionDialog({
  ticket,
  onClose,
}: {
  ticket: MassivaTicket
  onClose: () => void
}) {
  const descText = ticket.description.trim()
  const protocolLabel = ticket.protocol > 0 ? String(ticket.protocol) : '—'
  const pdfCaptureRef = useRef<HTMLDivElement | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fileBase = ticket.protocol > 0 ? `massiva-protocolo-${ticket.protocol}` : 'massiva-protocolo'

  const onExportPdf: MouseEventHandler<HTMLButtonElement> = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const el = pdfCaptureRef.current
    if (el === null) {
      setPdfError('Não foi possível preparar a área de exportação. Feche e abra o modal e tente de novo.')
      return
    }
    setPdfError(null)
    setPdfBusy(true)
    try {
      await exportElementToPdf(el, fileBase)
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível gerar o PDF. Tente noutro navegador ou desative bloqueadores de janela.'
      setPdfError(msg)
      console.error(err)
    } finally {
      setPdfBusy(false)
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="massiva-desc-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            ref={pdfCaptureRef}
            className="w-full min-w-0 bg-white"
            data-massiva-pdf-capture
          >
            <div className="shrink-0 border-b border-neutral-200/80 bg-gradient-to-r from-amber-50/40 to-white px-5 pb-4 pt-5 sm:px-6">
              <h3
                id="massiva-desc-dialog-title"
                className="text-lg font-bold tracking-tight text-neutral-900"
              >
                Detalhes do protocolo
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                <span className="font-mono text-[13px] text-neutral-600">#{protocolLabel}</span>
                <span className="text-neutral-400"> — </span>
                <span className="text-sm font-medium text-neutral-700">
                  {formatMassivaTicketStatusLabel(ticket)}
                </span>
              </p>
            </div>
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900/80">
                Ocorrência
              </p>
              <div className="mt-3 rounded-xl border border-neutral-200/90 bg-gradient-to-b from-slate-50/90 to-white p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] sm:p-5">
                <ProtocolOccurrenceContent text={descText} />
              </div>
              <MassivaPrevisaoReferenceBlock ticket={ticket} />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-200/80 bg-neutral-50/50 px-5 py-3 sm:px-6">
          {pdfError !== null ? (
            <p className="mb-2 text-left text-xs leading-snug text-red-700">
              {pdfError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={pdfBusy}
              onClick={onExportPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/90 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-amber-300/80 hover:bg-amber-50/50 disabled:opacity-50"
            >
              {pdfBusy ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FileDown className="size-4 shrink-0" aria-hidden />
              )}
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-amber-300/70 hover:bg-amber-50/40"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}

function CloseDescriptionDialog({
  ticket,
  onClose,
}: {
  ticket: MassivaTicket
  onClose: () => void
}) {
  const protocolLabel = ticket.protocol > 0 ? String(ticket.protocol) : '—'
  const text = ticket.closeDescription?.trim() ?? ''
  const closedBy = ticket.closedBy?.trim() ?? ''

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(80vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="massiva-close-desc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-neutral-200/80 bg-gradient-to-r from-neutral-50/80 to-white px-5 pb-4 pt-5 sm:px-6">
          <h3
            id="massiva-close-desc-title"
            className="text-base font-bold tracking-tight text-neutral-900"
          >
            Motivo de encerramento
          </h3>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">
            #{protocolLabel}
          </p>
          {closedBy !== '' ? (
            <p className="mt-1 text-xs text-neutral-600">
              Encerrado por <span className="font-semibold text-neutral-800">{closedBy}</span>
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {text !== '' ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-800">
              {text}
            </p>
          ) : (
            <p className="text-sm italic text-neutral-400">
              Nenhum relato de encerramento registrado.
            </p>
          )}
        </div>
        <div className="shrink-0 border-t border-neutral-200/80 bg-neutral-50/50 px-5 py-3 sm:px-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}

export function MassivaTicketCard({
  ticket,
  closeConfigured,
  onRequestClose,
}: MassivaTicketCardProps) {
  const queryClient = useQueryClient()
  const auth = useAuth()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [closeDescOpen, setCloseDescOpen] = useState(false)
  const [editingExpectedClose, setEditingExpectedClose] = useState(false)
  const [expectedCloseDraft, setExpectedCloseDraft] = useState('')
  const displayStatus = effectiveMassivaStatus(ticket)

  const canEditExpectedClose =
    displayStatus === 'aberta' &&
    env.massivaAfetadosPath.trim() !== '' &&
    ticket.protocol > 0

  const updatePrevisaoMutation = useMutation({
    mutationFn: async () => {
      const savedAt = parseDateTimeLocalToDate(
        normalizeDateTimeLocalString(expectedCloseDraft),
      )
      if (savedAt === null) {
        throw new Error('Data ou hora inválida.')
      }
      const result = await updateMassivaExpectedClose({
        protocol: ticket.protocol,
        newExpectedClose: savedAt,
      })
      return { result, savedAt }
    },
    onSuccess: async ({ result, savedAt }) => {
      setEditingExpectedClose(false)
      const fromPatch = result.editorFromResponse?.trim()
      let editorName: string | null = null
      if (fromPatch !== undefined && fromPatch !== '') {
        editorName = fromPatch
      } else if (auth != null && auth.isAuthenticated) {
        editorName = getOidcUserDisplayName(auth.user)
      }
      recordMassivaPrevisaoEncerramentoEdit(ticket.protocol, {
        closeAt: savedAt,
        editorName,
      })
      queryClient.setQueryData<MassivaTicket[]>(massivaKeys.list(), (prev) => {
        if (prev == null) return prev
        return prev.map((t) => {
          if (t.protocol !== ticket.protocol) return t
          const hours = restorationHoursBetweenDates(t.openedAt, savedAt)
          return {
            ...t,
            expectedCloseAt: savedAt,
            estimateTimeOfRestoration: hours ?? t.estimateTimeOfRestoration,
          }
        })
      })
      await queryClient.invalidateQueries({ queryKey: massivaKeys.list() })
    },
  })

  const protocolLabel = ticket.protocol > 0 ? String(ticket.protocol) : '—'
  const statusLabel = formatMassivaTicketStatusLabel({
    ...ticket,
    status: displayStatus,
  })

  const statusStyles =
    displayStatus === 'aberta'
      ? 'border-emerald-300/80 bg-emerald-50 text-emerald-900'
      : displayStatus === 'encerrada'
        ? statusLabel === 'Cancelada'
          ? 'border-neutral-200 bg-neutral-100 text-neutral-600'
          : 'border-neutral-200 bg-neutral-100 text-neutral-700'
        : 'border-amber-200 bg-amber-50 text-amber-900'

  const apKnown = ticket.apCode.trim() !== ''
  const splitterKnown = ticket.splitterCode.trim() !== ''
  const recordKind = classifyMassivaRecordKind(ticket)
  const catalogOutOfBand = isMassivaCatalogOutOfBand(ticket.title)

  return (
    <article
      className={cn(
        'h-full overflow-hidden rounded-2xl border bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-[0.99] slide-in-from-bottom-1',
        catalogOutOfBand
          ? 'border-amber-400/80 ring-amber-400/35'
          : 'border-neutral-200/85',
      )}
      aria-label={`Massiva protocolo ${protocolLabel}`}
    >
      <div
        className={cn(
          'flex flex-col gap-2.5 border-b p-3 sm:flex-row sm:items-start sm:justify-between',
          catalogOutOfBand
            ? 'border-amber-200/90 bg-gradient-to-r from-amber-50/80 to-orange-50/40'
            : 'border-neutral-100/90 bg-gradient-to-r from-white to-neutral-50/40',
        )}
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
              recordKind === 'incidente'
                ? 'bg-rose-100 text-rose-800 ring-rose-200/70'
                : recordKind === 'evento'
                  ? 'bg-sky-100 text-sky-800 ring-sky-200/70'
                  : displayStatus === 'aberta'
                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                    : displayStatus === 'encerrada'
                      ? 'bg-neutral-100 text-neutral-600 ring-neutral-200/80'
                      : 'bg-amber-100 text-amber-800 ring-amber-200/70',
            )}
          >
            {recordKind === 'incidente' ? (
              <AlertTriangle size={20} strokeWidth={2} aria-hidden />
            ) : (
              <Megaphone size={20} strokeWidth={2} aria-hidden />
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-xs font-semibold tabular-nums text-neutral-500">
              #{protocolLabel}
            </p>
            <h3 className="text-sm font-semibold leading-snug text-neutral-900 sm:text-base">
              {ticket.title.trim() !== '' ? ticket.title : 'Massiva'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex w-fit rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  statusStyles,
                )}
              >
                {statusLabel}
              </span>
              {catalogOutOfBand ? (
                <span
                  className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-700/35 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950"
                  title="Título diferente dos catálogos esperados (Registro Evento Massivo ou Registro Incidente de Rede)."
                >
                  Fora do catálogo esperado
                </span>
              ) : null}
              {ticket.usedFallback ? (
                <span
                  className="rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-600"
                  title="Estratégia bulk_individual ou fallback registrado na origem"
                >
                  Fallback
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-stretch justify-end gap-2 sm:w-auto sm:items-center">
          {displayStatus === 'encerrada' ? (
            <button
              type="button"
              onClick={() => setCloseDescOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200/90 bg-white text-neutral-500 shadow-sm transition hover:border-neutral-300 hover:text-neutral-800"
              title="Ver motivo de encerramento"
              aria-label="Ver motivo de encerramento"
            >
              <ScrollText size={18} strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200/90 bg-white text-neutral-600 shadow-sm transition hover:border-amber-300/80 hover:text-amber-900"
            title="Ver descrição do protocolo"
            aria-label="Ver descrição do protocolo"
          >
            <Eye size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'flex items-start gap-2.5 border-b border-neutral-100 px-3 py-2.5',
          apKnown || splitterKnown
            ? 'bg-sky-50/40'
            : 'bg-amber-50/35',
        )}
      >
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
            apKnown || splitterKnown
              ? 'bg-white text-sky-700 ring-sky-200/70'
              : 'bg-white text-amber-800 ring-amber-200/70',
          )}
        >
          <Network size={16} aria-hidden />
        </div>
        <div className="min-w-0 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Ponto de acesso
          </p>
          <p
            className={cn(
              'mt-0.5 font-medium leading-snug',
              apKnown || splitterKnown ? 'text-neutral-900' : 'text-amber-900/90',
            )}
          >
            {apKnown ? (
              <span className="font-mono">{ticket.apCode}</span>
            ) : (
              'Ponto de acesso não informado'
            )}
          </p>
          {splitterKnown ? (
            <p className="mt-1 text-xs text-neutral-600">
              Splitter:{' '}
              <span className="font-mono font-medium text-neutral-800">{ticket.splitterCode}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-[72px] flex-nowrap items-center justify-between gap-2.5 border-b border-amber-100/80 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-amber-100/30 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/90 text-amber-900 ring-1 ring-amber-200/60">
            <Users size={18} aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80">
              Clientes afetados
            </p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
              {ticket.affectedClients}
            </p>
          </div>
        </div>
        {ticket.affectedClients > 0 ? (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-amber-300/80 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 shadow-sm">
            Impactados
          </span>
        ) : (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-neutral-200/90 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Sem impacto mapeado
          </span>
        )}
      </div>

      <div className="grid gap-2.5 bg-neutral-50/50 p-3 sm:grid-cols-2">
        <div className="flex gap-2.5 text-xs">
          <Clock className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
          <div>
            <p className="font-semibold text-neutral-500">Abertura</p>
            <p className="mt-0.5 font-medium text-neutral-900">
              {formatMassivaListDateDisplay(ticket.openedAt)}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 gap-2.5 text-xs">
          <Calendar className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-neutral-500">Previsão de encerramento</p>
            {editingExpectedClose && canEditExpectedClose ? (
              <div className="mt-1.5 space-y-2">
                <input
                  type="datetime-local"
                  value={expectedCloseDraft}
                  step={60}
                  onChange={(e) =>
                    setExpectedCloseDraft(normalizeDateTimeLocalString(e.target.value))
                  }
                  className="w-full min-w-0 max-w-full rounded-lg border border-neutral-200/90 bg-white px-2 py-1.5 text-xs text-neutral-900 shadow-sm focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/25"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={updatePrevisaoMutation.isPending}
                    onClick={() => {
                      updatePrevisaoMutation.mutate()
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    {updatePrevisaoMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Salvar previsão
                  </button>
                  <button
                    type="button"
                    disabled={updatePrevisaoMutation.isPending}
                    onClick={() => {
                      setEditingExpectedClose(false)
                      updatePrevisaoMutation.reset()
                    }}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
                {updatePrevisaoMutation.isError ? (
                  <p className="whitespace-pre-wrap break-words text-[11px] leading-snug text-red-700">
                    {updatePrevisaoMutation.error instanceof ApiError
                      ? `${updatePrevisaoMutation.error.message}${
                        updatePrevisaoMutation.error.body.trim() === ''
                          ? ''
                          : `\n${updatePrevisaoMutation.error.body}`
                      }`
                      : updatePrevisaoMutation.error instanceof Error
                        ? updatePrevisaoMutation.error.message
                        : 'Não foi possível atualizar a previsão.'}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-0.5 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <p className="min-w-0 font-medium leading-snug text-neutral-900 sm:flex-1 sm:pr-1">
                  {expectedCloseDisplayForCard(ticket)}
                </p>
                {canEditExpectedClose ? (
                  <button
                    type="button"
                    onClick={() => {
                      setExpectedCloseDraft(defaultDraftExpectedClose(ticket))
                      setEditingExpectedClose(true)
                    }}
                    className="inline-flex w-fit shrink-0 items-center gap-1 self-end rounded-lg border border-neutral-200/90 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-600 shadow-sm transition hover:border-amber-300/80 hover:bg-amber-50/50 hover:text-amber-900 sm:self-auto"
                    aria-label="Editar previsão de encerramento"
                  >
                    <Pencil size={12} strokeWidth={2.5} aria-hidden />
                    Editar
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2.5 text-xs sm:col-span-2">
          <Users className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-neutral-500">Equipe</p>
            <p className="mt-0.5 break-words font-medium text-neutral-900">
              {displayOrDash(ticket.team)}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 text-xs">
          <UserPlus className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-neutral-500">Solicitado por</p>
            <p className="mt-0.5 break-words font-medium text-neutral-900">
              {displayOrDash(ticket.createdBy)}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 text-xs">
          <IdCard className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-neutral-500">Responsável</p>
            <p className="mt-0.5 break-words font-medium text-neutral-900">
              {displayOrDash(ticket.responsible)}
            </p>
          </div>
        </div>
        {ticket.assignmentId !== null ? (
          <p className="text-[10px] text-neutral-400 sm:col-span-2">
            Assignment (atendimento):{' '}
            <span className="font-mono font-medium text-neutral-500">{ticket.assignmentId}</span>
          </p>
        ) : null}
        <div className="pt-0.5 sm:col-span-2">
          <div className="flex min-h-[34px] items-center justify-center">
            {displayStatus === 'aberta' ? (
              <button
                type="button"
                disabled={!closeConfigured}
                onClick={() => onRequestClose(ticket.protocol)}
                className="mx-auto inline-flex min-w-[165px] items-center justify-center gap-2 rounded-xl border border-amber-200/90 bg-gradient-to-b from-amber-500 to-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-amber-500/20 transition hover:from-amber-500 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                Encerrar massiva
              </button>
            ) : (
              <span aria-hidden="true" className="invisible inline-flex min-w-[165px] px-3.5 py-2 text-xs">
                placeholder
              </span>
            )}
          </div>
        </div>
      </div>
      {detailsOpen ? (
        <ProtocolDescriptionDialog
          ticket={ticket}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
      {closeDescOpen ? (
        <CloseDescriptionDialog
          ticket={ticket}
          onClose={() => setCloseDescOpen(false)}
        />
      ) : null}
    </article>
  )
}
