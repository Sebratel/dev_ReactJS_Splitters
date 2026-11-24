import { addDaysYmd, buildGmudOccurrences, type GmudRepeticao } from '@/features/gmud/lib/gmudRecurrence'

/**
 * Janela de mudança da GMUD: contas e textos para a tela (duração, "vira o dia", resumo, barra do dia).
 * Tudo em cima das strings do formulário — data 'AAAA-MM-DD' e hora 'HH:mm' — SEM fuso: é o horário local
 * da janela, não um instante. A aritmética usa Date.UTC só como calendário.
 * Nada aqui valida o formulário: as regras de pendência continuam em model/gmudForm.ts.
 */

export type GmudJanela = { dataInicio: string; horaInicio: string; dataFim: string; horaFim: string }
export type GmudJanelaCampo = keyof GmudJanela

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/
const HM = /^(\d{2}):(\d{2})$/
const MIN_MS = 60_000
const DIA_MIN = 24 * 60

/** Minutos desde 1970 de uma data + hora (calendário puro), ou null se algo estiver vazio/inválido. */
function minutos(data: string, hora: string): number | null {
  const d = YMD.exec(data)
  const h = HM.exec(hora)
  if (!d || !h) return null
  const hh = Number(h[1])
  const mm = Number(h[2])
  if (hh > 23 || mm > 59) return null
  return Math.round(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hh, mm) / MIN_MS)
}

/** Duração da janela em minutos (pode ser zero ou negativa se o fim não for depois do início); null se incompleta. */
export function duracaoEmMinutos(j: GmudJanela): number | null {
  const inicio = minutos(j.dataInicio, j.horaInicio)
  const fim = minutos(j.dataFim, j.horaFim)
  return inicio === null || fim === null ? null : fim - inicio
}

/** Fim = início + duração. null se o início estiver incompleto. */
export function somarDuracao(dataInicio: string, horaInicio: string, duracaoMin: number): { dataFim: string; horaFim: string } | null {
  const inicio = minutos(dataInicio, horaInicio)
  if (inicio === null) return null
  const fim = new Date((inicio + duracaoMin) * MIN_MS)
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    dataFim: `${fim.getUTCFullYear()}-${p(fim.getUTCMonth() + 1)}-${p(fim.getUTCDate())}`,
    horaFim: `${p(fim.getUTCHours())}:${p(fim.getUTCMinutes())}`,
  }
}

/** O fim cai em um dia depois do dia de início. */
export function viraODia(j: Pick<GmudJanela, 'dataInicio' | 'dataFim'>): boolean {
  return YMD.test(j.dataInicio) && YMD.test(j.dataFim) && j.dataFim > j.dataInicio
}

/**
 * Preenchimento inteligente: aplica a mudança de um campo e ajusta a data de fim quando dá para deduzir.
 * - Ao escolher a data de início: se a data de fim está vazia ou ficou antes dela, vira a mesma data
 *   (uma data de fim válida que a pessoa já escolheu não é sobrescrita).
 * - Mesmo dia com horário de fim ANTES do de início: a janela vira o dia, então a data de fim passa para o
 *   dia seguinte. Isso só acontece ao mexer no início ou no horário de fim; se a pessoa editar a data de fim
 *   à mão, vale o que ela escolheu.
 */
export function aplicarMudancaNaJanela(j: GmudJanela, campo: GmudJanelaCampo, valor: string): GmudJanela {
  const next: GmudJanela = { ...j, [campo]: valor }
  if (campo === 'dataFim') return next
  if (campo === 'dataInicio' && YMD.test(next.dataInicio) && (next.dataFim === '' || next.dataFim < next.dataInicio)) {
    next.dataFim = next.dataInicio
  }
  if (YMD.test(next.dataInicio) && next.dataFim === next.dataInicio && HM.test(next.horaInicio) && HM.test(next.horaFim) && next.horaFim < next.horaInicio) {
    next.dataFim = addDaysYmd(next.dataInicio, 1)
  }
  return next
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function diaDaSemana(data: string): number | null {
  const d = YMD.exec(data)
  return d ? new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]))).getUTCDay() : null
}

