import { massivaAfetadosProtocolRequestPath } from '@/features/massiva/api/fetchMassivaAfetadosCounts'
import { bffClient } from '@/shared/api/bffClient'
import { env } from '@/shared/config/env'
import { isJsonObject } from '@/shared/lib/typeGuards'

function firstNonEmptyInResponse(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  if (isJsonObject(value)) {
    const o = value
    for (const k of [
      'name',
      'nome',
      'displayName',
      'userName',
      'username',
      'email',
      'usuario',
    ]) {
      const t = o[k]
      if (typeof t === 'string' && t.trim() !== '') return t.trim()
    }
  }
  return null
}

/**
 * Spring `LocalDateTime` no BFF: aceita `yyyy-MM-dd'T'HH:mm:ss` **sem** sufixo `Z`/offset
 * (ver mensagem: não converte com `Z` → Instant; espera data/hora “local”).
 * Usa os componentes no fuso do browser (o mesmo do `datetime-local` ao fazer `new Date(...)`).
 */
function toLocalDateTimeParamString(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    throw new Error('Data inválida para enviar a previsão.')
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}:${s}`
}

function messageFromResponse(data: unknown): string {
  if (data === undefined || data === null) {
    return 'Data de previsão atualizada com sucesso.'
  }
  if (typeof data === 'string' && data.trim() !== '') {
    return data.trim()
  }
  if (isJsonObject(data)) {
    if (data.success === false) {
      throw new Error(
        `Erro ao atualizar previsão: ${String((data as { message?: unknown }).message ?? 'resposta do servidor')}`,
      )
    }
    const msg = (data as { message?: unknown }).message
    if (msg !== undefined && msg !== null && String(msg).trim() !== '') {
      return String(msg).trim()
    }
  }
  return 'Data de previsão atualizada com sucesso.'
}

export type UpdateMassivaExpectedCloseResult = {
  message: string
  /** Só se o BFF expuser; caso contrário `null`. */
  editorFromResponse: string | null
}

/**
 * PATCH previsão de fechamento.
 * O BFF exige `finishDate` como **query** (`?finishDate=`), não no corpo — paridade com o Flutter.
 * Valor: `LocalDateTime` em texto, sem `Z` (ver `toLocalDateTimeParamString`).
 */
export async function updateMassivaExpectedClose(input: {
  protocol: number
  newExpectedClose: Date
}): Promise<UpdateMassivaExpectedCloseResult> {
  if (input.protocol <= 0) {
    throw new Error('Protocolo inválido para atualizar previsão.')
  }
  const pathBase = massivaAfetadosProtocolRequestPath(input.protocol)
  if (pathBase === '' || env.massivaAfetadosPath.trim() === '') {
    throw new Error('Endpoint de afetados (BFF) não configurado. Defina VITE_MASSIVA_AFETADOS_PATH.')
  }
  const finishDate = toLocalDateTimeParamString(input.newExpectedClose)
  const path = `${pathBase}?${new URLSearchParams({ finishDate })}`
  const last: unknown = await bffClient.request<unknown>({ path, method: 'PATCH' })
  let editorFromResponse: string | null = null
  if (isJsonObject(last)) {
    const o = last
    for (const k of [
      'previsaoEncerramentoAtualizadaPor',
      'usuarioAtualizouPrevisao',
      'usuarioAlteracaoPrevisao',
      'updatedByName',
      'lastModifiedBy',
    ]) {
      const t = o[k]
      if (typeof t === 'string' && t.trim() !== '') {
        editorFromResponse = t.trim()
        break
      }
    }
    if (editorFromResponse === null) {
      for (const k of [
        'usuario',
        'user',
        'responsavel',
        'updatedBy',
        'operator',
      ]) {
        const inner = o[k]
        const found = firstNonEmptyInResponse(inner)
        if (found !== null) {
          editorFromResponse = found
          break
        }
      }
    }
  }
  return {
    message: messageFromResponse(last),
    editorFromResponse,
  }
}
