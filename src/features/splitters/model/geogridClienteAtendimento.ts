import { isJsonObject } from '@/shared/lib/typeGuards'

export type GeogridClienteAtendimento = {
  clientId: string
  nome: string
  atendimentos: GeogridClienteAtendimentoItem[]
}

export type GeogridClienteAtendimentoItem = {
  itemRedeSigla: string | null
  equipamentoSigla: string | null
  equipamentoPorta: number | null
  oltSigla: string | null
  oltPorta: string | null
  atendimentoDrop: boolean | null
}

function pickString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function pickNullableString(value: unknown): string | null {
  const txt = pickString(value)
  return txt === '' ? null : txt
}

function pickNullableInt(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(n) ? n : null
}

function parseDropFlag(value: unknown): boolean | null {
  const txt = pickString(value).toLowerCase()
  if (txt === 's') return true
  if (txt === 'n') return false
  return null
}

function parseAtendimento(raw: unknown): GeogridClienteAtendimentoItem {
  const json = isJsonObject(raw) ? raw : {}
  const itemRede = isJsonObject(json.itemRede) ? json.itemRede : {}
  const equipamento = isJsonObject(json.equipamentoAtendimento)
    ? json.equipamentoAtendimento
    : {}
  const olt = isJsonObject(json.olt) ? json.olt : {}

  return {
    itemRedeSigla: pickNullableString(itemRede.sigla),
    equipamentoSigla: pickNullableString(equipamento.sigla),
    equipamentoPorta: pickNullableInt(equipamento.porta),
    oltSigla: pickNullableString(olt.sigla),
    oltPorta: pickNullableString(olt.porta),
    atendimentoDrop: parseDropFlag(json.atendimentoDrop),
  }
}

export function parseGeogridClientesAtendimentosResponse(
  raw: unknown,
): GeogridClienteAtendimento[] {
  const root = isJsonObject(raw) ? raw : {}
  const registros = Array.isArray(root.registros) ? root.registros : []

  return registros.map((item) => {
    const json = isJsonObject(item) ? item : {}
    const atendimentos = Array.isArray(json.atendimentos) ? json.atendimentos : []

    return {
      clientId: pickString(json.id),
      nome: pickString(json.nome),
      atendimentos: atendimentos.map((entry) => parseAtendimento(entry)),
    }
  })
}
