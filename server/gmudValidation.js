/**
 * Funções puras de validação do módulo GMUD — testáveis sem dependência de DB ou HTTP.
 */

/**
 * Valida a janela de execução (dataInicio/dataFim + horaInicio/horaFim).
 * Retorna uma string de erro ou null se a janela for válida.
 *
 * @param {string} dataInicio YYYY-MM-DD
 * @param {string} dataFim    YYYY-MM-DD
 * @param {string} [horaInicio] HH:mm
 * @param {string} [horaFim]    HH:mm
 * @returns {string|null}
 */
export function validateGmudDateWindow(dataInicio, dataFim, horaInicio, horaFim) {
  if (!dataInicio || !dataFim) return null; // campos opcionais — ausência não é erro aqui
  if (dataInicio > dataFim) {
    return 'A data de fim da janela não pode ser anterior à data de início.';
  }
  if (dataInicio === dataFim && horaInicio && horaFim && horaInicio >= horaFim) {
    return 'No mesmo dia, a hora de fim deve ser posterior à hora de início.';
  }
  return null;
}

/**
 * Verifica se o ator tem permissão para editar um registro de GMUD existente.
 * Retorna true se pode editar, false se não pode.
 *
 * Regras:
 * - Registro ainda não existe (novo): qualquer um com canViewGmud pode criar.
 * - Registro existe sem criador registrado: qualquer um com canViewGmud pode editar.
 * - Registro existe com criador: apenas o próprio criador ou um aprovador (canApproveGmud) pode editar.
 *
 * @param {{ createdByEmail?: string|null }|null} existing  Registro atual (null = novo)
 * @param {string} actorEmail  E-mail do ator autenticado
 * @param {boolean} canApprove O ator tem permissão canApproveGmud?
 * @returns {boolean}
 */
export function canEditGmudRequest(existing, actorEmail, canApprove) {
  if (!existing) return true;
  if (!existing.createdByEmail) return true;
  if (existing.createdByEmail === actorEmail) return true;
  if (canApprove) return true;
  return false;
}

/**
 * Mensagem de erro segura para respostas HTTP.
 * Em produção, erros inesperados (5xx) não expõem detalhes internos.
 * Erros operacionais (4xx) sempre mostram a mensagem original.
 *
 * @param {unknown} error
 * @param {string}  fallback  Mensagem genérica para 5xx em produção
 * @param {boolean} [isProduction]  Padrão: NODE_ENV === 'production'
 * @returns {string}
 */
export function safeErrorMessage(error, fallback = 'Ocorreu um erro interno.', isProduction = process.env.NODE_ENV === 'production') {
  const statusCode = Number(error?.statusCode ?? 500);
  const isOperational = Number.isFinite(statusCode) && statusCode < 500;
  if (isOperational || !isProduction) {
    return error instanceof Error ? error.message : fallback;
  }
  return fallback;
}
