/**
 * Utilitários puros para parsing de respostas da GeoGrid.
 * Sem dependências de HTTP — testável de forma isolada.
 */
import {
  normalizeClientName,
  type ProjectedSignal,
} from '@/features/onu/model/projectedSignal'

export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

export type GeogridAtendimento = {
  potencia?: {
    potenciaInicial?: unknown
    potenciaFinal?: unknown
    perdaTotal?: unknown
  } | null
  olt?: { sigla?: unknown; porta?: unknown } | null
  equipamentoAtendimento?: { sigla?: unknown; porta?: unknown } | null
}

export type GeogridRegistro = {
  nome?: unknown
  atendimentos?: GeogridAtendimento[] | null
}

export function atToProjected(nome: string | null, at: GeogridAtendimento): ProjectedSignal {
  return {
    matchedName: nome,
    projectedRxPower: toNum(at.potencia?.potenciaFinal),
    initialPower: toNum(at.potencia?.potenciaInicial),
    lossTotal: toNum(at.potencia?.perdaTotal),
    oltSigla: toText(at.olt?.sigla),
    oltPorta: toText(at.olt?.porta),
    equipamentoSigla: toText(at.equipamentoAtendimento?.sigla),
    porta: toText(at.equipamentoAtendimento?.porta),
  }
}

/**
 * Escolhe a projeção de sinal para um cliente a partir dos registros brutos da
 * GeoGrid, usando o nome normalizado como chave.
 *
 * Regras de segurança:
 *  1. Apenas registros com nome normalizado idêntico ao alvo são considerados.
 *     Não há fallback para registros de outros clientes.
 *  2. Varre TODOS os registros do nome — a GeoGrid pode retornar vários, alguns
 *     sem atendimentos (vazios) antes do que tem a potência calculada.
 *  3. Se o mesmo nome tiver mais de um valor de `potenciaFinal` distinto
 *     (homônimos ou múltiplos enlaces), retorna o primeiro com `ambiguous: true`
 *     para que a UI exiba aviso em vez de disparar um alarme potencialmente falso.
 */
export function pickProjected(
  registros: GeogridRegistro[],
  target: string,
): ProjectedSignal | null {
  const matching = registros.filter(
    (r) => normalizeClientName(String(r?.nome ?? '')) === target,
  )
  if (matching.length === 0) return null

  const distinctValues = new Set<number>()
  let firstValid: ProjectedSignal | null = null

  for (const reg of matching) {
    const nome = toText(reg.nome)
    const ats = Array.isArray(reg.atendimentos) ? reg.atendimentos : []
    for (const at of ats) {
      const pf = toNum(at?.potencia?.potenciaFinal)
      if (pf !== null) {
        distinctValues.add(pf)
        if (firstValid === null) firstValid = atToProjected(nome, at)
      }
    }
  }

  if (firstValid === null) return null

  return distinctValues.size > 1 ? { ...firstValid, ambiguous: true } : firstValid
}
