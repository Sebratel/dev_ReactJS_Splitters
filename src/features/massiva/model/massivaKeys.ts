/**
 * TanStack Query keys da feature `massiva` (paridade com `splittersKeys` / `clientesKeys`).
 */
export const massivaKeys = {
  all: ['massiva'] as const,

  /** GET listagem no BFF (`fetchMassivas`). */
  list: () => [...massivaKeys.all, 'list'] as const,

  /** GET `get-person-id-by-email` — paridade `getPersonEllevenId` na tela Flutter. */
  personIdByEmail: (email: string) =>
    [...massivaKeys.all, 'personId', email.toLowerCase().trim()] as const,

  /**
   * GET `/api/massiva/connections` sem filtro — índice PPPoE → AP/slot/porta para AutoISP.
   */
  connectionsForAutoIspIndex: () =>
    [...massivaKeys.all, 'connections-autoisp-index'] as const,
}
