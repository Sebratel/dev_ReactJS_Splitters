/**
 * Converte o código interno da OLT para um rótulo legível.
 * Ex: "BNG_01_NHOCE_NE8K" → "OLT 01 - NHOCE"
 *     "BNG_02_BCRCT_CCR1009" → "OLT 02 - BCRCT"
 * Padrão esperado: BNG_{num}_{localidade}_{equipamento}
 * Se o código não corresponder ao padrão, retorna o valor original.
 */
export function formatOltLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const parts = value.split('_')
  if (parts.length >= 3 && parts[0] === 'BNG') {
    return `OLT ${parts[1]} - ${parts[2]}`
  }
  return value
}
