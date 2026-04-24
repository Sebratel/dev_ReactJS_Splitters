import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import type { MassivaOpeningPreparationView } from '@/features/massiva/model/massivaOpeningBasis'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type MassivaOpeningPreparationPanelProps = {
  preparation: MassivaOpeningPreparationView
  onRetryConnections: () => void
}

/**
 * Resumo somente leitura da rota e dos totais planejados.
 * A abertura real (POST no BFF) fica em {@link MassivaOpenReadinessSection}.
 */
export function MassivaOpeningPreparationPanel({
  preparation,
  onRetryConnections,
}: MassivaOpeningPreparationPanelProps) {
  const { t } = useTranslation()

  if (preparation.status === 'unavailable') {
    if (preparation.reason === 'connections-loading') {
      return <LoadingState label={`${t('massiva.opening_preparation')}...`} />
    }

    return (
      <ErrorState
        title={t('massiva.local_preview_title')}
        message={formatQueryError(preparation.error)}
        onRetry={onRetryConnections}
      />
    )
  }

  if (preparation.status === 'invalid') {
    return (
      <div
        className="rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50 to-amber-50/20 px-4 py-3.5 text-sm text-amber-950 shadow-sm ring-1 ring-amber-100/50"
        role="status"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="font-medium text-amber-900">Seleção inválida para abertura</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {preparation.issues.map((issue, index) => (
                <li key={`${index}-${issue}`}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const { basis, plan } = preparation

  return (
    <div
      className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-violet-50/40 px-4 py-4 text-sm text-violet-950 shadow-[0_4px_24px_-8px_rgba(109,40,217,0.18)] ring-1 ring-violet-200/35"
      role="region"
      aria-label="Resumo da rota para abertura"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700/90">
        Rotas validadas
      </p>
      <p className="mt-1 font-semibold text-violet-950">Pronto para o fluxo de abertura</p>

      <div className="mt-3 rounded-xl border border-violet-100/90 bg-white/70 px-3 py-2.5 shadow-sm backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600/90">
          Topologia selecionada
        </p>

        <ul className="mt-2 space-y-1.5 text-xs text-violet-950 sm:text-sm">
          {basis.topology.routes.map((route) => (
            <li key={`${route.apCode}-${route.slot}-${route.port}`} className="leading-relaxed">
              <span className="font-mono font-semibold text-violet-900">{route.apCode}</span>
              <span className="text-violet-400"> - </span>
              slot <span className="tabular-nums font-semibold">{route.slot}</span>
              <span className="text-violet-400"> - </span>
              porta <span className="tabular-nums font-semibold">{route.port}</span>
              <span className="text-violet-400"> - </span>
              <span className="font-medium">
                {route.effectiveSplitterDisplay.length} splitter(s)
              </span>
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-violet-100/80 bg-white/60 px-3 py-2.5 shadow-sm">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-violet-600/85">
            {t('massiva.affected_total')}
          </dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-violet-950">
            {plan.routeCollectedClientCount}
          </dd>
        </div>
        <div className="rounded-xl border border-violet-100/80 bg-white/60 px-3 py-2.5 shadow-sm">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-violet-600/85">
            {t('massiva.pppoes_total')}
          </dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-violet-950">
            {plan.routeUniqueAuthenticationIdCount}
          </dd>
        </div>
      </dl>
    </div>
  )
}
