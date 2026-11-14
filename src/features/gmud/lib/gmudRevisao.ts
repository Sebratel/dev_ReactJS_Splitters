import { duracaoEmMinutos, type GmudJanela } from '@/features/gmud/lib/gmudJanela'
import { parseRepeticao } from '@/features/gmud/lib/gmudRecurrence'

/**
 * Etapa de revisão do formulário de GMUD: quem aprova, o que acontece ao abrir, avisos de atenção e o texto
 * do botão final. Tudo função pura e só para MOSTRAR — não valida nem muda o que é enviado.
 */

const PRE_APROVADA = 'Pré-aprovada'
const EMERGENCIAL = 'Emergencial'

export type GmudRevisaoAreasInput = {
  categoria: string
  /** Sistemas internos: "Áreas impactadas". */
  areasImpactadas?: readonly string[]
  /** Sistemas externos: "Áreas afetadas". */
  areasAfetadas?: readonly string[]
  /** Matriz "Recursos administrativos": área -> papel. */
  recursosAdministrativos?: Record<string, string> | null
}

/** Papéis da matriz que contam (N/A não). Espelha PAPEIS_QUE_APROVAM de server/lib/gmudAreaApproval.js. */
const PAPEIS_QUE_APROVAM = new Set(['executor', 'validador', 'observador'])

/**
 * Áreas marcadas na GMUD. Espelha `deriveNotificationAreas` de server/lib/gmudAreaApproval.js:
 * impactadas (sistemas internos) ou afetadas (sistemas externos), mais as áreas da matriz com papel
 * Executor, Validador ou Observador — em todas as categorias. Sem repetição e sem vazios.
 */
export function areasMarcadasNaGmud({ categoria, areasImpactadas, areasAfetadas, recursosAdministrativos }: GmudRevisaoAreasInput): string[] {
  const base = categoria === 'sistemas_internos' ? (areasImpactadas ?? []) : categoria === 'sistemas_externos' ? (areasAfetadas ?? []) : []
  const matriz = recursosAdministrativos
    ? Object.entries(recursosAdministrativos)
        .filter(([, papel]) => PAPEIS_QUE_APROVAM.has(papel))
        .map(([area]) => area)
    : []
  return [...new Set([...base, ...matriz].map((a) => String(a ?? '').trim()).filter((a) => a !== ''))]
}

export type GmudQuemAprova = {
  /** O Comitê decide (Programada e Emergencial). */
  comite: boolean
  /** Áreas que recebem o pedido e precisam aprovar (só Programada). */
  areasQueAprovam: string[]
  /** Áreas que só recebem um e-mail de aviso, sem aprovar (Emergencial e Pré-aprovada). */
  areasSoAvisadas: string[]
}

/**
 * Quem aprova, pela regra do servidor (`deriveApprovalAreas`):
 * - Programada: o Comitê e as áreas marcadas, em paralelo;
 * - Emergencial: só o Comitê; as áreas marcadas só recebem e-mail;
 * - Pré-aprovada: ninguém (nasce liberada); as áreas marcadas só recebem e-mail.
 */
export function quemAprovaAGmud(input: GmudRevisaoAreasInput & { tipo: string }): GmudQuemAprova {
  const areas = areasMarcadasNaGmud(input)
  const tipo = input.tipo.trim()
  if (tipo === PRE_APROVADA) return { comite: false, areasQueAprovam: [], areasSoAvisadas: areas }
  if (tipo === EMERGENCIAL) return { comite: true, areasQueAprovam: [], areasSoAvisadas: areas }
  return { comite: true, areasQueAprovam: areas, areasSoAvisadas: [] }
}

/** Quantos protocolos serão abertos: N da repetição na Pré-aprovada (quando válida); senão, 1. */
export function numeroDeProtocolos(tipo: string, repeticaoVezes: string | number, repeticaoIntervaloDias: string | number): number {
  if (tipo.trim() !== PRE_APROVADA) return 1
  return parseRepeticao(repeticaoVezes, repeticaoIntervaloDias)?.vezes ?? 1
}

/** Texto do botão final: diz a consequência. */
export function textoDoBotaoAbrir(protocolos: number): string {
  return protocolos > 1 ? `Abrir ${protocolos} protocolos no Elleven` : 'Abrir GMUD no Elleven'
}

