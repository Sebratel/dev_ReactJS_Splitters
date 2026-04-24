import { useSplitterGeoGrid } from '@/features/splitters/hooks/useSplitterGeoGrid'
import { SplitterGeoGridPanel } from '@/features/splitters/ui/SplitterGeoGridPanel'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type SplitterGeoGridSectionProps = {
  integrationCode?: string | null
}

export function SplitterGeoGridSection({ integrationCode }: SplitterGeoGridSectionProps) {
  const { state, refetch } = useSplitterGeoGrid(integrationCode)

  if (state.type === 'no-integration-code') {
    return (
      <EmptyState
        title="Sem código de integração GeoGrid"
        description="Este splitter não possui `integrationCode` no cadastro; a API GeoGrid não pode ser consultada."
      />
    )
  }

  if (state.type === 'not-configured') {
    return (
      <EmptyState
        title="GeoGrid não configurado"
        description="Defina VITE_GEOGRID_BASE_URL e VITE_GEOGRID_API_KEY no ambiente do front (paridade com dart-define no Flutter)."
      />
    )
  }

  if (state.type === 'loading') {
    return <LoadingState label="Carregando portas GeoGrid…" />
  }

  if (state.type === 'error') {
    return (
      <ErrorState
        message={formatQueryError(state.error)}
        onRetry={() => refetch()}
      />
    )
  }

  if (state.type === 'empty') {
    return (
      <EmptyState
        title="Nenhuma porta GeoGrid"
        description="A API não retornou portas para este equipamento ou todas foram descartadas pela regra de merge (porta ≤ 0)."
      />
    )
  }

  return <SplitterGeoGridPanel rows={state.rows} />
}
