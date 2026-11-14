import { isGmudDisponivel } from '@/features/gmud/model/gmud'

/**
 * Reunião semanal de GMUDs: cálculo das semanas (segunda a domingo, fuso de Brasília), ordem do bloco
 * "O que foi feito" e agrupamento por dia do bloco "O que vem". Tudo função pura.
 * A classificação do resultado (concluída, cancelada…) vem pronta do servidor: aqui não se repete a regra.
 */

export type GmudReuniaoJanela = {
  dataInicio: string | null
  horaInicio: string | null
  dataFim: string | null
  horaFim: string | null
}

/** Resultado no bloco "O que foi feito" (calculado no servidor). */
export type GmudReuniaoResultado = 'nao_concluida' | 'reagendada' | 'cancelada' | 'janela_aberta' | 'concluida'

export type GmudReuniaoItem = {
  protocolo: number
  titulo: string | null
  tipo: string | null
  categoria: string | null
  popSite: string | null
  sistema: string | null
  janela: GmudReuniaoJanela
  impactoParada: string | null
  statusComite: string | null
  statusAreas: string | null
  areasTotal: number
  areasAprovadas: number
  statusExec: string | null
  ellevenEncerradoEm: string | null
  ellevenEncerradoStatus: string | null
  /** Status do protocolo no Voalle. */
  statusVoalle: string
  /** Já teve a janela reagendada alguma vez. */
  reagendada: boolean
}

export type GmudReuniaoFeitoItem = GmudReuniaoItem & {
  resultado: GmudReuniaoResultado
  /** Só em "reagendada": para onde a janela foi (a `janela` mostra onde ela estava). */
  novaJanela: GmudReuniaoJanela | null
}

export type GmudReuniaoSemanal = { feito: GmudReuniaoFeitoItem[]; vem: GmudReuniaoItem[] }

// ---------------------------------------------------------------------------
// Semanas
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y as number, (m as number) - 1, d as number))
}

/** Soma dias a uma data YYYY-MM-DD (aritmética em UTC: não sofre com fuso nem horário de verão). */
export function addDias(day: string, n: number): string {
  return new Date(parseDay(day).getTime() + n * DAY_MS).toISOString().slice(0, 10)
}

/** Dia da semana de uma data YYYY-MM-DD: 0 = domingo … 6 = sábado. */
export function diaDaSemana(day: string): number {
  return parseDay(day).getUTCDay()
}

/** A data de hoje em Brasília (YYYY-MM-DD), independente do fuso do navegador. */
export function hojeEmSaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** A segunda-feira da semana (segunda a domingo) que contém o dia. */
export function segundaDaSemana(day: string): string {
  return addDias(day, -((diaDaSemana(day) + 6) % 7))
}

/** Atalhos do seletor: "passada" = feito na semana passada, vem esta; "esta" = feito nesta, vem a próxima. */
export type GmudReuniaoModo = 'passada' | 'esta'

/**
 * Qual atalho abre por padrão, conforme o dia da semana de hoje.
 * REGRA FÁCIL DE MUDAR: não sabemos o dia exato da reunião. Hoje: de segunda a quarta olha-se a semana
 * passada; de quinta a domingo, a semana atual. Para trocar, basta mexer nesta função.
 */
export function modoPadraoDaReuniao(hoje: string): GmudReuniaoModo {
  const dia = diaDaSemana(hoje)
  return dia >= 1 && dia <= 3 ? 'passada' : 'esta'
}

/** Segunda-feira da semana do "feito" para um atalho. */
export function segundaDoFeito(hoje: string, modo: GmudReuniaoModo): string {
  const estaSemana = segundaDaSemana(hoje)
  return modo === 'passada' ? addDias(estaSemana, -7) : estaSemana
}

export type GmudReuniaoSemanas = { feitoDe: string; feitoAte: string; vemDe: string; vemAte: string }

