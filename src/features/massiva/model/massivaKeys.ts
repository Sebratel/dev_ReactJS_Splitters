/**
 * TanStack Query keys da feature `massiva` (paridade com `splittersKeys` / `clientesKeys`).
 */
export const massivaKeys = {
  all: ['massiva'] as const,

  /** GET listagem no BFF (`fetchMassivasListCore`). */
  list: () => [...massivaKeys.all, 'list'] as const,

  /** Protocolos recém-abertos (cache TanStack) até aparecerem no BFF. */
  recentOpens: () => [...massivaKeys.all, 'recent-opens'] as const,

  /** Enriquecimento `afetados/protocol/{id}` após a listagem (fingerprint = protocolos ordenados). */
  listAfetados: (protocolsFingerprint: string) =>
    [...massivaKeys.all, 'list-afetados', protocolsFingerprint] as const,

  /** GET histórico local no BFF local (MySQL massiva_history). */
  historyList: (
    status: 'aberta' | 'encerrada' | 'all',
    startIso: string,
    endIso: string,
    limit: number,
  ) => [...massivaKeys.all, 'history-list', status, startIso, endIso, limit] as const,

  /** GET `get-person-id-by-email` — paridade `getPersonEllevenId` na tela Flutter. */
  personIdByEmail: (email: string) =>
    [...massivaKeys.all, 'personId', email.toLowerCase().trim()] as const,

  /**
   * GET `/api/massiva/connections` sem filtro — índice PPPoE → AP/slot/porta para AutoISP.
   */
  connectionsForAutoIspIndex: () =>
    [...massivaKeys.all, 'connections-autoisp-index'] as const,
}
