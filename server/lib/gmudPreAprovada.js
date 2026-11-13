/**
 * GMUD "Pré-aprovada": mesmo formulário da rede externa, mas NÃO passa por aprovação (nem das áreas, nem do
 * Comitê). O protocolo já nasce liberado. Pode ser aberta repetida (a cada N dias, M vezes): cada ocorrência é
 * uma GMUD independente, aberta no Elleven na hora, com a sua data — a ligação entre elas é só informativa
 * (categoria_data.serie). Regras puras, sem banco.
 */

export const TIPO_PRE_APROVADA = 'Pré-aprovada';

export const isPreAprovada = (tipo) => String(tipo ?? '').trim() === TIPO_PRE_APROVADA;

/**
 * Erro (texto) se a requisição de criação não pode ser uma Pré-aprovada; null se pode.
 * Só rede externa (categoria nula = legado de rede): sistemas internos/externos dependem de aprovação das áreas.
 */
export function preAprovadaCreateError({ tipo, categoria } = {}) {
  if (!isPreAprovada(tipo)) return null;
  const c = String(categoria ?? '').trim();
  if (c !== '' && c !== 'rede_externa') {
    return 'A GMUD Pré-aprovada só está disponível para Rede Externa.';
  }
  return null;
}
