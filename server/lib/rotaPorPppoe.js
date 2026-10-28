/**
 * Rota física (splitter, porta, AP, OLT) só dos PPPoE pedidos, direto no banco do ERP.
 *
 * Porta da lógica do splitters-service (`RotaPorPppoeService` + `RotaPorPppoeRepository`).
 * Substitui o download da base inteira de conexões (`SPLITTERS_BASE_QUERY` sem filtro: ~87 mil
 * linhas x 59 colunas, com dados pessoais de todos os clientes) quando só se precisa da rota de
 * alguns logins. A consulta parte do PPPoE e sobe a cadeia
 *   conexão -> porta do splitter secundário -> splitter primário (tipo 2, ativo) -> AP -> OLT
 * em vez de montar a base inteira e filtrar depois.
 *
 * Diferenças deliberadas em relação à `SPLITTERS_BASE_QUERY`: ignora porta `deleted` (não devolve
 * rota antiga de quem foi remanejado) e não traz nenhuma coluna do cliente.
 */

/** Limite por chamada: protege o banco e o tamanho da cláusula IN. */
export const ROTA_POR_PPPOE_MAX = 500;

/** minúsculas + trim + variante sem domínio (parte antes do primeiro '@', se houver). */
export function normalizarPppoes(pppoes) {
  const keys = new Set();
  for (const raw of pppoes) {
    if (typeof raw !== 'string') continue;
    const key = raw.trim().toLowerCase();
    if (key === '') continue;
    keys.add(key);
    const at = key.indexOf('@');
    if (at > 0) keys.add(key.slice(0, at));
  }
  return [...keys];
}

/**
 * Valida o corpo `{ pppoes: string[] }` e devolve as chaves normalizadas a consultar.
 * @param {unknown} body
 * @returns {{ ok: true, keys: string[] } | { ok: false, error: string }}
 */
export function parseRotaPorPppoeBody(body) {
  const raw = body?.pppoes;
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Body deve incluir "pppoes" (array de strings).' };
  }
  if (raw.length > ROTA_POR_PPPOE_MAX) {
    return {
      ok: false,
      error: `Máximo de ${ROTA_POR_PPPOE_MAX} PPPoE por consulta (recebido: ${raw.length}).`,
    };
  }
  if (raw.some((item) => typeof item !== 'string')) {
    return { ok: false, error: '"pppoes" deve conter apenas strings.' };
  }
  return { ok: true, keys: normalizarPppoes(raw) };
}

/**
 * Parâmetro $1: text[] de chaves normalizadas. O filtro LOWER(TRIM(user)) não usa índice simples;
 * com no máximo 500 chaves o custo é um varrimento de authentication_contracts (se o EXPLAIN em
 * produção mostrar custo relevante, criar índice em LOWER(TRIM("user"))).
 */
export const ROTA_POR_PPPOE_SQL = `
  SELECT
      ac."user"                      AS "pppoe",
      ac.id                          AS "authenticationId",
      ss.code                        AS "splitterCode",
      ss.title                       AS "splitterTitle",
      asp.port                       AS "splitterPort",
      psp.port                       AS "primaryPort",
      CASE
          WHEN parts.parts_count >= 3
               AND parts.parts[parts.parts_count - 2] ~ '^[0-9]+$'
          THEN parts.parts[parts.parts_count - 2]::int
      END                            AS "slot",
      CASE
          WHEN parts.parts_count >= 2
               AND parts.parts[parts.parts_count - 1] ~ '^[0-9]+$'
          THEN parts.parts[parts.parts_count - 1]::int
      END                            AS "portaExtraida",
      ap.code                        AS "accessPointCode",
      ap.title                       AS "accessPointTitle",
      conc.code                      AS "concentratorCode",
      conc.title                     AS "concentratorTitle"
  FROM authentication_contracts ac
  JOIN authentication_splitter_ports asp
      ON asp.authentication_contract_id = ac.id
     AND asp.deleted IS FALSE
  JOIN authentication_splitters ss
      ON ss.id = asp.authentication_splitter_id
  CROSS JOIN LATERAL (
      SELECT string_to_array(ss.title, '-')                      AS parts,
             array_length(string_to_array(ss.title, '-'), 1)     AS parts_count
  ) parts
  JOIN authentication_splitter_ports psp
      ON psp.children_authentication_splitter_id = ss.id
     AND psp.deleted = FALSE
  JOIN authentication_splitters ps
      ON ps.id = psp.authentication_splitter_id
     AND ps.active = TRUE
     AND ps.deleted = FALSE
     AND ps.type = 2
  LEFT JOIN authentication_access_points ap
      ON ap.id = ps.authentication_access_point_id
  LEFT JOIN authentication_concentrators conc
      ON conc.id = ap.authentication_concentrator_id
  WHERE LOWER(TRIM(ac."user")) = ANY($1::text[])
  ORDER BY ac.id
`;
