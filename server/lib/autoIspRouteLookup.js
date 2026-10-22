/**
 * Consulta de rota por PPPoE para o painel "Eventos ao vivo" do AutoISP.
 *
 * Antes, o frontend baixava a base inteira (`GET /api/massiva/connections` sem filtro: ~87k
 * linhas x 59 colunas, dados pessoais de todos os clientes) para montar um índice PPPoE -> rota
 * e usar 5 campos. Agora ele pergunta só pelos PPPoE dos eventos em tela.
 */

export const ROUTE_LOOKUP_MAX_USERNAMES = 500;

/**
 * Mesma regra de `pppoeLookupKeys` em `src/features/autoisp/lib/correlation.ts`: o login do
 * AutoISP casa com `USUÁRIO[CLIENTE]` com ou sem domínio (`fulano@provedor` e `fulano`).
 */
export function pppoeLookupKeys(rawUsername) {
  const t = String(rawUsername ?? '').trim().toLowerCase();
  if (t === '') return [];
  const keys = new Set([t]);
  const at = t.indexOf('@');
  if (at > 0) keys.add(t.slice(0, at));
  return [...keys];
}

/**
 * Valida o corpo da requisição e devolve as chaves (únicas, ordenadas) a consultar.
 * @param {unknown} body
 * @returns {{ ok: true, keys: string[] } | { ok: false, error: string }}
 */
export function parseRouteLookupBody(body) {
  const raw = body?.pppoeUsernames;
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Body deve incluir "pppoeUsernames" (array de strings).' };
  }
  if (raw.length > ROUTE_LOOKUP_MAX_USERNAMES) {
    return {
      ok: false,
      error: `Máximo de ${ROUTE_LOOKUP_MAX_USERNAMES} PPPoE por consulta (recebido: ${raw.length}).`,
    };
  }
  if (raw.some((item) => typeof item !== 'string')) {
    return { ok: false, error: '"pppoeUsernames" deve conter apenas strings.' };
  }

  const keys = new Set();
  for (const username of raw) {
    for (const key of pppoeLookupKeys(username)) keys.add(key);
  }
  return { ok: true, keys: [...keys].sort() };
}

/** Só as colunas necessárias para resolver a rota — sem nome, telefone, e-mail ou endereço. */
export const ROUTE_LOOKUP_COLUMNS = [
  'ID CONEXAO[CLIENTE]',
  'USUÁRIO[CLIENTE]',
  'SPLT.SECUNDARIO',
  'CÓDIGO[SPLT.SECUNDARIO]',
  'SLOT[SPLT.SECUNDARIO]',
  'PORTA EXTRAÍDA[SPLT.SECUNDARIO]',
  'PORTA[SPLT.PRIMARIO]',
  'PORTA SPLITTER[SPLT.SECUNDARIO]',
  'PONTO DE ACESSO CODE',
  'PONTO DE ACESSO',
  'CONCENTRADOR',
];

export function buildRouteLookupQuery(baseQuery) {
  const select = ROUTE_LOOKUP_COLUMNS.map((c) => `base."${c}"`).join(',\n      ');
  return `
    SELECT
      ${select}
    FROM (${baseQuery}) base
    WHERE base."ID CONEXAO[CLIENTE]" IS NOT NULL
      AND LOWER(TRIM(base."USUÁRIO[CLIENTE]"::text)) = ANY($1::text[])
  `;
}