/** As duas semanas da reunião a partir da segunda-feira do "feito": o "vem" é a semana seguinte. */
export function semanasDaReuniao(segundaFeito: string): GmudReuniaoSemanas {
  return { feitoDe: segundaFeito, feitoAte: addDias(segundaFeito, 6), vemDe: addDias(segundaFeito, 7), vemAte: addDias(segundaFeito, 13) }
}

/** "2026-11-09" → "09/11". */
export function diaMes(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

/** "09/11 a 15/11". */
export function formatarIntervalo(de: string, ate: string): string {
  return `${diaMes(de)} a ${diaMes(ate)}`
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** "Segunda, 16/11". */
export function rotuloDoDia(day: string): string {
  return `${DIAS[diaDaSemana(day)]}, ${diaMes(day)}`
}

// ---------------------------------------------------------------------------
// Bloco 1: o que foi feito
// ---------------------------------------------------------------------------

/**
 * Ordem do bloco "O que foi feito": primeiro o que não saiu como planejado (não concluída, reagendada,
 * cancelada), depois o que ainda está com a janela aberta e, por fim, as concluídas.
 */
export const ORDEM_RESULTADO: GmudReuniaoResultado[] = ['nao_concluida', 'reagendada', 'cancelada', 'janela_aberta', 'concluida']

const inicio = (j: GmudReuniaoJanela) => `${j.dataInicio ?? ''} ${j.horaInicio ?? ''}`

/** Ordena o "feito": pelo grupo do resultado e, dentro do grupo, pela data/hora da janela. Não altera a lista recebida. */
export function ordenarFeito(items: GmudReuniaoFeitoItem[]): GmudReuniaoFeitoItem[] {
  return [...items].sort(
    (a, b) =>
      ORDEM_RESULTADO.indexOf(a.resultado) - ORDEM_RESULTADO.indexOf(b.resultado) ||
      inicio(a.janela).localeCompare(inicio(b.janela)) ||
      a.protocolo - b.protocolo,
  )
}

/** Os quatro números do bloco "O que foi feito". */
export function resumoFeito(items: GmudReuniaoFeitoItem[]): { concluidas: number; reagendadas: number; canceladas: number; naoConcluidas: number } {
  const conta = (r: GmudReuniaoResultado) => items.filter((i) => i.resultado === r).length
  return { concluidas: conta('concluida'), reagendadas: conta('reagendada'), canceladas: conta('cancelada'), naoConcluidas: conta('nao_concluida') }
}

// ---------------------------------------------------------------------------
// Bloco 2: o que vem
// ---------------------------------------------------------------------------

export function reuniaoLiberada(item: Pick<GmudReuniaoItem, 'statusComite' | 'statusAreas'>): boolean {
  return isGmudDisponivel(item.statusComite, item.statusAreas)
}

export function reuniaoComParada(item: Pick<GmudReuniaoItem, 'impactoParada'>): boolean {
  return item.impactoParada === 'Sim'
}

/** Os quatro números do bloco "O que vem". */
export function resumoVem(items: GmudReuniaoItem[]): { programadas: number; liberadas: number; aguardando: number; comParada: number } {
  const liberadas = items.filter(reuniaoLiberada).length
  return { programadas: items.length, liberadas, aguardando: items.length - liberadas, comParada: items.filter(reuniaoComParada).length }
}

export type GmudReuniaoDia = { dia: string; items: GmudReuniaoItem[] }

/**
 * Agrupa o "vem" por dia de início (só dias com GMUD), em ordem de data e, dentro do dia, de hora.
 * Uma janela que começou antes da semana (e ainda a atravessa) aparece no primeiro dia da semana.
 */
export function agruparPorDia(items: GmudReuniaoItem[], de: string): GmudReuniaoDia[] {
  const porDia = new Map<string, GmudReuniaoItem[]>()
  for (const item of items) {
    const data = item.janela.dataInicio
    if (!data) continue
    const dia = data < de ? de : data
    porDia.set(dia, [...(porDia.get(dia) ?? []), item])
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, lista]) => ({
      dia,
      items: [...lista].sort((a, b) => inicio(a.janela).localeCompare(inicio(b.janela)) || a.protocolo - b.protocolo),
    }))
}
