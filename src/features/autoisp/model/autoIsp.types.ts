/**
 * Recurso individual devolvido pelo AutoISP dentro de um evento.
 * Paridade com `AutoIspResource` no Flutter.
 */
export interface AutoIspResource {
  ponlink: string | null
  pppoeUsername: string | null
  networkStatus: string | null
  contractId: number | null
  onuId: number | null
}

/**
 * Evento operacional devolvido pelo AutoISP (ex.: queda de OLT ou Porta).
 * Paridade com `AutoIspEvent` no Flutter.
 */
export interface AutoIspEvent {
  id: number
  eventType: string
  adminStatus: string
  startAt: string | null // ISO format
  endAt: string | null   // ISO format
  countOnus: number
  countCircuits: number
  resources: AutoIspResource[]
}

/**
 * Tipos de status administrativos comuns do AutoISP.
 */
export type AutoIspAdminStatus = 'new' | 'acknowledged' | 'closed' | 'open' | 'in_progress'

/**
 * Payload de resposta da autenticação do AutoISP.
 */
export interface AutoIspAuthPayload {
  token?: string
  access_token?: string
  jwt?: string
  expires_in?: number
  response?: {
    token?: string
    expires_in?: number
  }
}
