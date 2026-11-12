/**
 * Regras puras do Comitê da GMUD (sem banco, sem rede) — testáveis isoladamente.
 *
 * Quem decide a aprovação final é quem está na lista "Comitê" das Configurações da GMUD
 * (gerida pelo admin). Basta UM membro decidir. Lista vazia = ninguém decide: a GMUD segue
 * pendente de aprovação do Comitê (não cai de volta para "qualquer um com canApproveGmud").
 */

/** list_key e rótulo do item fixo que agrupa os membros em gmud_config_lists/gmud_team_approvers. */
export const COMMITTEE_LIST_KEY = 'comite';
export const COMMITTEE_ITEM_LABEL = 'Comitê';

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

/** `members`: [{ userEmail }]. */
export function isCommitteeMember(members, email) {
  const target = normalizeEmail(email);
  if (target === '') return false;
  return (Array.isArray(members) ? members : []).some((m) => normalizeEmail(m?.userEmail) === target);
}

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

/** Lança 403 (com mensagem específica) quando `email` não pode decidir como Comitê. */
export function assertCommitteeMember(members, email) {
  const list = Array.isArray(members) ? members : [];
  if (list.length === 0) {
    throw forbidden(
      'O Comitê ainda não tem membros cadastrados, então ninguém pode decidir. Cadastre-os em Configurações da GMUD.',
    );
  }
  if (!isCommitteeMember(list, email)) {
    throw forbidden('Somente membros do Comitê podem decidir sobre a GMUD.');
  }
}

/**
 * A GMUD só fica DISPONÍVEL (agenda, vínculo de massivas, HSM, conclusão, reagendamento) quando o
 * Comitê aprovou E as áreas aprovaram (ou não se aplicam). O Comitê e as áreas decidem em paralelo.
 */
export function isGmudAprovadaFinal(statusComite, statusAreas) {
  if (statusComite !== 'aprovada') return false;
  return statusAreas == null || statusAreas === 'aprovada' || statusAreas === 'nao_aplicavel';
}

/** Mesma regra de `isGmudAprovadaFinal`, como filtro SQL sobre gmud_requests. */
export const APROVADA_FINAL_SQL =
  "(status_comite = 'aprovada' AND status_areas IN ('nao_aplicavel', 'aprovada'))";

/** A requisição altera a decisão do Comitê (aprovada/negada/pendente)? */
export function changesCommitteeDecision(statusComite) {
  return statusComite !== undefined && statusComite !== null && String(statusComite).trim() !== '';
}
