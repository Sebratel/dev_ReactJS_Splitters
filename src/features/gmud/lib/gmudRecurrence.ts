/**
 * Repetição da GMUD Pré-aprovada: "a cada N dias, M vezes". Cada ocorrência vira uma GMUD independente, aberta
 * no Elleven na hora, com a mesma máscara/assunto e a janela deslocada em N dias. Funções puras (sem fuso: só
 * datas 'yyyy-MM-dd' e horas que o usuário escolheu).
 */

export const GMUD_REPETICAO_MAX_VEZES = 12
export const GMUD_REPETICAO_MAX_INTERVALO_DIAS = 365

/** Ligação informativa entre as ocorrências (gravada em categoriaData.serie). Cancelar uma não mexe nas outras. */
export type GmudSerie = {
  id: string
  /** 1..total */
  indice: number
  total: number
  intervaloDias: number
}

export type GmudOccurrence = {
  indice: number
  total: number
  dataInicio: string
  dataFim: string
}

export type GmudRepeticao = { vezes: number; intervaloDias: number }

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

/** Soma dias a uma data 'yyyy-MM-dd' (calendário puro, sem horário de verão). */
export function addDaysYmd(ymd: string, days: number): string {
  const m = YMD.exec(ymd)
  if (!m) return ymd
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const toInt = (v: string | number): number | null => {
  const s = String(v).trim()
  return /^\d+$/.test(s) ? Number.parseInt(s, 10) : null
}

/** Lê os dois campos do formulário. null se algum for inválido (vezes 1..12, intervalo 1..365 quando vezes > 1). */
export function parseRepeticao(vezes: string | number, intervaloDias: string | number): GmudRepeticao | null {
  const m = toInt(vezes)
  if (m === null || m < 1 || m > GMUD_REPETICAO_MAX_VEZES) return null
  if (m === 1) return { vezes: 1, intervaloDias: 0 }
  const n = toInt(intervaloDias)
  if (n === null || n < 1 || n > GMUD_REPETICAO_MAX_INTERVALO_DIAS) return null
  return { vezes: m, intervaloDias: n }
}

/** As datas de cada ocorrência: a 1ª é a informada; as demais deslocam início e fim em k × intervalo. */
export function buildGmudOccurrences(input: { dataInicio: string; dataFim: string; vezes: number; intervaloDias: number }): GmudOccurrence[] {
  const total = Math.max(1, input.vezes)
  const fim = input.dataFim || input.dataInicio
  return Array.from({ length: total }, (_, i) => ({
    indice: i + 1,
    total,
    dataInicio: addDaysYmd(input.dataInicio, i * input.intervaloDias),
    dataFim: addDaysYmd(fim, i * input.intervaloDias),
  }))
}

/** Título de uma ocorrência: acrescenta "(k/N)" só quando há repetição. */
export function buildOccurrenceTitle(title: string, indice: number, total: number): string {
  return total > 1 ? `${title.trim()} (${indice}/${total})` : title.trim()
}

export function newSerieId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Texto curto para a tela: "Ocorrência 2 de 4 · a cada 15 dias". */
export function describeSerie(serie: Pick<GmudSerie, 'indice' | 'total' | 'intervaloDias'> | null | undefined): string | null {
  if (!serie || !(serie.total > 1)) return null
  return `Ocorrência ${serie.indice} de ${serie.total} · a cada ${serie.intervaloDias} ${serie.intervaloDias === 1 ? 'dia' : 'dias'}`
}
