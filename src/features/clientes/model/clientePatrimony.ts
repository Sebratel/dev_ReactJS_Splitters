/**
 * Patrimônio (equipamento) vinculado ao cliente — roteador, ONU etc. — do
 * banco principal (tabela `patrimonies`), exposto pelo BFF em
 * `GET /api/clientes/:clientId/patrimonios`.
 *
 * O elo é o `clientId` (= `people.id` = `SplitterCliente.clientId`), distinto
 * do `authenticationId` usado na rota `/clientes/:id`.
 */
export type ClientePatrimony = {
  clientId: number | null
  contractId: number | null
  contractNumber: string | null
  /** Tipo de contrato (`contract_types.title`). */
  contractTypeTitle: string | null
  /** Situação do contrato (`contracts.v_status`); Cancelado é filtrado no BFF. */
  contractStatus: string | null
  /** Descrição do equipamento (`patrimonies.title`) — ex.: modelo do roteador. */
  patrimonyTitle: string | null
  serialNumber: string | null
  tagNumber: string | null
  mac: string | null
}
