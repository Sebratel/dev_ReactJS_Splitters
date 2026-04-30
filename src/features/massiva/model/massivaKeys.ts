/**
 * TanStack Query keys da feature `massiva` (paridade com `splittersKeys` / `clientesKeys`).
 */
export const massivaKeys = {
  all: ['massiva'] as const,

  /** GET listagem no BFF (`fetchMassivas`). */
  list: () => [...massivaKeys.all, 'list'] as const,

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
