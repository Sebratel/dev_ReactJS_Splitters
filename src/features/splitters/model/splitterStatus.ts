/**
 * Paridade com `SplitterStatus` / `SplitterStatusService` no Flutter
 * (`lib/enums/splitter_status.dart`, `lib/services/splitter_status_service.dart`).
 */
export const SPLITTER_STATUS_ORDER = [
  'normal',
  'alerta',
  'critico',
  'excedente',
] as const

export type SplitterStatus = (typeof SPLITTER_STATUS_ORDER)[number]

/**
 * Resolve status a partir de ocupação real (contagem de conexões) e portas do splitter.
 * Ordem e limites idênticos ao Dart.
 */
export function resolveSplitterStatus(
  ocupacaoReal: number,
  totalPortas: number,
): SplitterStatus {
  if (totalPortas <= 0) {
    return 'normal'
  }

  if (ocupacaoReal > totalPortas) {
    return 'excedente'
  }

  const percentual = (ocupacaoReal / totalPortas) * 100

  if (percentual === 100) {
    return 'critico'
  }

  if (percentual > 70) {
    return 'alerta'
  }

  return 'normal'
}

export function sortSplitterStatuses(statuses: SplitterStatus[]): SplitterStatus[] {
  return [...statuses].sort(
    (a, b) =>
      SPLITTER_STATUS_ORDER.indexOf(a) - SPLITTER_STATUS_ORDER.indexOf(b),
  )
}

/** Rótulos para UI (faixas alinhadas ao serviço Dart). */
export const SPLITTER_STATUS_LABEL: Record<SplitterStatus, string> = {
  normal: 'Normal (até 70%)',
  alerta: 'Alerta (71% a 99%)',
  critico: 'Crítico (100%)',
  excedente: 'Excedente (>100%)',
}
