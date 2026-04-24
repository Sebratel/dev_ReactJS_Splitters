/**
 * Resultado normalizado por AP — paridade `EllevenMassivaResponse` em `massiva_models.dart`
 * após `_parseOpenMassivaResponse` (sucesso HTTP + `success !== false`).
 */
export type MassivaOpenSingleResult = {
  accessPointCode: string
  protocol: number | null
  assignmentId: number | null
  message: string
  createdProtocols: number[]
}

/** Retorno de `openMassivaFromContext` quando todos os POSTs concluem com sucesso. */
export type MassivaOpenMutationSuccessPayload = {
  results: MassivaOpenSingleResult[]
  /** Quantidade enviada no POST `/afetados` (clientes com PPPoE + contrato). */
  afetadosPostedCount?: number
  /** Encerramento automático: nenhum cliente mapeável na seleção da rota. */
  autoClosedWithoutClients?: boolean
  /** Abertura ok, mas não foi possível encerrar/registrar conforme esperado. */
  followUpWarning?: string
}

/**
 * Pelo menos um POST falhou — pode haver sucessos parciais (paridade loop em `_openMassiva`).
 */
export class MassivaOpenAggregateError extends Error {
  override readonly name = 'MassivaOpenAggregateError'

  constructor(
    public readonly successes: MassivaOpenSingleResult[],
    public readonly failures: ReadonlyArray<{
      accessPointCode: string
      message: string
    }>,
  ) {
    const detail = failures.map((f) => `${f.accessPointCode}: ${f.message}`).join('\n')
    super(
      failures.length > 0
        ? `Falha ao abrir massiva.\n${detail}`
        : 'Falha ao abrir massiva.',
    )
  }
}

export function isMassivaOpenAggregateError(
  e: unknown,
): e is MassivaOpenAggregateError {
  return e instanceof MassivaOpenAggregateError
}
