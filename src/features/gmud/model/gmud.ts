/** Item de GMUD vindo do Voalle (via BFF). Campos do formulário/aprovação entram em etapa posterior. */
export type GmudListItem = {
  protocol: number
  title: string
  description: string
  /** Abertura (date_to_start no Voalle), ISO. */
  openedAt: string | null
  /** Prazo SLA (responsible_final_date), ISO. */
  slaDate: string | null
  conclusionDate: string | null
  /** Status do atendimento no Elleven (ex.: "Abertura"). */
  status: string
  requester: string
  requesterEmail: string
}

export type GmudListResult = {
  items: GmudListItem[]
  total: number
  limit: number
  offset: number
}
