/** Limite conservador do título enviado ao Elleven (o limite real do campo não é conhecido). */
export const MASSIVA_SISTEMA_TITLE_MAX_LENGTH = 120

/**
 * Título do protocolo de massiva de sistema: `<assunto> - <sistema afetado>`.
 * Sem sistema escolhido mantém só o assunto (comportamento anterior). "Outro (especificar)"
 * vira "Outro". Espaços e quebras de linha são normalizados e o resultado é limitado.
 */
export function buildMassivaSistemaTitle(subjectLabel: string, sistemaAfetado: string): string {
  const subject = subjectLabel.replace(/\s+/g, ' ').trim()
  const sistema = sistemaAfetado
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*especificar\s*\)\s*$/i, '')
    .trim()

  const full = sistema === '' ? subject : `${subject} - ${sistema}`
  if (full.length <= MASSIVA_SISTEMA_TITLE_MAX_LENGTH) return full
  return `${full.slice(0, MASSIVA_SISTEMA_TITLE_MAX_LENGTH - 1).trimEnd()}…`
}