/** Pede confirmação antes de abrir só nos casos de maior risco: Emergencial e Pré-aprovada com repetição. */
export function precisaConfirmarAbertura(tipo: string, protocolos: number): boolean {
  return tipo.trim() === EMERGENCIAL || (tipo.trim() === PRE_APROVADA && protocolos > 1)
}

/**
 * Passos do "O que acontece ao clicar em abrir", por tipo e categoria.
 * O passo dos clientes e do COR só existe na Rede externa e depende de rotinas que podem estar desligadas
 * no ambiente; por isso o texto diz "quando essas rotinas estão ativadas", sem prometer.
 */
export function passosAoAbrirGmud({ tipo, categoria, protocolos }: { tipo: string; categoria: string; protocolos: number }): string[] {
  const t = tipo.trim()
  const passos: string[] = []
  if (t === PRE_APROVADA) {
    passos.push(
      protocolos > 1
        ? `Abre ${protocolos} protocolos no Elleven agora, um para cada data, com o título numerado de (1/${protocolos}) a (${protocolos}/${protocolos}), e registra todos na plataforma.`
        : 'Abre o protocolo no Elleven e registra a GMUD na plataforma.',
      protocolos > 1
        ? 'Eles já ficam liberados, sem aprovação. As áreas marcadas só recebem um e-mail de aviso.'
        : 'A GMUD já fica liberada, sem aprovação. As áreas marcadas só recebem um e-mail de aviso.',
    )
  } else if (t === EMERGENCIAL) {
    passos.push(
      'Abre o protocolo no Elleven e registra a GMUD na plataforma.',
      'Só o Comitê decide. As áreas marcadas não aprovam: só recebem um e-mail de aviso.',
    )
  } else {
    passos.push(
      'Abre o protocolo no Elleven e registra a GMUD na plataforma.',
      'O Comitê e as áreas recebem o pedido de aprovação em paralelo. A GMUD só é liberada quando todos aprovarem.',
    )
  }
  if (categoria === 'rede_externa') {
    passos.push('Depois de liberada, no início da janela os clientes afetados são avisados e o COR recebe a lista, quando essas rotinas estão ativadas.')
  }
  return passos
}

/** Janela que começa em menos de N horas pede atenção. PALPITE: 48 h. Para mudar a regra, basta mexer aqui. */
export const LIMITE_HORAS_JANELA_PROXIMA = 48

/** Quantos minutos faltam de `agora` (hora local do navegador) até o início da janela; null se o início estiver incompleto. */
export function minutosAteOInicio(janela: Pick<GmudJanela, 'dataInicio' | 'horaInicio'>, agora: Date): number | null {
  const p = (n: number) => String(n).padStart(2, '0')
  return duracaoEmMinutos({
    dataInicio: `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`,
    horaInicio: `${p(agora.getHours())}:${p(agora.getMinutes())}`,
    dataFim: janela.dataInicio,
    horaFim: janela.horaInicio,
  })
}

/** Motivos do aviso "Atenção antes de abrir" (não bloqueia). Lista vazia = sem aviso. */
export function motivosDeAtencao({
  tipo, impactoParada, janela, protocolos, agora,
}: {
  tipo: string
  impactoParada: string
  janela: Pick<GmudJanela, 'dataInicio' | 'horaInicio'>
  protocolos: number
  agora: Date
}): string[] {
  const motivos: string[] = []
  if (impactoParada === 'Sim') motivos.push('Há parada do serviço durante a execução.')
  const faltam = minutosAteOInicio(janela, agora)
  if (faltam !== null && faltam < 0) motivos.push('O início da janela já passou.')
  else if (faltam !== null && faltam < LIMITE_HORAS_JANELA_PROXIMA * 60) motivos.push(`A janela começa em menos de ${LIMITE_HORAS_JANELA_PROXIMA} horas.`)
  if (tipo.trim() === EMERGENCIAL) motivos.push('É uma GMUD emergencial: só o Comitê decide.')
  if (tipo.trim() === PRE_APROVADA && protocolos > 1) motivos.push(`Serão abertos ${protocolos} protocolos agora, já liberados.`)
  return motivos
}
