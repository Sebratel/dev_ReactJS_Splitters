/**
 * Estado da "Conferência com o Elleven" (GET /api/massiva/conferencia/status).
 *
 * O backend compara a lista de massivas do Elleven com `massiva_history` e cria, na plataforma, as
 * linhas que existem só no Elleven. Aqui ficam o contrato e a leitura defensiva dessa resposta.
 */

/** Valor de `massiva_history.source` das linhas criadas pela conferência. */
export const MASSIVA_SOURCE_CONFERENCIA_ELLEVEN = 'conferencia-elleven'

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
    janelaDias: Number.isFinite(janela) && janela >= 1 ? Math.trunc(janela) : 30,
    gatewayConfigurado: r.gatewayConfigurado === true,
    emExecucao: r.emExecucao === true,
    ultimaExecucao: parseResumo(r.ultimaExecucao),
    recuperadasUltimos30Dias:
      recuperadas == null || !Number.isFinite(Number(recuperadas)) ? null : toCount(recuperadas),
  }
}
