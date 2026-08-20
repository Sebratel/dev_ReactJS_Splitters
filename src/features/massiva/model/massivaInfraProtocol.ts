/**
 * Tipos de protocolo de infraestrutura que o operador pode abrir junto com a massiva.
 * As constantes do ERP (catálogo/tipo/categorias/equipe/SLA/local) ficam no gateway — aqui só
 * o código (enviado ao BFF), o rótulo do seletor e qual campo manual cada tipo exige.
 */

export type MassivaInfraProtocolCode =
  | 'cto_lo'
  | 'cto_sinal_alto'
  | 'cto_avariada'
  | 'backbone'

/** Seleção no formulário: 'none' = não abrir protocolo de infra. */
export type MassivaInfraProtocolSelection = 'none' | MassivaInfraProtocolCode

/** Campo manual extra exibido quando o tipo é selecionado. */
export type MassivaInfraManualField = 'signal' | 'avaria' | 'site' | null

export type MassivaInfraProtocolOption = {
  code: MassivaInfraProtocolCode
  label: string
  manualField: MassivaInfraManualField
}

export const MASSIVA_INFRA_PROTOCOL_OPTIONS: readonly MassivaInfraProtocolOption[] = [
  { code: 'cto_lo', label: 'CTO LO', manualField: null },
  { code: 'cto_sinal_alto', label: 'CTO Sinal Alto', manualField: 'signal' },
  { code: 'cto_avariada', label: 'CTO Avariada', manualField: 'avaria' },
  { code: 'backbone', label: 'Rompimento de Backbone', manualField: 'site' },
] as const

export function infraProtocolOption(
  code: MassivaInfraProtocolSelection,
): MassivaInfraProtocolOption | null {
  if (code === 'none') return null
  return MASSIVA_INFRA_PROTOCOL_OPTIONS.find((opt) => opt.code === code) ?? null
}
