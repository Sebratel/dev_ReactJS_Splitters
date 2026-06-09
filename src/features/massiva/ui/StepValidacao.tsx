import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  ListFilter,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldAlert,
} from 'lucide-react'
import {
  formatMassivaClienteLocationLine,
  hasMassivaClienteMapCoords,
} from '@/features/massiva/lib/formatMassivaClienteLocation'
import { massivaClientDedupeKey } from '@/features/massiva/lib/massivaClientDedupeKey'
import { OLT_PON_LABEL, OLT_SLOT_LABEL } from '@/shared/lib/oltTopologyLabels'
import { MassivaClientesMapPreview } from '@/features/massiva/ui/MassivaClientesMapPreview'
import type { MassivaOpeningPreparationView } from '@/features/massiva/model/massivaOpeningBasis'
import type { MassivaLocalPreviewViewState } from '@/features/massiva/model/massivaLocalPreview'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type StepValidacaoProps = {
  view: MassivaLocalPreviewViewState
  openingPreparation: MassivaOpeningPreparationView
  onRetryConnections: () => void
}

const EXPANDED_PAGE_SIZE = 200
const MASSIVA_VALIDATION_UI_STATE_KEY = 'nexaview.massiva.validation.ui.v1'

const t = {
  validacao: 'Valida\u00e7\u00e3o',
  validacaoPronta: 'Valida\u00e7\u00e3o pronta',
  validacaoPendente: 'Valida\u00e7\u00e3o pendente',
  atencaoSelecao: 'Aten\u00e7\u00e3o na sele\u00e7\u00e3o',
  rotaValidaSemClientes:
    'A rota est\u00e1 v\u00e1lida, mas n\u00e3o houve clientes afetados com a sele\u00e7\u00e3o atual.',
  falhaValidacao: 'Falha na valida\u00e7\u00e3o',
  erroConexoes: 'Erro ao validar conex\u00f5es',
  previewVazio: 'Nenhuma linha de preview dispon\u00edvel para a sele\u00e7\u00e3o atual.',
  cardCorporativos: 'Clientes corporativos',
} as const

