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
  Wifi,
  Wrench,
} from 'lucide-react'
import { getOidcUserDisplayName } from '@/app/auth/oidcUserDisplayName'
import { updateMassivaExpectedClose } from '@/features/massiva/api/updateMassivaExpectedClose'
import { registerMassivaExpectedCloseInLocalDb } from '@/features/massiva/api/registerMassivaExpectedCloseInLocalDb'
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
import {
  verifyMassivaAffectedClients,
  type VerifyMassivaAffectedClientsResult,
} from '@/features/massiva/api/verifyMassivaAffectedClients'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { ApiError } from '@/shared/api/apiError'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { env } from '@/shared/config/env'
import { effectiveMassivaStatus } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import {
  formatMassivaTicketStatusLabel,
  type MassivaTicket,
} from '@/features/massiva/model/massivaTicket'
import { MassivaPrevisaoReferenceBlock } from '@/features/massiva/ui/MassivaPrevisaoReferenceBlock'
import { cn } from '@/shared/lib/utils'

export type MassivaLastAffectedVerification = {
  checkedAt: Date
  total: number
  stillOffline: number
  stillDegraded: number
  verifiedBy: string | null
}

type MassivaTicketCardProps = {
  ticket: MassivaTicket
  closeConfigured: boolean
  onRequestClose: (protocol: number) => void
  onRequestCancel: (protocol: number) => void
  onRequestMaintenance: (protocol: number) => void
  /** Resultado da última verificação "clientes ainda sem sinal?" — null se nunca verificado. */
  lastAffectedVerification: MassivaLastAffectedVerification | null
  /** Usuário logado, registrado como quem verificou ao clicar "Verificar clientes". */
  verifiedByLabel: string
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
  // Encerrada: mostra a data REAL de encerramento (closedAt). A previsão já não importa.
  if (ticket.status === 'encerrada' && ticket.closedAt !== null) {
    const closedLabel = formatMassivaListDateDisplay(ticket.closedAt)
    if (closedLabel !== '—') return closedLabel
  }
  // Aberta (ou encerrada sem data real): mostra a PREVISÃO como DATA (dd/mm/aaaa hh:mm),
  // não como duração em horas. Só cai para horas de SLA quando não há data válida.
  const closeAt = resolveExpectedCloseAtForDisplay(ticket) ?? ticket.expectedCloseAt
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
      <p className="text-sm text-on-surface-variant">
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
          className="rounded-lg border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest/90 px-3.5 py-2.5 shadow-sm sm:px-4 sm:py-3"
        >
          <p className="whitespace-pre-line [overflow-wrap:anywhere] text-[0.9375rem] leading-[1.75] text-on-surface">
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
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="massiva-desc-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            ref={pdfCaptureRef}
            className="w-full min-w-0 bg-surface-container-lowest"
            data-massiva-pdf-capture
          >
            <div className="shrink-0 border-b border-neutral-200/80 dark:border-white/10 bg-gradient-to-r from-amber-50/40 dark:from-amber-950/20 to-white dark:to-surface-container-lowest px-5 pb-4 pt-5 sm:px-6">
              <h3
                id="massiva-desc-dialog-title"
                className="text-lg font-bold tracking-tight text-on-surface"
              >
                Detalhes do protocolo
              </h3>
              <p className="mt-1 text-xs text-on-surface-variant">
                <span className="font-mono text-[13px] text-on-surface-variant">#{protocolLabel}</span>
                <span className="text-on-surface-variant/60"> — </span>
                <span className="text-sm font-medium text-on-surface-variant">
                  {formatMassivaTicketStatusLabel(ticket)}
                </span>
              </p>
            </div>
            <div className="px-5 py-4 sm:px-6 sm:py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900/80 dark:text-amber-200">
                Ocorrência
              </p>
              <div className="mt-3 rounded-xl border border-neutral-200/90 dark:border-white/10 bg-gradient-to-b from-slate-50/90 dark:from-white/5 to-white dark:to-surface-container-lowest p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] sm:p-5">
                <ProtocolOccurrenceContent text={descText} />
              </div>
              <MassivaPrevisaoReferenceBlock ticket={ticket} />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-200/80 dark:border-white/10 bg-surface-container-low/50 px-5 py-3 sm:px-6">
          {pdfError !== null ? (
            <p className="mb-2 text-left text-xs leading-snug text-red-700 dark:text-red-200">
              {pdfError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={pdfBusy}
              onClick={onExportPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest px-3.5 py-2 text-sm font-semibold text-on-surface shadow-sm transition hover:border-amber-300/80 hover:bg-amber-50/50 dark:hover:bg-amber-950/40 disabled:opacity-50"
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
              className="rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition hover:border-amber-300/70 hover:bg-amber-50/40 dark:hover:bg-amber-950/40"
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
  const closedAtLabel = ticket.closedAt ? formatMassivaListDateDisplay(ticket.closedAt) : ''

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
        className="flex max-h-[min(80vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="massiva-close-desc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-neutral-200/80 dark:border-white/10 bg-gradient-to-r from-neutral-50/80 dark:from-white/5 to-white dark:to-surface-container-lowest px-5 pb-4 pt-5 sm:px-6">
          <h3
            id="massiva-close-desc-title"
            className="text-base font-bold tracking-tight text-on-surface"
          >
            Motivo de encerramento
          </h3>
          <p className="mt-0.5 font-mono text-xs text-on-surface-variant">
            #{protocolLabel}
          </p>
          {closedAtLabel !== '' && closedAtLabel !== '—' ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              Encerrado em <span className="font-semibold text-on-surface">{closedAtLabel}</span>
            </p>
          ) : null}
          {closedBy !== '' ? (
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Encerrado por <span className="font-semibold text-on-surface">{closedBy}</span>
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {text !== '' ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-on-surface">
              {text}
            </p>
          ) : (
            <p className="text-sm italic text-on-surface-variant/60">
              Nenhum relato de encerramento registrado.
            </p>
          )}
        </div>
        <div className="shrink-0 border-t border-neutral-200/80 dark:border-white/10 bg-surface-container-low/50 px-5 py-3 sm:px-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition hover:border-neutral-300 hover:bg-surface-container-low"
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

function AffectedVerificationDialog({
  ticket,
  lastAffectedVerification,
  verifiedByLabel,
  onClose,
}: {
  ticket: MassivaTicket
  lastAffectedVerification: MassivaLastAffectedVerification | null
  verifiedByLabel: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [freshResult, setFreshResult] = useState<VerifyMassivaAffectedClientsResult | null>(null)

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyMassivaAffectedClients({
        protocol: ticket.protocol,
        assignmentId: ticket.assignmentId,
        verifiedBy: verifiedByLabel,
      }),
    onSuccess: async (result) => {
      setFreshResult(result)
      await queryClient.invalidateQueries({ queryKey: massivaKeys.all })
    },
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown: MassivaLastAffectedVerification | null = freshResult != null
    ? {
        checkedAt: freshResult.checkedAt ?? new Date(),
        total: freshResult.total,
        stillOffline: freshResult.stillOffline,
        stillDegraded: freshResult.stillDegraded,
        verifiedBy: verifiedByLabel,
      }
    : lastAffectedVerification

  const protocolLabel = ticket.protocol > 0 ? String(ticket.protocol) : '—'

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="massiva-affected-verify-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="massiva-affected-verify-title" className="text-base font-bold tracking-tight text-on-surface">
          Clientes ainda sem sinal?
        </h3>
        <p className="mt-0.5 font-mono text-xs text-on-surface-variant">#{protocolLabel}</p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          Cruza os clientes afetados por esta massiva com o monitoramento de sinal (ONU) agora
          mesmo. Só roda quando você clica — não é automático.
        </p>

        {shown !== null ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-neutral-200/80 dark:border-white/10 bg-surface-container-low/60 px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Afetados</p>
              <p className="mt-0.5 text-xl font-bold text-on-surface">{shown.total}</p>
            </div>
            <div className="rounded-lg border border-rose-200/70 dark:border-rose-800/50 bg-rose-50/60 dark:bg-rose-950/40 px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">Offline</p>
              <p className="mt-0.5 text-xl font-bold text-rose-700 dark:text-rose-200">{shown.stillOffline}</p>
            </div>
            <div className="rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/40 px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">Degradado</p>
              <p className="mt-0.5 text-xl font-bold text-amber-800 dark:text-amber-200">{shown.stillDegraded}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm italic text-on-surface-variant/60">
            Ainda não verificado. Clique em "Verificar agora" para checar o sinal atual.
          </p>
        )}

        {shown !== null ? (
          <p className="mt-3 text-[11px] text-on-surface-variant">
            Última verificação por <span className="font-semibold text-on-surface-variant">{shown.verifiedBy?.trim() || 'não informado'}</span>
            {' em '}
            <span className="font-semibold text-on-surface-variant">{formatMassivaListDateDisplay(shown.checkedAt)}</span>.
          </p>
        ) : null}

        {verifyMutation.isError ? (
          <p className="mt-2 text-xs text-red-700 dark:text-red-200">{formatQueryError(verifyMutation.error)}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-on-surface-variant"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {verifyMutation.isPending ? 'Verificando...' : 'Verificar agora'}
          </button>
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
  onRequestCancel,
  onRequestMaintenance,
  lastAffectedVerification,
  verifiedByLabel,
}: MassivaTicketCardProps) {
  const queryClient = useQueryClient()
  const auth = useAuth()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [closeDescOpen, setCloseDescOpen] = useState(false)
  const [affectedVerifyOpen, setAffectedVerifyOpen] = useState(false)
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
      // Persiste no banco local (massiva_history) — fonte de verdade da data exibida
      // para massivas abertas. Sem isto a edição só apareceria neste navegador.
      // Falha aqui não deve derrubar o fluxo (o PATCH no Elleven já ocorreu).
      try {
        await registerMassivaExpectedCloseInLocalDb({
          protocol: ticket.protocol,
          assignmentId: ticket.assignmentId ?? null,
          expectedCloseAt: savedAt,
        })
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Massiva] Falha ao gravar previsão no banco local:', err)
        }
      }
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: massivaKeys.list() }),
        // Recarrega a listagem do histórico local (chave prefixada) para a nova data
        // aparecer sem esperar o staleTime.
        queryClient.invalidateQueries({ queryKey: [...massivaKeys.all, 'history-list'] }),
      ])
    },
  })

  const protocolLabel = ticket.protocol > 0 ? String(ticket.protocol) : '—'
  const statusLabel = formatMassivaTicketStatusLabel({
    ...ticket,
    status: displayStatus,
  })

  const statusStyles =
    displayStatus === 'aberta'
      ? 'border-emerald-300/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
      : displayStatus === 'cancelada'
        ? 'border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200'
        : displayStatus === 'encerrada'
          ? 'border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 text-on-surface-variant'
          : 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'

  const apKnown = ticket.apCode.trim() !== ''
  const splitterKnown = ticket.splitterCode.trim() !== ''
  const recordKind = classifyMassivaRecordKind(ticket)
  const catalogOutOfBand = isMassivaCatalogOutOfBand(ticket.title)

  return (
    <article
      className={cn(
        'h-full overflow-hidden rounded-2xl border bg-surface-container-lowest shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_rgba(15,23,42,0.14)] animate-in fade-in zoom-in-[0.99] slide-in-from-bottom-1',
        catalogOutOfBand
          ? 'border-amber-400/80 ring-amber-400/35'
          : 'border-neutral-200/85 dark:border-white/10',
      )}
      aria-label={`Massiva protocolo ${protocolLabel}`}
    >
      <div
        className={cn(
          'flex flex-col gap-2.5 border-b p-3 sm:flex-row sm:items-start sm:justify-between',
          catalogOutOfBand
            ? 'border-amber-200/90 dark:border-amber-800/50 bg-gradient-to-r from-amber-50/80 dark:from-amber-950/20 to-orange-50/40 dark:to-orange-950/20'
            : 'border-neutral-100/90 dark:border-white/5 bg-gradient-to-r from-white dark:from-surface-container-lowest to-neutral-50/40 dark:to-white/5',
        )}
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
              recordKind === 'incidente'
                ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 ring-rose-200/70 dark:ring-rose-800/50'
                : recordKind === 'evento'
                  ? 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 ring-sky-200/70 dark:ring-sky-800/50'
                  : displayStatus === 'aberta'
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 ring-emerald-200/70 dark:ring-emerald-800/50'
                    : displayStatus === 'cancelada'
                      ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200 ring-rose-200/70 dark:ring-rose-800/50'
                      : displayStatus === 'encerrada'
                        ? 'bg-neutral-100 dark:bg-white/5 text-on-surface-variant ring-neutral-200/80 dark:ring-white/10'
                        : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 ring-amber-200/70 dark:ring-amber-800/50',
            )}
          >
            {recordKind === 'incidente' ? (
              <AlertTriangle size={20} strokeWidth={2} aria-hidden />
            ) : (
              <Megaphone size={20} strokeWidth={2} aria-hidden />
            )}
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-xs font-semibold tabular-nums text-on-surface-variant">
              #{protocolLabel}
            </p>
            <h3 className="text-sm font-semibold leading-snug text-on-surface sm:text-base">
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
                  className="inline-flex w-fit items-center gap-1 rounded-md border border-amber-700/35 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 dark:text-amber-100"
                  title="Título diferente dos catálogos esperados (Registro Evento Massivo ou Registro Incidente de Rede)."
                >
                  Fora do catálogo esperado
                </span>
              ) : null}
              {ticket.usedFallback ? (
                <span
                  className="rounded-md border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant"
                  title="Estratégia bulk_individual ou fallback registrado na origem"
                >
                  Fallback
                </span>
              ) : null}
              {ticket.infraProtocol != null && ticket.infraProtocol > 0 ? (
                <span
                  className="inline-flex w-fit items-center gap-1 rounded-md border border-sky-300/70 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200"
                  title={`Protocolo de infraestrutura vinculado a esta massiva: #${ticket.infraProtocol}`}
                >
                  <Wrench size={11} strokeWidth={2.2} aria-hidden />
                  Infra #{ticket.infraProtocol}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-stretch justify-end gap-2 sm:w-auto sm:items-center">
          {displayStatus === 'encerrada' ? (
            <>
              <button
                type="button"
                onClick={() => setCloseDescOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant shadow-sm transition hover:border-neutral-300 hover:text-on-surface"
                title="Ver motivo de encerramento"
                aria-label="Ver motivo de encerramento"
              >
                <ScrollText size={18} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => onRequestMaintenance(ticket.protocol)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant shadow-sm transition hover:border-sky-300/80 hover:text-sky-800 dark:hover:text-sky-200"
                title="Manutenção — editar classificação do incidente"
                aria-label="Manutenção — editar classificação do incidente"
              >
                <Wrench size={18} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setAffectedVerifyOpen(true)}
                className={cn(
                  'relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-surface-container-lowest shadow-sm transition',
                  lastAffectedVerification != null &&
                    (lastAffectedVerification.stillOffline > 0 || lastAffectedVerification.stillDegraded > 0)
                    ? 'border-rose-300/80 text-rose-600 dark:text-rose-300 hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-200'
                    : 'border-neutral-200/90 dark:border-white/10 text-on-surface-variant hover:border-sky-300/80 hover:text-sky-800 dark:hover:text-sky-200',
                )}
                title="Verificar se os clientes afetados continuam sem sinal"
                aria-label="Verificar se os clientes afetados continuam sem sinal"
              >
                <Wifi size={18} strokeWidth={2} />
                {lastAffectedVerification != null &&
                (lastAffectedVerification.stillOffline > 0 || lastAffectedVerification.stillDegraded > 0) ? (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white ring-2 ring-white">
                    !
                  </span>
                ) : null}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest text-on-surface-variant shadow-sm transition hover:border-amber-300/80 hover:text-amber-900 dark:hover:text-amber-200"
            title="Ver descrição do protocolo"
            aria-label="Ver descrição do protocolo"
          >
            <Eye size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'flex items-start gap-2.5 border-b border-neutral-100 dark:border-white/5 px-3 py-2.5',
          apKnown || splitterKnown
            ? 'bg-sky-50/40 dark:bg-sky-950/40'
            : 'bg-amber-50/35 dark:bg-amber-950/40',
        )}
      >
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
            apKnown || splitterKnown
              ? 'bg-surface-container-lowest text-sky-700 dark:text-sky-200 ring-sky-200/70 dark:ring-sky-800/50'
              : 'bg-surface-container-lowest text-amber-800 dark:text-amber-200 ring-amber-200/70 dark:ring-amber-800/50',
          )}
        >
          <Network size={16} aria-hidden />
        </div>
        <div className="min-w-0 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Ponto de acesso
          </p>
          <p
            className={cn(
              'mt-0.5 font-medium leading-snug',
              apKnown || splitterKnown ? 'text-on-surface' : 'text-amber-900/90 dark:text-amber-200',
            )}
          >
            {apKnown ? (
              <span className="font-mono">{ticket.apCode}</span>
            ) : (
              'Ponto de acesso não informado'
            )}
          </p>
          {splitterKnown ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              Splitter:{' '}
              <span className="font-mono font-medium text-on-surface">{ticket.splitterCode}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-[72px] flex-nowrap items-center justify-between gap-2.5 border-b border-amber-100/80 bg-gradient-to-r from-amber-50/90 dark:from-amber-950/20 via-amber-50/50 dark:via-amber-950/20 to-amber-100/30 dark:to-amber-950/25 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 ring-1 ring-amber-200/60 dark:ring-amber-800/50">
            <Users size={18} aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80 dark:text-amber-200">
              Clientes afetados
            </p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-on-surface">
              {ticket.affectedClients}
            </p>
          </div>
        </div>
        {ticket.affectedClients > 0 ? (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-amber-300/80 bg-surface-container-lowest/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200 shadow-sm">
            Impactados
          </span>
        ) : (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Sem impacto mapeado
          </span>
        )}
      </div>

      <div className="grid gap-2.5 bg-surface-container-low/50 p-3 sm:grid-cols-2">
        <div className="flex gap-2.5 text-xs">
          <Clock className="mt-0.5 size-4 shrink-0 text-on-surface-variant/60" aria-hidden />
          <div>
            <p className="font-semibold text-on-surface-variant">Abertura</p>
            <p className="mt-0.5 font-medium text-on-surface">
              {formatMassivaListDateDisplay(ticket.openedAt)}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 gap-2.5 text-xs">
          <Calendar className="mt-0.5 size-4 shrink-0 text-on-surface-variant/60" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-on-surface-variant">
              {ticket.status === 'encerrada' && ticket.closedAt !== null
                ? 'Encerrado em'
                : 'Previsão de encerramento'}
            </p>
            {editingExpectedClose && canEditExpectedClose ? (
              <div className="mt-1.5 space-y-2">
                <input
                  type="datetime-local"
                  value={expectedCloseDraft}
                  step={60}
                  onChange={(e) =>
                    setExpectedCloseDraft(normalizeDateTimeLocalString(e.target.value))
                  }
                  className="w-full min-w-0 max-w-full rounded-lg border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface shadow-sm focus:border-amber-500/80 focus:outline-none focus:ring-1 focus:ring-amber-500/25"
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
                    className="rounded-lg border border-neutral-200 dark:border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
                {updatePrevisaoMutation.isError ? (
                  <p className="whitespace-pre-wrap break-words text-[11px] leading-snug text-red-700 dark:text-red-200">
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
                <p className="min-w-0 font-medium leading-snug text-on-surface sm:flex-1 sm:pr-1">
                  {expectedCloseDisplayForCard(ticket)}
                </p>
                {canEditExpectedClose ? (
                  <button
                    type="button"
                    onClick={() => {
                      setExpectedCloseDraft(defaultDraftExpectedClose(ticket))
                      setEditingExpectedClose(true)
                    }}
                    className="inline-flex w-fit shrink-0 items-center gap-1 self-end rounded-lg border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest px-2 py-1 text-[10px] font-semibold text-on-surface-variant shadow-sm transition hover:border-amber-300/80 hover:bg-amber-50/50 dark:hover:bg-amber-950/40 hover:text-amber-900 dark:hover:text-amber-200 sm:self-auto"
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
          <Users className="mt-0.5 size-4 shrink-0 text-on-surface-variant/60" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-on-surface-variant">Equipe</p>
            <p className="mt-0.5 break-words font-medium text-on-surface">
              {displayOrDash(ticket.team)}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 text-xs">
          <UserPlus className="mt-0.5 size-4 shrink-0 text-on-surface-variant/60" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-on-surface-variant">Solicitado por</p>
            <p className="mt-0.5 break-words font-medium text-on-surface">
              {displayOrDash(ticket.createdBy)}
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 text-xs">
          <IdCard className="mt-0.5 size-4 shrink-0 text-on-surface-variant/60" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-on-surface-variant">Responsável</p>
            <p className="mt-0.5 break-words font-medium text-on-surface">
              {displayOrDash(ticket.responsible)}
            </p>
          </div>
        </div>
        {ticket.assignmentId !== null ? (
          <p className="text-[10px] text-on-surface-variant/60 sm:col-span-2">
            Assignment (atendimento):{' '}
            <span className="font-mono font-medium text-on-surface-variant">{ticket.assignmentId}</span>
          </p>
        ) : null}
        <div className="pt-0.5 sm:col-span-2">
          <div className="flex min-h-[34px] flex-wrap items-center justify-center gap-2">
            {displayStatus === 'aberta' ? (
              <>
                <button
                  type="button"
                  disabled={!closeConfigured}
                  onClick={() => onRequestClose(ticket.protocol)}
                  className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-gradient-to-b from-amber-500 to-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-amber-500/20 transition hover:from-amber-500 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  Encerrar massiva
                </button>
                <button
                  type="button"
                  disabled={!closeConfigured}
                  onClick={() => onRequestCancel(ticket.protocol)}
                  className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-surface-container-lowest px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              </>
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
      {affectedVerifyOpen ? (
        <AffectedVerificationDialog
          ticket={ticket}
          lastAffectedVerification={lastAffectedVerification}
          verifiedByLabel={verifiedByLabel}
          onClose={() => setAffectedVerifyOpen(false)}
        />
      ) : null}
    </article>
  )
}
