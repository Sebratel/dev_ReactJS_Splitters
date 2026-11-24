/** Cliente (contrato) que já faz parte de outro evento aberto. */
export type MassivaConflictClient = {
  contractId: number
  pppoe: string
}

/** Evento aberto que já tem clientes da seleção. `origin` ganha 'gmud' na fase da GMUD. */
export type MassivaConflictEvent = {
  origin: 'massiva' | 'gmud'
  protocol: number
  title: string
  openedAt: string | null
  /** Previsão de encerramento total do outro evento. */
  finishDate: string | null
  clients: MassivaConflictClient[]
}

export type MassivaClientConflicts = {
  events: MassivaConflictEvent[]
  /** Todos os contratos da seleção que já estão em algum evento aberto (sem repetição). */
  contractIds: number[]
}

export const EMPTY_MASSIVA_CLIENT_CONFLICTS: MassivaClientConflicts = { events: [], contractIds: [] }
