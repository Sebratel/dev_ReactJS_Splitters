/**
 * Sinal projetado da porta (Fase 2) — vem da GeoGrid via
 * `/api/geogrid/clientesAtendimentos?nomes={nome}`. O campo `potenciaFinal`
 * é a potência projetada no ponto do cliente/ONU (dBm), comparada com o
 * `rxPower` real do monitoramento para detectar atenuação. Ver [[onu-diagnostic-model]].
 */
export type ProjectedSignal = {
  /** Nome retornado pela GeoGrid (para conferência do match). */
  matchedName: string | null
  /** potencia.potenciaFinal — sinal projetado no cliente (dBm). */
  projectedRxPower: number | null
  /** potencia.potenciaInicial — potência projetada na OLT (dBm). */
  initialPower: number | null
  /** potencia.perdaTotal — perda total projetada do enlace (dB). */
  lossTotal: number | null
  oltSigla: string | null
  oltPorta: string | null
  equipamentoSigla: string | null
  porta: string | null
  /**
   * true quando o mesmo nome normalizado retornou mais de um valor de
   * `potenciaFinal` distinto — possível homônimo ou múltiplos enlaces.
   * Nesse caso a projeção é exibida com aviso, mas não dispara alerta de
   * atenuação (o comparativo definitivo precisa de confirmação manual).
   */
  ambiguous?: boolean
}

/** Normaliza nome para matching: maiúsculas, sem acento, espaços colapsados. */
export function normalizeClientName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}
