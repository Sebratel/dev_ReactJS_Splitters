/**
 * Estado da "Conferência com o Elleven" (GET /api/massiva/conferencia/status).
 *
 * O backend compara a lista de massivas do Elleven com `massiva_history` e cria, na plataforma, as
 * linhas que existem só no Elleven. Aqui ficam o contrato e a leitura defensiva dessa resposta.
 */

/** Valor de `massiva_history.source` das linhas criadas pela conferência. */
export const MASSIVA_SOURCE_CONFERENCIA_ELLEVEN = 'conferencia-elleven'

/** Situação do protocolo no Elleven. */
export type MassivaConferenciaStatusElleven = 'aberta' | 'encerrada' | 'cancelada'

/** O que a conferência fez (ou fará) com o protocolo. */
export type MassivaConferenciaDesfecho =
  | 'seria_criada'
  | 'criada'
  | 'falhou'
  | 'ja_existia'
  | 'sem_assignment'
  | 'fora_da_janela'

/** Protocolo listado na tela (sem dado de cliente). */
export type MassivaConferenciaProtocolo = {
  protocolo: number
  assignmentId: number | null
  statusElleven: MassivaConferenciaStatusElleven
  /** Horário de parede de Brasília, como veio do backend ("AAAA-MM-DD HH:mm:ss" ou ISO sem fuso). */
  abertura: string | null
  pontoDeAcesso: string
  desfecho: MassivaConferenciaDesfecho | null
}

/** Lista cortada pelo backend (até 50 itens) com o total real. */
export type MassivaConferenciaProtocolos = {
  total: number
  itens: MassivaConferenciaProtocolo[]
}

export type MassivaConferenciaResumo = {
  ok: boolean
  /** Execução ignorada porque a anterior ainda estava em andamento. */
  skipped: boolean
  erro: string | null
  dryRun: boolean
  iniciadoEm: Date | null
  duracaoMs: number
  ellevenTotal: number
  ellevenAbertos: number
  /** Protocolos do Elleven que não tinham linha na plataforma nessa verificação. */
  semRegistro: number
  /** Protocolos faltando dentro da janela. Null quando o backend é antigo e não envia a lista. */
  protocolosSemRegistro: MassivaConferenciaProtocolos | null
  /** Protocolos do Elleven sem registro, mais antigos que a janela (não serão criados). Null se backend antigo. */
  protocolosForaDaJanela: MassivaConferenciaProtocolos | null
  criadas: number
  falhas: number
  conflitos: number
  /** Abertas na plataforma que o Elleven mostra finalizadas. */
  divergAbertaLocalFinalizadaElleven: number
  /** Encerradas/canceladas na plataforma que o Elleven mostra abertas. */
  divergFechadaLocalAbertaElleven: number
}

export type MassivaConferenciaStatus = {
  habilitada: boolean
  dryRun: boolean
  intervaloMinutos: number
  janelaDias: number
  gatewayConfigurado: boolean
  emExecucao: boolean
  ultimaExecucao: MassivaConferenciaResumo | null
  /** Null quando o backend não conseguiu contar (ou o banco não está configurado). */
  recuperadasUltimos30Dias: number | null
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toCount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function toNullableText(value: unknown): string | null {
  if (value == null) return null
  const t = String(value).trim()
  return t === '' ? null : t
}

const STATUS_ELLEVEN: readonly MassivaConferenciaStatusElleven[] = ['aberta', 'encerrada', 'cancelada']
const DESFECHOS: readonly MassivaConferenciaDesfecho[] = [
  'seria_criada',
  'criada',
  'falhou',
  'ja_existia',
  'sem_assignment',
  'fora_da_janela',
]

function parseProtocolo(raw: unknown): MassivaConferenciaProtocolo | null {
  const r = asObject(raw)
  const protocolo = toCount(r.protocolo)
  if (protocolo === 0) return null
  const status = String(r.statusElleven ?? '').trim().toLowerCase() as MassivaConferenciaStatusElleven
  const desfecho = String(r.desfecho ?? '').trim() as MassivaConferenciaDesfecho
  return {
    protocolo,
    assignmentId: toCount(r.assignmentId) || null,
    statusElleven: STATUS_ELLEVEN.includes(status) ? status : 'aberta',
    abertura: toNullableText(r.abertura),
    pontoDeAcesso: toNullableText(r.pontoDeAcesso) ?? '',
    desfecho: DESFECHOS.includes(desfecho) ? desfecho : null,
  }
}

/** Lê { total, itens }. Qualquer outra forma (backend antigo, campo ausente) vira null. */
function parseProtocolos(raw: unknown): MassivaConferenciaProtocolos | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = asObject(raw)
  if (!Array.isArray(r.itens)) return null
  const itens = r.itens.map(parseProtocolo).filter((p): p is MassivaConferenciaProtocolo => p !== null)
  return { total: Math.max(toCount(r.total), itens.length), itens }
}

/** "2026-10-28 10:43:00" / "2026-10-28T10:43:00" -> "28/10 10:43" (sem converter fuso; é horário de Brasília). */
export function formatAberturaConferencia(value: string | null): string {
  if (value == null) return '—'
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : value
}

function parseResumo(raw: unknown): MassivaConferenciaResumo | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = asObject(raw)
  const elleven = asObject(r.elleven)
  const plano = asObject(r.plano)
  const diverg = asObject(r.divergencias)
  const aberta = asObject(diverg.abertaLocalFinalizadaElleven)
  const fechada = asObject(diverg.fechadaLocalAbertaElleven)
  const dryRun = r.dryRun === true
  // Em "só relatório" o plano indica o que FALTA; em execução real, o que foi criado cobre o plano.
  const criariamTotal = toCount(r.criariamTotal)
  const planoCriar = toCount(plano.criar)
  return {
    ok: r.ok === true,
    skipped: r.skipped === true,
    erro: toNullableText(r.erro),
    dryRun,
    iniciadoEm: toDate(r.iniciadoEm),
    duracaoMs: toCount(r.duracaoMs),
    ellevenTotal: toCount(elleven.total),
    ellevenAbertos: toCount(elleven.abertos),
    semRegistro: dryRun ? Math.max(criariamTotal, planoCriar) : planoCriar,
    protocolosSemRegistro: parseProtocolos(r.semRegistro),
    protocolosForaDaJanela: parseProtocolos(r.foraDaJanela),
    criadas: toCount(r.criadasTotal),
    falhas: toCount(r.falhasTotal),
    conflitos: toCount(r.conflitosTotal),
    divergAbertaLocalFinalizadaElleven: toCount(aberta.total),
    divergFechadaLocalAbertaElleven: toCount(fechada.total),
  }
}

export function parseMassivaConferenciaStatus(raw: unknown): MassivaConferenciaStatus {
  const r = asObject(raw)
  const intervalo = Number(r.intervaloMinutos)
  const janela = Number(r.janelaDias)
  const recuperadas = r.recuperadasUltimos30Dias
  return {
    habilitada: r.habilitada === true,
    dryRun: r.dryRun === true,
    intervaloMinutos: Number.isFinite(intervalo) && intervalo >= 1 ? Math.trunc(intervalo) : 5,
    janelaDias: Number.isFinite(janela) && janela >= 1 ? Math.trunc(janela) : 7,
    gatewayConfigurado: r.gatewayConfigurado === true,
    emExecucao: r.emExecucao === true,
    ultimaExecucao: parseResumo(r.ultimaExecucao),
    recuperadasUltimos30Dias:
      recuperadas == null || !Number.isFinite(Number(recuperadas)) ? null : toCount(recuperadas),
  }
}
