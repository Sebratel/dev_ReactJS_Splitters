/** Resumo de sinal ONU para um splitter específico (dados agregados). */
export type OnuSplitterSignalSummary = {
  /** Nome legível do splitter (ss.title). Null em payloads antigos do BFF. */
  title: string | null
  total: number
  online: number
  degraded: number
  offline: number
  /** Média de rxPower dos clientes operantes (dBm < 0). Null quando nenhum tem leitura. */
  avgRxPower: number | null
  /** Sinal projetado pelo GeoGrid (potenciaFinal) para a fibra deste splitter. Null quando GeoGrid indisponível ou sem cadastro. */
  projectedRxPower: number | null
}
