import type { MassivaLocalPreviewViewState } from '@/features/massiva/model/massivaLocalPreview'
import { massivaClientDedupeKey } from '@/features/massiva/lib/massivaClientDedupeKey'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type MassivaLocalPreviewResultProps = {
  view: MassivaLocalPreviewViewState
  onRetryConnections: () => void
  previewDebug: {
    apForConnections: string | null
    connectionsCount: number
    selectedSplitterCodes: string[]
    matchedBySelectedSplitters: number
    selectedAps: string[]
    mergedAfterTopologyFilters: number
  }
}

export function MassivaLocalPreviewResult({
  view,
  onRetryConnections,
  previewDebug,
}: MassivaLocalPreviewResultProps) {
  if (view.status === 'connections-loading') {
    return <LoadingState label="Carregando conexões..." />
  }

  if (view.status === 'connections-error') {
    return (
      <ErrorState
        title="Erro ao carregar conexões"
        message={formatQueryError(view.error)}
        onRetry={onRetryConnections}
      />
    )
  }

  if (view.status === 'incomplete') {
    return (
      <div className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-amber-50/30 px-4 py-3 text-center shadow-sm ring-1 ring-amber-100/60">
        <p className="text-sm font-semibold text-amber-950">Seleção incompleta</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/85">{view.message}</p>
      </div>
    )
  }

  if (view.status === 'empty-selection') {
    return (
      <div className="space-y-2">
        <div
          className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 shadow-sm"
          role="status"
        >
          <p className="font-semibold text-amber-950">Nenhum cliente afetado nesta rota</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-amber-900/88">
            Clientes únicos: {view.totals.totalAffected} · PPPoEs: {view.totals.totalPppoes} ·
            Corporativos: {view.totals.totalCorporateAffected}
          </p>
        </div>
        {import.meta.env.DEV ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-[11px] text-neutral-700">
            <p className="font-semibold text-neutral-800">Diagnóstico (dev)</p>
            <p className="mt-1">
              AP consultado: <code>{previewDebug.apForConnections ?? '—'}</code>
            </p>
            <p>
              Conexões recebidas: <code>{previewDebug.connectionsCount}</code>
            </p>
            <p>
              Splitters selecionados: <code>{previewDebug.selectedSplitterCodes.join(', ') || 'todos'}</code>
            </p>
            <p>
              Match por splitter: <code>{previewDebug.matchedBySelectedSplitters}</code>
            </p>
            <p>
              APs efetivos: <code>{previewDebug.selectedAps.join(', ') || 'nenhum'}</code>
            </p>
            <p>
              Após filtros de topologia: <code>{previewDebug.mergedAfterTopologyFilters}</code>
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white px-3 py-3 shadow-sm ring-1 ring-emerald-100/50">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700/90">
            Clientes
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-emerald-950">
            {view.totals.totalAffected}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50 to-white px-3 py-3 shadow-sm ring-1 ring-violet-100/50">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700/90">
            PPPoEs
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-violet-950">
            {view.totals.totalPppoes}
          </p>
        </div>
        <div className="col-span-2 min-w-0 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white px-3 py-3 shadow-sm ring-1 ring-amber-100/60 sm:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800/90">
            Corporativos
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-amber-950">
            {view.totals.totalCorporateAffected}
          </p>
        </div>
      </div>

      {view.sampleClientes.length > 0 ? (
        <div className="max-h-[min(220px,30vh)] overflow-auto rounded-xl border border-neutral-200/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <table className="w-full min-w-[400px] text-left text-xs">
            <caption className="sr-only">
              Amostra de clientes no preview (máximo 12 linhas)
            </caption>
            <thead className="sticky top-0 z-[1] bg-neutral-50/95 backdrop-blur-sm">
              <tr className="border-b border-neutral-200/90">
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Nome
                </th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  PPPoE
                </th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Splitter
                </th>
              </tr>
            </thead>
            <tbody>
              {view.sampleClientes.map((c) => (
                <tr
                  key={massivaClientDedupeKey(c)}
                  className="border-b border-neutral-100/90 odd:bg-neutral-50/40 last:border-0"
                >
                  <td className="max-w-[9rem] truncate px-3 py-2 text-[13px] text-neutral-900">
                    {c.name.trim() !== '' ? c.name : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-700">
                    {c.user.trim() !== '' ? c.user : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-600">
                    {c.splitterCode ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
