import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { closeMassivaTicket } from '@/features/massiva/api/closeMassivaTicket'
import { useMassivaTickets } from '@/features/massiva/hooks/useMassivaTickets'
import {
  formatMassivaListDateDisplay,
  formatPrevisaoEncerramentoDisplay,
} from '@/features/massiva/lib/formatMassivaListDate'
import {
  formatMassivaStatusLabel,
  type MassivaStatus,
  type MassivaTicket,
} from '@/features/massiva/model/massivaTicket'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { env } from '@/shared/config/env'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { Download, RefreshCw } from 'lucide-react'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { MassivaTicketCard } from '@/features/massiva/ui/MassivaTicketCard'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/** Texto de encerramento não pode ser vazio; mínimo curto para não bloquear descrições objetivas. */
const CLOSE_DESCRIPTION_MIN_LEN = 3

function ticketKey(t: MassivaTicket, index: number): string {
  return `${t.protocol}-${t.assignmentId ?? 'x'}-${index}`
}

type ImpactRange = 'all' | 'none' | 'low' | 'medium' | 'high'

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function matchesImpactRange(ticket: MassivaTicket, range: ImpactRange): boolean {
  const affected = ticket.affectedClients
  if (range === 'all') return true
  if (range === 'none') return affected <= 0
  if (range === 'low') return affected > 0 && affected <= 100
  if (range === 'medium') return affected > 100 && affected <= 500
  return affected > 500
}

