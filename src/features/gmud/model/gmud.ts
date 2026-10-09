/** Item de GMUD vindo do Voalle (via BFF). Campos do formulário/aprovação entram em etapa posterior. */
export type GmudListItem = {
  protocol: number
  /** ID do atendimento no Elleven (para encerramento do protocolo). Fallback do Voalle. */
  assignmentId: number | null
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
  /** Quantas massivas estão vinculadas a esta GMUD. */
  massivaLinksCount: number
}

export type GmudExtra = {
  assignmentId: number | null
  tipo: string | null
  assunto: string | null
  popSite: string | null
  impactoParada: string | null
  comunicaCliente: string | null
  statusComite: string | null
  statusExec: string | null
  rnc: string | null
  dataCab: string | null
  ambienteAfetado: string[] | null
  /** Quando o protocolo foi encerrado no Elleven pela plataforma (ISO) — evita re-encerrar. */
  ellevenEncerradoEm: string | null
  /** Motivo do encerramento no Elleven: 'concluida' | 'negada'. */
  ellevenEncerradoStatus: string | null
}

/** Filtros rápidos do painel (abertas/vencidas/minhas vêm do Voalle; Comitê/plataforma do nosso banco). */
export type GmudListFilter = 'todas' | 'abertas' | 'vencidas' | 'comite_pendente' | 'aprovadas' | 'plataforma' | 'minhas'

/** Colunas ordenáveis do painel (ordenação feita no servidor, sobre toda a lista). */
export type GmudSortKey = 'protocolo' | 'solicitante' | 'abertura' | 'prazo' | 'status'
export type GmudSort = { key: GmudSortKey; dir: 'asc' | 'desc' }

export type GmudListResult = {
  items: GmudListItem[]
  total: number
  limit: number
  offset: number
}

/**
 * Regra de "disponibilização": uma GMUD só fica disponível para uso operacional
 * (vincular/gerar massivas, aparecer como origem, entrar na agenda) DEPOIS de aprovada
 * pelo Comitê. Pendente ou negada não é disponibilizada. Centraliza a decisão em um único
 * lugar para o front e espelha o guard do BFF.
 */
export function isGmudDisponivel(statusComite: string | null | undefined): boolean {
  return statusComite === 'aprovada'
}
