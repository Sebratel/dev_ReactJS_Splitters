import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

type FinalizeMassivaInput = {
  mode: 'encerrar' | 'cancelar'
  protocol: number
  assignmentId: number
  description: string
  tipoIncidente?: string | null
  impacto?: string | null
  area?: string | null
  tecnologia?: string | null
  classificacao?: string | null
  cnl?: string | null
}

/** Cancelar a massiva também cancela o protocolo de infra aberto junto (quando existe). */
export type InfraCancelResult = { protocol: number | null; ok: boolean; reason?: string }

export type FinalizeMassivaOnServerResult =
  /** O backend encerrou/cancelou de ponta a ponta (Elleven, afetados e histórico local). */
  | { handled: true; localHistoryWarning?: string; infraCancel?: InfraCancelResult }
  /** O backend não tem o gateway configurado: use o fluxo antigo, feito pelo navegador. */
  | { handled: false }

/**
 * Encerra ou cancela a massiva pelo backend (POST /api/massiva/finalize). O backend faz os 3 passos
 * (Elleven, limpeza dos afetados, histórico local) numa só requisição, então fechar a aba no meio não
 * deixa mais o Elleven encerrado com o histórico local "aberta".
 *
 * Só devolve `handled: false` quando o backend avisa que não tem o gateway configurado (nada foi feito).
 * Qualquer outra falha lança: refazer pelo fluxo antigo poderia finalizar duas vezes no Elleven.
 */
export async function finalizeMassivaOnServer(
  input: FinalizeMassivaInput,
): Promise<FinalizeMassivaOnServerResult> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/finalize`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify(input),
  })

  const parsed = (await response.json().catch(() => null)) as {
    success?: boolean
    code?: string
    message?: string
    data?: { localHistoryWarning?: string; infraCancel?: InfraCancelResult }
  } | null

  if (response.status === 503 && parsed?.code === 'gateway_not_configured') {
    return { handled: false }
  }
  if (!response.ok || !parsed?.success) {
    throw new Error(parsed?.message ?? `Erro ao finalizar a massiva: ${response.status}`)
  }
  return {
    handled: true,
    localHistoryWarning: parsed.data?.localHistoryWarning,
    ...(parsed.data?.infraCancel ? { infraCancel: parsed.data.infraCancel } : {}),
  }
}
