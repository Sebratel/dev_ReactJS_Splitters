import { useMutation, useQueryClient } from '@tanstack/react-query'
import { openMassivaFromContext } from '@/features/massiva/api/openMassivaFromContext'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'
import type {
  MassivaOpenMutationSuccessPayload,
} from '@/features/massiva/model/massivaOpenMutation'
import type {
  MassivaOpenFinalContext,
  MassivaOpenReadinessView,
} from '@/features/massiva/model/massivaOpenReadiness'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'

/**
 * Abertura via POST no BFF e, em seguida, POST de afetados (ou encerramento automático
 * se não houver clientes mapeáveis na seleção), usando `readiness.context` quando
 * `readiness.status === 'ready-to-open'`.
 */
export function useMassivaOpenMutation(readiness: MassivaOpenReadinessView) {
  const queryClient = useQueryClient()
  const resetDraft = useMassivaOpenDraftStore((s) => s.reset)

  const mutation = useMutation<
    MassivaOpenMutationSuccessPayload,
    unknown,
    MassivaOpenFinalContext
  >({
    mutationFn: (context) => openMassivaFromContext(context),
    onSuccess: () => {
      resetDraft()
      void queryClient.invalidateQueries({ queryKey: massivaKeys.list() })
      void queryClient.invalidateQueries({ queryKey: splittersKeys.all })
    },
  })

  const submitOpen = () => {
    if (mutation.isPending) return
    if (readiness.status !== 'ready-to-open') return
    mutation.mutate(readiness.context)
  }

  const canSubmitOpen =
    readiness.status === 'ready-to-open' && !mutation.isPending

  return {
    submitOpen,
    dismissMutation: () => {
      mutation.reset()
    },
    canSubmitOpen,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    data: mutation.data,
    error: mutation.error,
  }
}
