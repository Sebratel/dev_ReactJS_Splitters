import { useSplitterOlt } from '@/features/splitters/hooks/useSplitterOlt'
import { SplitterOltPanel } from '@/features/splitters/ui/SplitterOltPanel'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { EmptyState } from '@/shared/ui/states/EmptyState'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type SplitterOltSectionProps = {
  /** Mesmo valor que `SplitterModel.oltCode`; repassado só como string para o hook. */
  oltCode?: string | null
}

export function SplitterOltSection({ oltCode }: SplitterOltSectionProps) {
  const { state, refetch } = useSplitterOlt(oltCode)

  if (state.type === 'no-olt-code') {
    return (
      <EmptyState
        title="Sem OLT vinculada"
        description="Este splitter não possui código OLT no cadastro retornado pelo BFF."
      />
    )
  }

  if (state.type === 'loading') {
    return <LoadingState label="Carregando dados da OLT…" />
  }

  if (state.type === 'error') {
    return (
      <ErrorState
        message={formatQueryError(state.error)}
        onRetry={() => refetch()}
      />
    )
  }

  if (state.type === 'not-found') {
    return (
      <EmptyState
        title="OLT não encontrada"
        description="O código OLT do splitter não aparece na listagem atual de OLTs. Atualize os dados ou verifique o cadastro."
      />
    )
  }

  return <SplitterOltPanel olt={state.olt} />
}
