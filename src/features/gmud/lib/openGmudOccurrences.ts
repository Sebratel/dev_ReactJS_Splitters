import type { GmudOccurrence } from '@/features/gmud/lib/gmudRecurrence'

/**
 * Abre, em sequência, um protocolo no Elleven e registra a GMUD na plataforma para cada ocorrência.
 * Se uma ocorrência falhar depois de outras já abertas, NÃO desfaz as abertas (o protocolo existe no Elleven): o erro
 * lista quais protocolos já foram abertos. A chave de idempotência é estável por ocorrência, então reenviar não
 * duplica as que já foram abertas.
 */
export async function openGmudOccurrences(input: {
  occurrences: readonly GmudOccurrence[]
  /** Chave base; com mais de uma ocorrência vira `${base}:${indice}`. */
  idempotencyKeyBase: string | null
  openOne: (occurrence: GmudOccurrence, idempotencyKey: string | null) => Promise<{ protocol: string; assignmentId: number | null }>
  registerOne: (occurrence: GmudOccurrence, opened: { protocol: string; assignmentId: number | null }) => Promise<void>
}): Promise<string[]> {
  const { occurrences, idempotencyKeyBase } = input
  const protocols: string[] = []
  try {
    for (const occ of occurrences) {
      const key =
        idempotencyKeyBase === null ? null : occurrences.length > 1 ? `${idempotencyKeyBase}:${occ.indice}` : idempotencyKeyBase
      const opened = await input.openOne(occ, key)
      await input.registerOne(occ, opened)
      protocols.push(opened.protocol)
    }
  } catch (error) {
    if (protocols.length === 0) throw error
    const motivo = error instanceof Error ? error.message : 'erro desconhecido'
    throw new Error(
      `Foram abertos ${protocols.length} de ${occurrences.length} protocolos (${protocols.join(', ')}) antes de um erro: ${motivo}. ` +
        'Ao enviar de novo, os já abertos não são duplicados.',
    )
  }
  return protocols
}
