import type { MassivaConferenciaStatus } from '@/features/massiva/model/massivaConferenciaStatus'

/** Quantos intervalos sem verificar até considerar a conferência "atrasada". */
export const CONFERENCIA_ATRASO_MULTIPLO = 3

export type ConferenciaMode = 'desligada' | 'so_relatorio' | 'ativa'
export type ConferenciaTone = 'ok' | 'warn' | 'err'

export type ConferenciaHealth = {
  mode: ConferenciaMode
  tone: ConferenciaTone
  /** Rótulo curto do modo: Ativa / Só relatório / Desligada. */
  modeLabel: string
  /** Motivo do tom (para tooltip e para o cartão). */
  reason: string
  /** Última verificação passou de CONFERENCIA_ATRASO_MULTIPLO x o intervalo. */
  atrasada: boolean
  /** Já houve ao menos uma verificação nesta execução do backend. */
  executou: boolean
}

export function conferenciaMode(status: MassivaConferenciaStatus): ConferenciaMode {
  if (!status.habilitada) return 'desligada'
  return status.dryRun ? 'so_relatorio' : 'ativa'
}

const MODE_LABEL: Record<ConferenciaMode, string> = {
  desligada: 'Desligada',
  so_relatorio: 'Só relatório',
  ativa: 'Ativa',
}

/**
 * Regra de cor (linha "Conferência Elleven" no cartão Saúde das APIs e selo do cartão da aba Qualidade):
 * - verde: ativa e a última verificação foi há menos de 3x o intervalo, sem erro nem falha de gravação;
 * - amarelo: desligada, só relatório, gateway sem configuração ou aguardando a primeira verificação;
 * - vermelho: ativa e atrasada (>3x o intervalo), ou última verificação com erro/falha de gravação.
 */
export function evaluateConferenciaHealth(
  status: MassivaConferenciaStatus,
  nowMs: number = Date.now(),
): ConferenciaHealth {
  const mode = conferenciaMode(status)
  const ultima = status.ultimaExecucao
  const executou = ultima != null
  const base = { mode, modeLabel: MODE_LABEL[mode], executou }

  const limiteMs = status.intervaloMinutos * 60_000 * CONFERENCIA_ATRASO_MULTIPLO
  const idadeMs =
    ultima?.iniciadoEm != null ? Math.max(0, nowMs - ultima.iniciadoEm.getTime()) : null
  const atrasada = mode === 'ativa' && idadeMs != null && idadeMs > limiteMs

  if (mode === 'desligada') {
    return { ...base, tone: 'warn', atrasada: false, reason: 'A conferência automática está desligada neste ambiente.' }
  }
  if (!status.gatewayConfigurado) {
    return { ...base, tone: 'warn', atrasada: false, reason: 'O gateway do Elleven não está configurado no backend.' }
  }
  if (mode === 'so_relatorio') {
    return { ...base, tone: 'warn', atrasada: false, reason: 'Modo só relatório: a conferência informa o que falta, mas não cria nada.' }
  }
  if (!executou) {
    return { ...base, tone: 'warn', atrasada: false, reason: 'Aguardando a primeira verificação.' }
  }
  if (ultima.erro != null && !ultima.skipped) {
    return { ...base, tone: 'err', atrasada, reason: `A última verificação falhou: ${ultima.erro}` }
  }
  if (ultima.falhas > 0) {
    return { ...base, tone: 'err', atrasada, reason: `${ultima.falhas} protocolo(s) não puderam ser gravados na última verificação.` }
  }
  if (atrasada) {
    return {
      ...base,
      tone: 'err',
      atrasada,
      reason: `Sem verificação há mais de ${CONFERENCIA_ATRASO_MULTIPLO}x o intervalo (${status.intervaloMinutos} min).`,
    }
  }
  return { ...base, tone: 'ok', atrasada, reason: 'Verificações em dia.' }
}

/** "agora há pouco", "há 4 min", "há 2 h", "há 3 d". */
export function formatConferenciaRelative(date: Date | null, nowMs: number = Date.now()): string {
  if (date == null) return '—'
  const diffMs = Math.max(0, nowMs - date.getTime())
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.floor(h / 24)} d`
}
