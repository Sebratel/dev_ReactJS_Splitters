/**
 * GMUD "Pré-aprovada": disponível nas três categorias (Rede Externa, Sistemas Internos e Externos), mas NÃO passa
 * por aprovação (nem das áreas, nem do Comitê). O protocolo já nasce liberado. Pode ser aberta repetida (a cada N dias, M vezes): cada ocorrência é
 * uma GMUD independente, aberta no Elleven na hora, com a sua data — a ligação entre elas é só informativa
 * (categoria_data.serie). Regras puras, sem banco.
 */

export const TIPO_PRE_APROVADA = 'Pré-aprovada';

export const isPreAprovada = (tipo) => String(tipo ?? '').trim() === TIPO_PRE_APROVADA;

