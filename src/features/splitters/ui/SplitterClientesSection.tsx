import { useState } from 'react'
import { useSplitterClientes } from '@/features/splitters/hooks/useSplitterClientes'
import { useSplitterGeoGridComparison } from '@/features/splitters/hooks/useSplitterGeoGridComparison'
import { useSplitterGeoGrid } from '@/features/splitters/hooks/useSplitterGeoGrid'
import { SplitterClientesList } from '@/features/splitters/ui/SplitterClientesList'
import { SplitterGeoGridComparisonPanel } from '@/features/splitters/ui/SplitterGeoGridComparisonPanel'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import { GitCompareArrows } from 'lucide-react'

type SplitterClientesSectionProps = {
  splitterCode: string
  splitterTitle?: string | null
  capacity: number
  integrationCode?: string | null
}

export function SplitterClientesSection({
  splitterCode,
  splitterTitle,
  capacity,
  integrationCode,
}: SplitterClientesSectionProps) {
  const [comparisonRequested, setComparisonRequested] = useState(false)
  const { data, isPending, isError, error, refetch } =
    useSplitterClientes(splitterCode)
  const clientes = data?.clientes ?? []
  const portStates = data?.portStates ?? []
  const { state: geogridState } = useSplitterGeoGrid(integrationCode)
  const { state: comparisonState, refetch: refetchComparison } =
    useSplitterGeoGridComparison(
      splitterCode,
      splitterTitle,
      clientes,
      comparisonRequested,
    )

  if (isPending) {
    return <LoadingState label="Carregando clientes…" />
  }

  if (isError) {
    return (
      <ErrorState
        message={formatQueryError(error)}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  const geogridRows = geogridState.type === 'success' ? geogridState.rows : []
  const canValidate = comparisonState.type !== 'disabled' && comparisonState.type !== 'not-configured'
  const buttonLabel =
    comparisonState.type === 'loading'
      ? 'Validando portas no GeoGrid…'
      : 'Validar portas no GeoGrid'

  return (
    <div className="space-y-5">
      <SplitterClientesList
        clientes={clientes}
        capacity={capacity}
        geogridRows={geogridRows}
        portStates={portStates}
      />

      {geogridState.type === 'error' ? (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 shadow-sm">
          As reservas do GeoGrid não puderam ser carregadas agora. Os cards seguem aparecendo,
          mas sem o destaque de reserva até a próxima tentativa.
        </div>
      ) : null}

      <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
              <GitCompareArrows size={18} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                Conferência
              </p>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-on-surface">
                Validar portas no GeoGrid
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/70">
                Compara as portas do splitter com os atendimentos retornados pela GeoGrid usando os nomes dos clientes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setComparisonRequested(true)}
            disabled={!canValidate || comparisonState.type === 'loading'}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-white/15"
          >
            {buttonLabel}
          </button>
        </div>

        {comparisonState.type === 'not-configured' ? (
          <p className="mt-4 text-sm text-on-surface-variant/75">
            GeoGrid não configurado no ambiente atual.
          </p>
        ) : null}

        {comparisonState.type === 'disabled' ? (
          <p className="mt-4 text-sm text-on-surface-variant/75">
            Não há clientes suficientes neste splitter para rodar a validação.
          </p>
        ) : null}

        {comparisonState.type === 'idle' ? (
          <p className="mt-4 text-sm text-on-surface-variant/75">
            A validação só roda quando você clicar no botão acima.
          </p>
        ) : null}

        {comparisonState.type === 'loading' ? (
          <div className="mt-4">
            <LoadingState label="Conferindo portas no GeoGrid…" />
          </div>
        ) : null}

        {comparisonState.type === 'error' ? (
          <div className="mt-4">
            <ErrorState
              title="Não foi possível validar portas no GeoGrid"
              message={formatQueryError(comparisonState.error)}
              onRetry={() => refetchComparison()}
            />
          </div>
        ) : null}

        {comparisonState.type === 'empty' ? (
          <p className="mt-4 text-sm text-on-surface-variant/75">
            Nenhum resultado foi retornado para esta validação.
          </p>
        ) : null}

        {comparisonState.type === 'success' ? (
          <div className="mt-4">
            <SplitterGeoGridComparisonPanel rows={comparisonState.rows} />
          </div>
        ) : null}
      </section>
    </div>
  )
}