/** "2026-11-24" → "24/11". */
export function diaMesBr(data: string): string {
  const d = YMD.exec(data)
  return d ? `${d[3]}/${d[2]}` : data
}

/** "2026-11-24" → "24/11/2026". */
export function dataBr(data: string): string {
  const d = YMD.exec(data)
  return d ? `${d[3]}/${d[2]}/${d[1]}` : data
}

/** "Terça 24/11, 22:00" (dia da semana por extenso). Vazio se a data ou a hora forem inválidas. */
export function formatarMomento(data: string, hora: string): string {
  const dia = diaDaSemana(data)
  return dia === null || !HM.test(hora) ? '' : `${DIAS[dia]} ${diaMesBr(data)}, ${hora}`
}

/** "Ter 24/11" (dia da semana curto). */
export function formatarDiaCurto(data: string): string {
  const dia = diaDaSemana(data)
  return dia === null ? data : `${DIAS_CURTOS[dia]} ${diaMesBr(data)}`
}

/** "Terça 24/11, 22:00 até quarta 25/11, 01:00". Vazio se a janela estiver incompleta. */
export function resumoDaJanela(j: GmudJanela): string {
  const inicio = formatarMomento(j.dataInicio, j.horaInicio)
  const fim = formatarMomento(j.dataFim, j.horaFim)
  return inicio === '' || fim === '' ? '' : `${inicio} até ${fim.charAt(0).toLocaleLowerCase('pt-BR')}${fim.slice(1)}`
}

/** "45 min", "3 h", "3 h 30 min", "1 dia 2 h", "2 dias". Vazio para duração zero ou negativa. */
export function rotuloDaDuracao(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return ''
  const total = Math.round(min)
  const dias = Math.floor(total / DIA_MIN)
  const horas = Math.floor((total % DIA_MIN) / 60)
  const minutosRestantes = total % 60
  return [dias > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'}` : '', horas > 0 ? `${horas} h` : '', minutosRestantes > 0 ? `${minutosRestantes} min` : '']
    .filter((x) => x !== '')
    .join(' ')
}

/** Atalhos de duração dos chips, em minutos: 1 h, 2 h, 3 h, 4 h, 8 h. */
export const ATALHOS_DE_DURACAO = [60, 120, 180, 240, 480] as const

/**
 * Onde a janela cai nas 24 h do dia de início, em porcentagem da faixa. Se o fim é em outro dia, a faixa vai
 * até o fim do dia e `continua` avisa que segue no dia seguinte. null se a janela for inválida ou passar de 2 dias.
 */
export function posicaoNaBarraDoDia(j: GmudJanela): { inicioPct: number; larguraPct: number; continua: boolean } | null {
  const duracao = duracaoEmMinutos(j)
  const h = HM.exec(j.horaInicio)
  if (duracao === null || duracao <= 0 || duracao > 2 * DIA_MIN || !h) return null
  const inicioMin = Number(h[1]) * 60 + Number(h[2])
  const fimMin = Math.min(DIA_MIN, inicioMin + duracao)
  const pct = (n: number) => Math.round((n / DIA_MIN) * 10_000) / 100
  return { inicioPct: pct(inicioMin), larguraPct: pct(fimMin - inicioMin), continua: inicioMin + duracao > DIA_MIN }
}

/**
 * Datas de início das ocorrências da Pré-aprovada (a mesma conta usada ao abrir os protocolos:
 * buildGmudOccurrences). Vazio quando não há repetição (uma só) ou a data de início está em branco.
 */
export function datasDasOcorrencias(j: Pick<GmudJanela, 'dataInicio' | 'dataFim'>, repeticao: GmudRepeticao | null | undefined): string[] {
  if (!repeticao || repeticao.vezes <= 1 || !YMD.test(j.dataInicio)) return []
  return buildGmudOccurrences({
    dataInicio: j.dataInicio,
    dataFim: j.dataFim || j.dataInicio,
    vezes: repeticao.vezes,
    intervaloDias: repeticao.intervaloDias,
  }).map((o) => o.dataInicio)
}
