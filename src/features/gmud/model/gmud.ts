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
  /** Campos do formulário/aprovação (nosso MySQL), quando a GMUD já foi registrada na plataforma. */
  extra: GmudExtra | null
}

export type GmudExtra = {
  tipo: string | null
  popSite: string | null
  impactoParada: string | null
  comunicaCliente: string | null
  statusComite: string | null
  statusExec: string | null
  rnc: string | null
  dataCab: string | null
  ambienteAfetado: string[] | null
}

export type GmudListResult = {
  items: GmudListItem[]
  total: number
  limit: number
  offset: number
}
