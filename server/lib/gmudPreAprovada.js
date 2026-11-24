/**
 * GMUD "Pré-aprovada": disponível nas três categorias (Rede Externa, Sistemas Internos e Externos), mas NÃO passa
 * por aprovação (nem das áreas, nem do Comitê). O protocolo já nasce liberado. Pode ser aberta repetida (a cada N dias, M vezes): cada ocorrência é
 * uma GMUD independente, aberta no Elleven na hora, com a sua data — a ligação entre elas é só informativa
 * (categoria_data.serie). Regras puras, sem banco.
 */

export const TIPO_PRE_APROVADA = 'Pré-aprovada';

export const isPreAprovada = (tipo) => String(tipo ?? '').trim() === TIPO_PRE_APROVADA;


/**
 * Quem pode abrir GMUD Pré-aprovada: admin ou quem recebeu a permissão `canOpenGmudPreAprovada`.
 * Pré-aprovada nasce liberada (sem áreas, sem Comitê), por isso é uma permissão à parte.
 * `actor` é o retorno de requireSplittersPermission (perfil em `actor.profile.permissions`).
 */
export const podeAbrirPreAprovada = (actor) => {
  const perms = actor?.profile?.permissions ?? actor?.permissions ?? {};
  return perms.isAdmin === true || perms.canOpenGmudPreAprovada === true;
};

export const MSG_SEM_PERMISSAO_PRE_APROVADA =
  'Você não tem permissão para abrir GMUD pré-aprovada. Peça a um administrador.';
