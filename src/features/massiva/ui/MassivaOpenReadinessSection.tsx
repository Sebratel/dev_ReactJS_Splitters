import { useMassivaOpenMutation } from '@/features/massiva/hooks/useMassivaOpenMutation'
import { useMassivaOpenReadiness } from '@/features/massiva/hooks/useMassivaOpenReadiness'
import type { MassivaOpeningPreparationView } from '@/features/massiva/model/massivaOpeningBasis'
import { MassivaOpenReadinessPanel } from '@/features/massiva/ui/MassivaOpenReadinessPanel'

type MassivaOpenReadinessSectionProps = {
  openingPreparation: MassivaOpeningPreparationView
}

/**
 * Preparação final + mutação de abertura (POST) a partir de `readiness.context`.
 * Sem notify de afetados, encerramento nem AutoISP.
 */
export function MassivaOpenReadinessSection({
  openingPreparation,
}: MassivaOpenReadinessSectionProps) {
  const { readiness, draftFormEnabled, refetchPersonId } =
    useMassivaOpenReadiness(openingPreparation)

  const openMutation = useMassivaOpenMutation(readiness)

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold tracking-tight text-neutral-900">
        Preparação e abertura
      </h3>
      <p className="mb-3 max-w-prose text-xs leading-relaxed text-neutral-600">
        Revise permissões e envie com o contexto da rota já montado.
      </p>
      <MassivaOpenReadinessPanel
        readiness={readiness}
        draftFormEnabled={draftFormEnabled}
        onRetryPersonId={refetchPersonId}
        openMutation={openMutation}
      />
    </div>
  )
}
