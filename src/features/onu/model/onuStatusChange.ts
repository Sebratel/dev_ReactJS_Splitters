/**
 * Feed near-real-time de mudanças de status de ONU (quedas/recuperações),
 * vindo do BFF em `/api/onu-diagnostics/recent-changes` (lê onu_status_changes).
 */

export type OnuStatusChange = {
  id: number
  /** 'drop' = caiu; 'recovery' = voltou. */
  kind: 'drop' | 'recovery'
  previousStatus: string | null
  newStatus: string | null
  /** Gatilho da mudança: 'alarm' (trap, instantâneo) ou 'olt_status' (varredura). */
  trigger: string | null
  previousRxPower: number | null
  newRxPower: number | null
  /** Instante do evento (ISO 8601, com timezone). */
  at: string | null
  /** Idade do evento em segundos (calculada no servidor). */
  ageSeconds: number | null
  username: string | null
  oltHostname: string | null
}

export type OnuRecentChanges = {
  generatedAt: string
  drops: number
  recoveries: number
  events: OnuStatusChange[]
}
