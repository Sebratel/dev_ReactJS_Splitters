import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { MassivaClassificationDraft } from '@/features/massiva/model/massivaClassificationOptions'

export type UpdateMassivaClassificationInput = MassivaClassificationDraft & {
  protocol: number
  assignmentId: number | null
  /** Usuário logado que está fazendo a manutenção (não é quem encerrou). */
  updatedBy?: string
}

/**
 * Manutenção pós-encerramento: reclassifica uma massiva JÁ ENCERRADA.
 * Puramente local (MySQL) — esses campos nunca são enviados à Voalle, então isso NÃO
 * chama o gateway/Elleven. Nunca altera `closeDescription`/`closedAt`/`closedBy` —
 * o backend rejeita a chamada se a massiva não estiver encerrada.
 */
export async function updateMassivaClassification(
  input: UpdateMassivaClassificationInput,
): Promise<void> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/update-classification`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({
        protocol: input.protocol,
        assignmentId: input.assignmentId,
        updatedBy: input.updatedBy ?? '',
        tipoIncidente: input.tipoIncidente || null,
        impacto: input.impacto || null,
        area: input.area || null,
        tecnologia: input.tecnologia || null,
        classificacao: input.classificacao || null,
        cnl: input.cnl || null,
      }),
    },
  )

  if (!response.ok) {
    let message = `Erro ao atualizar classificação: ${response.status}`
    try {
      const parsed = await response.json()
      if (typeof parsed?.message === 'string' && parsed.message.trim() !== '') {
        message = parsed.message
      }
    } catch {
      // mantém a mensagem genérica
    }
    throw new Error(message)
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao atualizar classificação da massiva.')
  }
}
