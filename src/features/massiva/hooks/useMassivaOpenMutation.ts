import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trackUsageAction } from '@/features/analytics/api/trackUsageEvent'
import { openMassivaFromContext } from '@/features/massiva/api/openMassivaFromContext'
import { massivaTicketsFromOpenSuccess } from '@/features/massiva/lib/massivaTicketsFromOpenSuccess'
import {
  appendRecentOpenTicketsToStorage,
  readRecentOpenTicketsFromStorage,
} from '@/features/massiva/lib/massivaRecentOpensStorage'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'
import { clearPendingGmudLink, getPendingGmudLink } from '@/features/gmud/lib/pendingGmudLink'
import { linkMassivaToGmud } from '@/features/gmud/api/gmudLinks'
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

  // Chave de idempotência da tentativa: gerada uma vez e REUSADA em retries (ex.:
  // após timeout, quando o Elleven pode já ter criado), para o gateway deduplicar.
  // Rotacionada (null) a cada sucesso — a próxima abertura ganha uma chave nova.
  const attemptKeyRef = useRef<string | null>(null)

  const mutation = useMutation<
    MassivaOpenMutationSuccessPayload,
    unknown,
    MassivaOpenFinalContext
  >({
    mutationFn: (context) => openMassivaFromContext(context),
    onSuccess: (data, context) => {
      resetDraft()
      attemptKeyRef.current = null // rotaciona a chave após sucesso
      trackUsageAction('massiva_abrir', { module: 'massiva' })
      const fresh = massivaTicketsFromOpenSuccess(data, context)
      if (fresh.length > 0) {
        appendRecentOpenTicketsToStorage(fresh)
        queryClient.setQueryData(
          massivaKeys.recentOpens(),
          readRecentOpenTicketsFromStorage(),
        )
      }
      void queryClient.invalidateQueries({ queryKey: massivaKeys.recentOpens() })
      void queryClient.invalidateQueries({ queryKey: massivaKeys.list() })
      void queryClient.invalidateQueries({ queryKey: massivaKeys.all })
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'massiva' &&
          query.queryKey[1] === 'history-list',
      })
      void queryClient.invalidateQueries({ queryKey: splittersKeys.all })

      // Vínculo automático com GMUD: se o operador veio de "Abrir massiva vinculada"
      // numa GMUD, vincula os protocolos recém-abertos a ela e limpa o pendente.
      const pendingGmud = getPendingGmudLink()
      if (pendingGmud != null) {
        const protocols = data.results
          .map((r) => r.protocol)
          .filter((p): p is number => typeof p === 'number' && p > 0)
        void Promise.allSettled(
          protocols.map((p) => linkMassivaToGmud(pendingGmud, p)),
        ).finally(() => clearPendingGmudLink())
      }
    },
  })

  // Trava síncrona contra duplo/triplo clique: `mutation.isPending` é o valor do
  // render (closure) e só vira `true` no próximo render — nesse intervalo, cliques
  // rápidos disparariam `mutate` mais de uma vez (protocolos duplicados no Elleven).
  // O ref é setado no instante do clique, antes de qualquer render, e liberado no
  // `onSettled` (sucesso ou erro), permitindo um novo envio legítimo depois.
  const submittingRef = useRef(false)

  const submitOpen = () => {
    if (submittingRef.current || mutation.isPending) return
    if (readiness.status !== 'ready-to-open') return
    submittingRef.current = true
    if (attemptKeyRef.current === null) {
      attemptKeyRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    }
    mutation.mutate(
      { ...readiness.context, idempotencyKey: attemptKeyRef.current },
      {
        onSettled: () => {
          submittingRef.current = false
        },
      },
    )
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
