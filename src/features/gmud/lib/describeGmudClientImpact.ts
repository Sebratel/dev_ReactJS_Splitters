import type { GmudClientImpact } from '@/features/gmud/api/gmudClients'

const REMOVED_LABEL: Record<string, string> = {
  fora_da_janela: 'a janela terminou',
  encerrada: 'a GMUD foi encerrada',
  negada: 'a GMUD foi negada',
  nao_liberada: 'a GMUD deixou de estar liberada',
  gmud_nao_encontrada: 'a GMUD não foi encontrada',
}

/** 'YYYY-MM-DD HH:mm:ss' -> 'dd/MM HH:mm' (horário de parede de Brasília, sem conversão de fuso). */
export function formatNaiveShort(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value ?? ''))
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : '—'
}

/** Texto do card: situação dos clientes da GMUD em uma frase curta. */
export function describeGmudClientImpact(impact: GmudClientImpact): string {
  if (impact.erro) return `Não foi possível estimar os clientes: ${impact.erro}`
  if (impact.source === 'estimativa') {
    return 'Estimativa pelo escopo. Os clientes entram em alerta no início previsto da GMUD e saem no encerramento.'
  }
  if (impact.status === 'incluida') {
    return `Em alerta desde ${formatNaiveShort(impact.includedAt)}; saem às ${formatNaiveShort(impact.windowEnd)} ou no encerramento.`
  }
  if (impact.status === 'removida') {
    const why = impact.removedReason ? REMOVED_LABEL[impact.removedReason] ?? impact.removedReason : null
    return `Já saíram do alerta em ${formatNaiveShort(impact.removedAt)}${why ? ` (${why})` : ''}.`
  }
  return 'Ainda não incluídos.'
}
