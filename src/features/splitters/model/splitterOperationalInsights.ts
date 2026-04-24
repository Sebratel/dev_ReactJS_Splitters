export type SplitterMassivaStats = {
  totalTickets: number
  openTickets: number
  closedTickets: number
  affectedClientsTotal: number
  latestOpenedAt: Date | null
}

export type SplitterOperationalTone = 'ok' | 'attention' | 'critical'

export type SplitterOperationalScore = {
  score: number
  tone: SplitterOperationalTone
  label: string
}
