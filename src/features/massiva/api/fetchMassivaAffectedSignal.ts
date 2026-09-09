import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

/** Faixa de sinal atual da ONU do cliente. */
export type MassivaAffectedSignalBucket = 'online' | 'degraded' | 'offline' | 'unknown'

export type MassivaAffectedClientSignal = {
  pppoe: string
  name: string | null
  phone: string | null
  contract: string | null
  bucket: MassivaAffectedSignalBucket
  /** Potência óptica atual (dBm); null quando sem leitura. `0` = LOS (sem luz). */
  rxPower: number | null
  /** true = ONU no ar (bucket 'online'); false = não subiu (offline/degraded/unknown). */
  recovered: boolean
}

export type MassivaAffectedSignalResult = {
  total: number
  recovered: number
  notRecoveredCount: number
  /** Só os que NÃO subiram (offline/degraded/unknown) — foco do modal. */
  notRecovered: MassivaAffectedClientSignal[]
  checkedAt: Date | null
}

function parseClient(raw: Record<string, unknown>): MassivaAffectedClientSignal {
  const bucket = String(raw.bucket ?? 'unknown') as MassivaAffectedSignalBucket
  const rx = raw.rxPower
  return {
    pppoe: String(raw.pppoe ?? '').trim(),
    name: raw.name != null ? String(raw.name).trim() || null : null,
    phone: raw.phone != null ? String(raw.phone).trim() || null : null,
    contract: raw.contract != null ? String(raw.contract).trim() || null : null,
    bucket,
    rxPower: rx == null || rx === '' ? null : Number(rx),
    recovered: bucket === 'online',
  }
}

/**
 * Lista, sob demanda, o sinal atual dos clientes afetados por uma massiva encerrada.
 * Cruza a lista de afetados (por pppoe) com o monitoramento de ONU e com o ERP
 * (nome + telefone). Retorna os que NÃO subiram — base do modal de validação e do
 * futuro disparo de HSM. Só leitura; não dispara nada.
 */
export async function fetchMassivaAffectedSignal(input: {
  protocol: number
  assignmentId: number | null
}): Promise<MassivaAffectedSignalResult> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/affected-clients-signal`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({ protocol: input.protocol, assignmentId: input.assignmentId }),
    },
  )

  if (!response.ok) {
    let message = `Erro ao listar sinal dos clientes afetados: ${response.status}`
    try {
      const parsed = await response.json()
      if (typeof parsed?.message === 'string' && parsed.message.trim() !== '') message = parsed.message
    } catch {
      // mantém a mensagem genérica
    }
    throw new Error(message)
  }

  const parsed = await response.json()
  if (!parsed?.success || parsed?.data == null) {
    throw new Error('Resposta inesperada ao listar sinal dos clientes afetados.')
  }

  const data = parsed.data as Record<string, unknown>
  const checkedAtRaw = typeof data.checkedAt === 'string' ? new Date(data.checkedAt) : null
  const notRecovered = Array.isArray(data.notRecovered)
    ? (data.notRecovered as Record<string, unknown>[]).map(parseClient)
    : []

  return {
    total: Number(data.total ?? 0),
    recovered: Number(data.recovered ?? 0),
    notRecoveredCount: Number(data.notRecoveredCount ?? notRecovered.length),
    notRecovered,
    checkedAt: checkedAtRaw != null && !Number.isNaN(checkedAtRaw.getTime()) ? checkedAtRaw : null,
  }
}
