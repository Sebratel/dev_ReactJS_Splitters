import { env } from '@/shared/config/env'
import { nowInBrazilIsoLike } from '@/features/massiva/lib/formatBrazilDateTime'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

type RegisterClosedMassivaHistoryInput = {
  protocol: number
  assignmentId: number
  closeDescription: string
  /** Quem encerrou (usuário logado na plataforma). */
  closedBy?: string
  /** Classificação operacional preenchida no encerramento — enviada ao BFF para gravação no histórico local. */
  tipoIncidente?: string | null
  impacto?: string | null
  area?: string | null
  tecnologia?: string | null
  classificacao?: string | null
  cnl?: string | null
}

export async function registerClosedMassivaHistoryInLocalDb(
  input: RegisterClosedMassivaHistoryInput,
): Promise<void> {
  const nowBrazil = nowInBrazilIsoLike()
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/history/close`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      protocol: input.protocol,
      assignmentId: input.assignmentId,
      closeDescription: input.closeDescription,
      closedBy: input.closedBy ?? '',
      closedAt: nowBrazil,
      tipoIncidente: input.tipoIncidente ?? null,
      impacto: input.impacto ?? null,
      area: input.area ?? null,
      tecnologia: input.tecnologia ?? null,
      classificacao: input.classificacao ?? null,
      cnl: input.cnl ?? null,
    }),
  })

  if (!response.ok) {
    throw new Error(`Erro ao registrar encerramento local da massiva: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success) {
    throw new Error('Resposta inesperada ao registrar encerramento local da massiva.')
  }
}
