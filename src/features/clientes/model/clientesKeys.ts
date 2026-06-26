/**
 * Chaves TanStack Query da feature `clientes`.
 *
 * Na etapa 1 o detalhe usa `sharedListarConnectionsQueryKey()` (mesmo que `splittersKeys.connections()`).
 * Quando existir endpoint próprio (ex. GET por id), adicionar `detail(id)` aqui e migrar o hook.
 * `solicitations(clientId)` — GET `solicitacoes/cliente/:clientId`.
 */
export const clientesKeys = {
  all: ['clientes'] as const,
  detail: (authenticationId: number) =>
    [...clientesKeys.all, 'detail', authenticationId] as const,

  /** GET `solicitacoes/cliente/:clientId` — paridade `SolicitationService` + `cliente.clientId` no Flutter. */
  solicitations: (clientId: number) =>
    [...clientesKeys.all, 'solicitations', clientId] as const,

  /** GET `/api/clientes/:clientId/patrimonios` — equipamentos do cliente (banco principal). */
  patrimonies: (clientId: number) =>
    [...clientesKeys.all, 'patrimonies', clientId] as const,
}