function ValidationTone({
  view,
  openingPreparation,
}: Pick<StepValidacaoProps, 'view' | 'openingPreparation'>) {
  if (view.status === 'success' && openingPreparation.status === 'prepared') {
    return {
      icon: <CheckCircle2 size={18} aria-hidden />,
      title: t.validacaoPronta,
      text: 'Clientes e topologia consistentes para seguir para a abertura.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    }
  }
  if (view.status === 'empty-selection' || openingPreparation.status === 'invalid') {
    return {
      icon: <AlertTriangle size={18} aria-hidden />,
      title: t.atencaoSelecao,
      text:
        openingPreparation.status === 'invalid'
          ? openingPreparation.issues.join(' ')
          : t.rotaValidaSemClientes,
      className: 'border-amber-200 bg-amber-50 text-amber-950',
    }
  }
  return {
    icon: <ShieldAlert size={18} aria-hidden />,
    title: t.validacaoPendente,
    text: 'Complete rota e splitters para revisar os dados de impacto.',
    className: 'border-red-200 bg-red-50 text-red-950',
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const a = parts[0][0] ?? ''
  const b = parts[parts.length - 1][0] ?? ''
  return `${a}${b}`.toUpperCase()
}

function ClienteNameCell({
  cliente,
  wide,
}: {
  cliente: SplitterCliente
  wide?: boolean
}) {
  const name = cliente.name?.trim() || '?'
  return (
    <td className={clsx('px-3 py-2', wide && 'min-w-[14rem]')}>
      <span
        className={clsx(
          'inline-flex min-w-0 items-center gap-2.5',
          wide ? 'max-w-[22rem]' : 'max-w-[16rem] sm:max-w-[20rem]',
        )}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200/90 text-[11px] font-bold uppercase text-slate-700 shadow-sm ring-2 ring-white"
          aria-hidden
        >
          {initialsFromName(name === '?' ? '' : name)}
        </span>
        <span className="min-w-0 truncate font-medium text-neutral-900">{name}</span>
      </span>
    </td>
  )
}

function ClienteStatusPill({ cliente }: { cliente: SplitterCliente }) {
  if (cliente.isCorporate) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 ring-1 ring-red-200/90">
        Prioridade
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/90">
      Ativo
    </span>
  )
}

function filterClientesByQuery(
  clientes: readonly SplitterCliente[],
  query: string,
  splitterLabel: (c: SplitterCliente) => string,
): SplitterCliente[] {
  const q = query.trim().toLowerCase()
  if (q === '') return [...clientes]
  return clientes.filter((c) => {
    const name = (c.name || '').toLowerCase()
    const user = (c.user || '').toLowerCase()
    const sp = splitterLabel(c).toLowerCase()
    return name.includes(q) || user.includes(q) || sp.includes(q)
  })
}

function LocalCell({
  cliente,
  narrow,
  wide,
}: {
  cliente: SplitterCliente
  narrow?: boolean
  wide?: boolean
}) {
  const line = formatMassivaClienteLocationLine(cliente)
  const onMap = hasMassivaClienteMapCoords(cliente)
  const maxW = narrow ? 'max-w-[14rem]' : wide ? 'max-w-[32rem]' : 'max-w-[16rem]'
  return (
    <td
      className={clsx(maxW, 'px-3 py-2 text-xs text-neutral-600', wide && 'min-w-[20rem]')}
      title={line}
    >
      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
        <span
          className={clsx(
            'h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-white',
            onMap
              ? cliente.isCorporate
                ? 'bg-amber-500 shadow-sm'
                : 'bg-sky-500 shadow-sm'
              : 'bg-neutral-200',
          )}
          title={
            onMap
              ? cliente.isCorporate
                ? 'Com coordenadas (corporativo no mapa)'
                : 'Com coordenadas no mapa'
              : 'Apenas endere\u00e7o em texto (sem pin)'
          }
        />
        <span className="min-w-0 truncate text-neutral-700">{line}</span>
      </span>
    </td>
  )
}

function splitterDisplayName(cliente: SplitterCliente): string {
  const title = cliente.splitterTitle?.trim() ?? ''
  if (title !== '') return title
  const code = cliente.splitterCode?.trim() ?? ''
  return code !== '' ? code : '-'
}

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function buildClientesCsv(clientes: readonly SplitterCliente[]): string {
  const header = ['Cliente', 'PPPoE', 'Splitter', 'Local', 'Status']
  const rows = clientes.map((cliente) => [
    cliente.name || '-',
    cliente.user || '-',
    splitterDisplayName(cliente),
    formatMassivaClienteLocationLine(cliente),
    cliente.isCorporate ? 'Prioridade' : 'Ativo',
  ])
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.setAttribute('download', filename)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function readMassivaValidationUiState(): { clienteFilterQuery: string } {
  if (typeof window === 'undefined') {
    return { clienteFilterQuery: '' }
  }

  try {
    const raw = window.sessionStorage.getItem(MASSIVA_VALIDATION_UI_STATE_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Partial<{ clienteFilterQuery: string }>
    return {
      clienteFilterQuery:
        typeof parsed.clienteFilterQuery === 'string' ? parsed.clienteFilterQuery : '',
    }
  } catch {
    return { clienteFilterQuery: '' }
  }
}

export function StepValidacao({
  view,
  openingPreparation,
  onRetryConnections,
}: StepValidacaoProps) {
  const [validationUiState, setValidationUiState] = useState(readMassivaValidationUiState)
  const [isExpandedOpen, setExpandedOpen] = useState(false)
  const [mapFullscreenOpen, setMapFullscreenOpen] = useState(false)
  const [expandedVisibleCount, setExpandedVisibleCount] = useState(EXPANDED_PAGE_SIZE)
  const { clienteFilterQuery } = validationUiState

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(
      MASSIVA_VALIDATION_UI_STATE_KEY,
      JSON.stringify(validationUiState),
    )
  }, [validationUiState])

  const sampleClientes = useMemo(
    () => (view.status === 'success' ? view.sampleClientes : []),
    [view],
  )
  const totals = useMemo(
    () =>
      view.status === 'success' || view.status === 'empty-selection' ? view.totals : null,
    [view],
  )
  const fullClientes = useMemo((): readonly SplitterCliente[] => {
    if (openingPreparation.status === 'prepared') {
      return openingPreparation.basis.collectedClientes
    }
    return sampleClientes
  }, [openingPreparation, sampleClientes])

  const filteredSampleClientes = useMemo(
    () => filterClientesByQuery(sampleClientes, clienteFilterQuery, splitterDisplayName),
    [sampleClientes, clienteFilterQuery],
  )

  const tableSampleRows = useMemo(
    () => filteredSampleClientes.slice(0, 8),
    [filteredSampleClientes],
  )

  if (view.status === 'connections-loading') {
    return <LoadingState label="Validando rota e afetados..." />
  }

  if (openingPreparation.status === 'unavailable') {
    if (openingPreparation.reason === 'connections-loading') {
      return <LoadingState label="Validando rota e afetados..." />
    }

    return (
      <ErrorState
        title={t.falhaValidacao}
        message={formatQueryError(openingPreparation.error)}
        onRetry={onRetryConnections}
      />
    )
  }

  if (view.status === 'connections-error') {
    return (
      <ErrorState
        title={t.erroConexoes}
        message={formatQueryError(view.error)}
        onRetry={onRetryConnections}
      />
    )
  }

  const tone = ValidationTone({ view, openingPreparation })

  const openExpanded = () => {
    setExpandedVisibleCount(EXPANDED_PAGE_SIZE)
    setExpandedOpen(true)
  }

  const exportClientes = () => {
    if (fullClientes.length === 0) return
    const csv = buildClientesCsv(fullClientes)
    downloadCsv(`massiva-clientes-${Date.now()}.csv`, csv)
  }

  const isPrepared = openingPreparation.status === 'prepared'
  const totalCorp = totals?.totalCorporateAffected ?? 0
  const corporateCritical = totalCorp > 0

  return (
    <>
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-neutral-900">{t.validacao}</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Revise impacto, amostra de clientes e topologia antes de abrir a massiva.
          </p>
        </div>

        <div className={clsx('rounded-xl border px-4 py-3.5 shadow-sm', tone.className)}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5">{tone.icon}</span>
            <div>
              <p className="text-sm font-semibold tracking-tight">{tone.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed opacity-90">{tone.text}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/80">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
              Clientes afetados
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-3xl font-bold tabular-nums tracking-tight text-neutral-950">
                {totals?.totalAffected ?? 0}
              </p>
              {isPrepared && (totals?.totalAffected ?? 0) > 0 ? (
                <span className="text-xs font-semibold text-emerald-600">validado</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-white bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/80">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">PPPoEs</p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-neutral-950">
              {totals?.totalPppoes ?? 0}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-neutral-500">Total na amostra</p>
          </div>
          <div
            className={clsx(
              'relative overflow-hidden rounded-xl border px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:col-span-2 lg:col-span-1',
              corporateCritical
                ? 'border-l-[5px] border-l-red-500 border-t border-r border-b border-red-200/60 bg-gradient-to-br from-red-50/90 to-red-50/50 ring-1 ring-red-200/50'
                : 'border-white bg-amber-50/40 ring-1 ring-amber-200/50',
            )}
          >
            {corporateCritical ? (
              <AlertCircle
                className="absolute right-3 top-3 h-4 w-4 text-red-500"
                strokeWidth={2.25}
                aria-hidden
              />
            ) : null}
            <p
              className={clsx(
                'pr-8 text-[10px] font-bold uppercase tracking-[0.2em]',
                corporateCritical ? 'text-red-800/90' : 'text-amber-800/90',
              )}
            >
              {t.cardCorporativos}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <p
                className={clsx(
                  'text-3xl font-bold tabular-nums tracking-tight',
                  corporateCritical ? 'text-red-600' : 'text-amber-950',
                )}
              >
                {totalCorp}
              </p>
              {corporateCritical ? (
                <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800 ring-1 ring-red-200/80">
                  {'Cr\u00edtico'}
                </span>
              ) : null}
            </div>
            <p
              className={clsx(
                'mt-1.5 text-[11px] leading-snug',
                corporateCritical ? 'text-red-900/75' : 'text-amber-900/80',
              )}
            >
              PJ / contrato empresarial no impacto.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="overflow-hidden rounded-xl border border-white bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-neutral-200/70">
            <div className="flex flex-col gap-3 border-b border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <h4 className="text-lg font-semibold tracking-tight text-neutral-900">Clientes</h4>
              <div className="flex w-full flex-1 flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center sm:justify-end">
                <div className="relative w-full min-w-0 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={clienteFilterQuery}
                    onChange={(e) => setValidationUiState({ clienteFilterQuery: e.target.value })}
                    placeholder={'Buscar cliente, PPPoE ou splitter\u2026'}
                    className="w-full rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-sm text-neutral-800 shadow-sm ring-0 transition placeholder:text-neutral-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200/60"
                    aria-label="Filtrar clientes na tabela"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setValidationUiState({ clienteFilterQuery: '' })}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <ListFilter className="h-3.5 w-3.5" aria-hidden />
                  Limpar filtro
                </button>
              </div>
            </div>

            {sampleClientes.length > 0 ? (
              <div>
                <div className="max-h-[26rem] overflow-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="sticky top-0 z-[1] bg-white">
                      <tr className="border-b border-neutral-200/90">
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          Cliente
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          PPPoE
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          Splitter
                        </th>
                        <th className="max-w-[12rem] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                            Local
                          </span>
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                      {tableSampleRows.map((cliente) => (
                        <tr
                          key={massivaClientDedupeKey(cliente)}
                          className="transition hover:bg-neutral-50/80"
                        >
                          <ClienteNameCell cliente={cliente} />
                          <td className="px-3 py-2 font-mono text-[12px] text-neutral-800">
                            {cliente.user || '?'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[12px] text-neutral-700">
                            {splitterDisplayName(cliente)}
                          </td>
                          <LocalCell cliente={cliente} narrow />
                          <td className="px-3 py-2 text-right">
                            <ClienteStatusPill cliente={cliente} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tableSampleRows.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-500">
                    Nenhum cliente corresponde ao filtro.
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2 border-t border-neutral-200/80 bg-neutral-50/90 px-3 py-2.5 text-[11px] text-neutral-600">
                  <p>
                    Mostrando {tableSampleRows.length} de {fullClientes.length} registro(s) de rede
                    {clienteFilterQuery.trim() !== '' ? (
                      <span className="text-neutral-500"> ({filteredSampleClientes.length} com filtro)</span>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled
                      className="rounded-md p-1 text-neutral-300"
                      aria-label={'P\u00e1gina anterior'}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled
                      className="rounded-md p-1 text-neutral-300"
                      aria-label={'P\u00e1gina seguinte'}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={openExpanded}
                      className="ml-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-white"
                    >
                      Expandir lista
                    </button>
                  </div>
                </div>
                <p className="border-t border-neutral-100 px-3 py-2 text-[10px] leading-relaxed text-neutral-500">
                  <span className="font-medium text-neutral-600">Local:</span>{' '}
                  {`ponto alinhado ao mapa (azul / \u00e2mbar) ou cinza quando s\u00f3 h\u00e1 endere\u00e7o em texto.`}
                </p>
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">{t.previewVazio}</p>
            )}
          </section>

          <div className="flex min-h-0 flex-col gap-3">
            <section className="space-y-3 rounded-xl border border-white bg-white px-4 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-neutral-200/70">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200/80">
                  <GitBranch className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                  Topologia
                </p>
              </div>
              {openingPreparation.status === 'prepared' ? (
                <ol className="relative ml-1.5 max-h-[22rem] space-y-0 overflow-y-auto border-l-2 border-neutral-200 pl-5 pr-1">
                  {openingPreparation.basis.topology.routes.map((route) => (
                    <li
                      key={`${route.apCode}-${route.slot}-${route.port}`}
                      className="relative pb-6 last:pb-0"
                    >
                      <span className="absolute -left-[1.4rem] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-sky-500 shadow-sm ring-1 ring-sky-600/20" />
                      <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400">
                        {'N\u00f3 de rede'}
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold leading-snug text-neutral-900">
                        {route.apDisplayTitle.trim() || route.apCode}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {route.effectiveSplitterDisplay.length} splitter(s) nesta rota
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-md border border-neutral-200/80 bg-neutral-100 px-2 py-1 font-mono text-[11px] font-semibold text-neutral-800 shadow-sm">
                          {OLT_SLOT_LABEL} {route.slot}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-neutral-200/80 bg-neutral-100 px-2 py-1 font-mono text-[11px] font-semibold text-neutral-800 shadow-sm">
                          {OLT_PON_LABEL} {route.port}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-neutral-500">
                  A topologia aparece aqui quando a rota estiver consistente.
                </p>
              )}
            </section>

            {fullClientes.length > 0 ? (
              <section className="min-h-0 space-y-3 rounded-xl border border-white bg-white px-4 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-neutral-200/70">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                  {'Visualiza\u00e7\u00e3o do mapa'}
                </p>
                <p className="text-xs leading-relaxed text-neutral-500">
                  Pins agrupados por splitter a partir de latitude/longitude do BFF. A coluna{' '}
                  <span className="font-medium text-neutral-600">Local</span>{' '}
                  {`segue o endere\u00e7o em texto.`}
                </p>
                <MassivaClientesMapPreview clientes={fullClientes} mapChrome="dark" />
                <button
                  type="button"
                  onClick={() => setMapFullscreenOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  <MapIcon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  Abrir mapa completo
                </button>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      {isExpandedOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[92vh] w-[min(96vw,88rem)] max-w-none flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Clientes afetados</p>
                <p className="text-xs text-neutral-500">
                  Mostrando {Math.min(expandedVisibleCount, fullClientes.length)} de {fullClientes.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportClientes}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedOpen(false)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="overflow-auto px-4 py-3">
              <div className="overflow-hidden rounded-lg ring-1 ring-neutral-200/80">
                <table className="w-full min-w-[72rem] text-left text-sm">
                  <thead className="sticky top-0 z-[1] border-b border-neutral-200 bg-neutral-50">
                    <tr>
                      <th className="min-w-[14rem] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                        Cliente
                      </th>
                      <th className="min-w-[10rem] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                        PPPoE
                      </th>
                      <th className="min-w-[14rem] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                        Splitter
                      </th>
                      <th className="min-w-[20rem] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                          Local
                        </span>
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {fullClientes.slice(0, expandedVisibleCount).map((cliente) => (
                      <tr key={massivaClientDedupeKey(cliente)} className="hover:bg-neutral-50/60">
                        <ClienteNameCell cliente={cliente} wide />
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-neutral-800">
                          {cliente.user || '?'}
                        </td>
                        <td className="min-w-[14rem] px-3 py-2 font-mono text-[12px] leading-snug text-neutral-700">
                          {splitterDisplayName(cliente)}
                        </td>
                        <LocalCell cliente={cliente} wide />
                        <td className="px-3 py-2 text-right">
                          <ClienteStatusPill cliente={cliente} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {expandedVisibleCount < fullClientes.length ? (
              <div className="border-t border-neutral-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedVisibleCount((current) =>
                      Math.min(current + EXPANDED_PAGE_SIZE, fullClientes.length),
                    )
                  }
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Carregar mais {Math.min(EXPANDED_PAGE_SIZE, fullClientes.length - expandedVisibleCount)}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {mapFullscreenOpen && fullClientes.length > 0 ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={'Mapa de localiza\u00e7\u00e3o em tela cheia'}
          onClick={() => setMapFullscreenOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">
                {'Mapa de localiza\u00e7\u00e3o'}
              </p>
              <button
                type="button"
                onClick={() => setMapFullscreenOpen(false)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Fechar
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <MassivaClientesMapPreview
                clientes={fullClientes}
                density="expanded"
                mapChrome="dark"
                minimalChrome
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

