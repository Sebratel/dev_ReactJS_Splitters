import { useSplitterAddress } from '@/features/splitters/hooks/useSplitterAddress'
import { SplitterAddressPanel } from '@/features/splitters/ui/SplitterAddressPanel'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type SplitterAddressSectionProps = {
  splitterCode: string
  latitude: string
  longitude: string
}

export function SplitterAddressSection({
  splitterCode,
  latitude,
  longitude,
}: SplitterAddressSectionProps) {
  const { state, refetch } = useSplitterAddress({
    splitterCode,
    latitude,
    longitude,
  })

  if (state.type === 'no-coordinates') {
    return (
      <EmptyState
        title="Sem coordenadas"
        description="Este splitter não possui latitude/longitude válidas para reverse geocode."
      />
    )
  }

  if (state.type === 'loading') {
    return <LoadingState label="Resolvendo endereço…" />
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
        title="Endereço não encontrado"
        description="O serviço de geocoding não retornou dados para estas coordenadas."
      />
    )
  }

  return <SplitterAddressPanel address={state.address} />
}