function escapeCsvCell(value: string): string {
  const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n')
  const escaped = value.replaceAll('"', '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function buildMassivasCsv(rows: MassivaTicket[]): string {
  const header = [
    'protocolo',
    'assignment_id',
    'status',
    'abertura',
    'previsao_encerramento',
    'ap',
    'splitter',
    'afetados',
    'equipe',
    'solicitado_por',
    'responsavel',
    'descricao',
  ]
  const lines = rows.map((row) => [
    String(row.protocol > 0 ? row.protocol : ''),
    row.assignmentId !== null ? String(row.assignmentId) : '',
    formatMassivaStatusLabel(row.status),
    formatMassivaListDateDisplay(row.openedAt),
    formatPrevisaoEncerramentoDisplay(
      row.expectedCloseAt,
      row.estimateTimeOfRestoration,
    ),
    row.apCode,
    row.splitterCode,
    String(row.affectedClients),
    row.team,
    row.createdBy,
    row.responsible,
    row.description.trim() || row.title,
  ].map(escapeCsvCell).join(','))
  return [header.join(','), ...lines].join('\n')
}

export type MassivaTicketsSectionLayout = 'default' | 'embedded'

type MassivaTicketsSectionProps = {
  /** `embedded`: sem borda dupla; cabeçalho da lista fica no painel pai; rolagem vertical = página (só overflow-x na tabela se necessário). */
  layout?: MassivaTicketsSectionLayout
}

export function MassivaTicketsSection({
  layout = 'default',
}: MassivaTicketsSectionProps) {
  const embedded = layout === 'embedded'
  const { view, refetch, isRefreshing } = useMassivaTickets()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | MassivaStatus>('all')
  const [impactRange, setImpactRange] = useState<ImpactRange>('all')
  const [csvCopied, setCsvCopied] = useState(false)
  const [closingProtocol, setClosingProtocol] = useState<number | null>(null)
  const [closeDescription, setCloseDescription] = useState('')
  const selectedClosingTicket = useMemo(
    () => view.status === 'success'
      ? view.tickets.find((t) => t.protocol === closingProtocol) ?? null
      : null,
    [view, closingProtocol],
  )

  const closeConfigured = env.massivaClosePath.trim() !== ''

  const closeMutation = useMutation({
    mutationFn: closeMassivaTicket,
    onSuccess: async () => {
      setClosingProtocol(null)
      setCloseDescription('')
      await queryClient.invalidateQueries({ queryKey: massivaKeys.list() })
      await queryClient.invalidateQueries({ queryKey: splittersKeys.all })
    },
  })

  const tickets = useMemo<MassivaTicket[]>(
    () => (view.status === 'success' ? view.tickets : []),
    [view],
  )

  const filteredTickets = useMemo(() => {
    const text = normalizeText(query)
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false
      if (!matchesImpactRange(ticket, impactRange)) return false
      if (text === '') return true
      const haystack = normalizeText(
        [
          ticket.title,
          ticket.apCode,
          ticket.splitterCode,
          ticket.createdBy,
          ticket.responsible,
          String(ticket.protocol),
        ].join(' '),
      )
      return haystack.includes(text)
    })
  }, [tickets, query, statusFilter, impactRange])

  const handleExportCsv = async () => {
    const csv = buildMassivasCsv(filteredTickets)
    try {
      await navigator.clipboard.writeText(csv)
      setCsvCopied(true)
      setTimeout(() => setCsvCopied(false), 1500)
    } catch {
      setCsvCopied(false)
    }
  }

  if (view.status === 'not-configured') {
    return (
      <div className={embedded ? 'p-4' : ''}>
        <EmptyState
          title="Listagem não configurada"
          description="Defina VITE_MASSIVA_LIST_PATH no .env com o path do BFF (ex.: /api/v1/massivas/list), alinhado ao endpoint de listagem no backend."
        />
      </div>
    )
  }

  if (view.status === 'loading') {
    return (
      <div className={embedded ? 'p-6' : ''}>
        <LoadingState label="Carregando massivas..." />
      </div>
    )
  }

  if (view.status === 'error') {
    return (
      <div className={embedded ? 'p-4' : ''}>
        <ErrorState
          title="Não foi possível carregar as massivas"
          message={formatQueryError(view.error)}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  if (view.status === 'empty') {
    return (
      <div className={embedded ? 'p-4' : ''}>
        <EmptyState
          title="Nenhuma massiva"
          description="A listagem está vazia no momento."
        />
      </div>
    )
  }

  const shellClass = embedded
    ? 'flex flex-col bg-white'
    : 'overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm'

  return (
    <section
      className={shellClass}
      aria-labelledby="massiva-tickets-heading"
    >
      <h2
        id="massiva-tickets-heading"
        className={
          embedded
            ? 'sr-only'
            : 'border-b border-neutral-200 px-4 py-3 text-base font-bold text-neutral-900'
        }
      >
        Massivas
      </h2>
      <div
        className={`shrink-0 border-b border-neutral-200/80 bg-gradient-to-b from-neutral-50/90 to-neutral-50/40 ${embedded ? 'px-3 py-3' : 'px-4 py-3'}`}
      >
        <div
          className={
            embedded
              ? 'grid grid-cols-2 gap-2'
              : 'grid gap-3 md:grid-cols-4'
          }
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar…"
            className={`rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition placeholder:text-neutral-400 focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15 ${embedded ? 'col-span-2' : 'md:col-span-2'}`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | MassivaStatus)}
            className="rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
          >
            <option value="all">Todos os status</option>
            <option value="aberta">Abertas</option>
            <option value="encerrada">Encerradas</option>
            <option value="desconhecida">Desconhecida</option>
          </select>
          <select
            value={impactRange}
            onChange={(e) => setImpactRange(e.target.value as ImpactRange)}
            className="rounded-xl border border-neutral-200/90 bg-white px-3 py-2 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/80 focus:outline-none focus:ring-2 focus:ring-amber-500/15"
          >
            <option value="all">Impacto: todos</option>
            <option value="none">Sem afetados</option>
            <option value="low">1 a 100</option>
            <option value="medium">101 a 500</option>
            <option value="high">Acima de 500</option>
          </select>
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? 'mt-2' : 'mt-3'}`}>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/25"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/25"
          >
            <Download size={13} />
            CSV
          </button>
          <span className="text-[11px] text-neutral-500">
            {filteredTickets.length}/{view.tickets.length}
          </span>
          {csvCopied ? (
            <span className="text-[11px] font-semibold text-emerald-700">
              CSV copiado
            </span>
          ) : null}
        </div>
        {!closeConfigured ? (
          <p className={`text-[11px] font-medium text-amber-800 ${embedded ? 'mt-2' : 'mt-3'}`}>
            Encerramento desabilitado: defina{' '}
            <code className="rounded bg-amber-100 px-1">VITE_MASSIVA_CLOSE_PATH</code> no build (ex.{' '}
            <code className="rounded bg-amber-100 px-1">/api/v1/massivas/finalizar-chamado-via-api</code>
            ).
          </p>
        ) : null}
      </div>
      <div
        className={
          embedded
            ? 'border-t border-neutral-100/80 bg-gradient-to-b from-neutral-50/30 to-white px-1 py-4 sm:px-2'
            : 'border-t border-neutral-100/80 bg-neutral-50/20 px-4 py-5'
        }
      >
        {filteredTickets.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            Nenhuma massiva corresponde aos filtros aplicados.
          </p>
        ) : (
          <ul className="flex w-full flex-col gap-4">
            {filteredTickets.map((t, i) => (
              <li key={ticketKey(t, i)}>
                <MassivaTicketCard
                  ticket={t}
                  closeConfigured={closeConfigured}
                  onRequestClose={(protocol) => {
                    setClosingProtocol(protocol)
                    setCloseDescription('')
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedClosingTicket !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-neutral-900">Encerrar massiva</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Protocolo <span className="font-mono font-semibold">{selectedClosingTicket.protocol}</span>
              {selectedClosingTicket.assignmentId !== null
                ? (
                  <>
                    {' e Assignment '}
                    <span className="font-mono font-semibold">{selectedClosingTicket.assignmentId}</span>
                  </>
                )
                : null}
            </p>

            {selectedClosingTicket.assignmentId === null ? (
              <p className="mt-3 text-sm text-red-700">
                Não é possível encerrar sem o identificador do atendimento (assignment) neste
                protocolo. A listagem do BFF precisa expor esse campo (ex.:{' '}
                <code className="text-[11px]">assignmentId</code>,{' '}
                <code className="text-[11px]">assignment_id</code> ou{' '}
                <code className="text-[11px]">input.assignment.id</code>
                ).
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-semibold text-neutral-700">
                  Descrição de encerramento
                </label>
                <textarea
                  value={closeDescription}
                  onChange={(e) => setCloseDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                  placeholder="Informe a descrição final do encerramento…"
                />
                <p className="text-[11px] text-neutral-500">
                  Mínimo de {CLOSE_DESCRIPTION_MIN_LEN} caracteres (
                  {closeDescription.trim().length}/{CLOSE_DESCRIPTION_MIN_LEN}).
                </p>
                {closeMutation.isError ? (
                  <p className="text-xs text-red-700">
                    {formatQueryError(closeMutation.error)}
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700"
                onClick={() => {
                  setClosingProtocol(null)
                  setCloseDescription('')
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                disabled={
                  !closeConfigured ||
                  closeMutation.isPending ||
                  closeDescription.trim().length < CLOSE_DESCRIPTION_MIN_LEN ||
                  selectedClosingTicket.assignmentId === null
                }
                onClick={() => {
                  if (selectedClosingTicket.assignmentId === null) return
                  void closeMutation.mutateAsync({
                    assignmentId: selectedClosingTicket.assignmentId,
                    protocol: selectedClosingTicket.protocol,
                    closeDescription: closeDescription.trim(),
                  })
                }}
              >
                {closeMutation.isPending ? 'Encerrando...' : 'Confirmar encerramento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
