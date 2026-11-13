/**
 * Busca, no Elleven (Postgres do ERP, somente leitura), de clientes corporativos para a GMUD:
 * serve para achar quem não está em splitter (ponto a ponto, fibra apagada). Devolve só o necessário para
 * escolher e identificar (contrato, nome, PPPoE se houver, produtos, ponto de acesso); nada de telefone ou endereço.
 */

export const CORPORATE_INSIGNIAS = ['contrato corporativo', 'contrato corporativo pme'];
export const SEARCH_LIMIT = 20;

const text = (value) => String(value ?? '').trim();

/**
 * Termo de busca → parâmetros. Número = contrato exato (e também como texto); nome/usuário exigem 3+ letras.
 * @returns {{ contractId: number|null, like: string|null } | null}
 */
export function buildSearchParams(raw) {
  const term = text(raw).slice(0, 80);
  if (term === '') return null;
  const isNumber = /^\d{1,12}$/.test(term);
  if (!isNumber && term.length < 3) return null;
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  // Número curto demais (ex.: "3") só vale como contrato exato; sem isso a busca por texto traria ruído.
  return { contractId: isNumber ? Number(term) : null, like: isNumber && term.length < 4 ? null : `%${escaped}%` };
}

export const SEARCH_SQL = `
  SELECT c.id AS contrato,
         cl.name AS nome,
         (SELECT NULLIF(TRIM(a."user"), '') FROM erp.authentication_contracts a
           WHERE a.contract_id = c.id AND a.active IS NOT FALSE ORDER BY a.id LIMIT 1) AS pppoe,
         (SELECT ap.title FROM erp.authentication_contracts a
            JOIN erp.authentication_access_points ap ON ap.id = a.authentication_access_point_id
           WHERE a.contract_id = c.id AND a.active IS NOT FALSE ORDER BY a.id LIMIT 1) AS ponto_acesso,
         (SELECT string_agg(DISTINCT sp.title, ' | ') FROM erp.contract_items ci
            JOIN erp.service_products sp ON sp.id = ci.service_product_id
           WHERE ci.contract_id = c.id AND ci.deleted IS NOT TRUE) AS produtos,
         EXISTS (SELECT 1 FROM erp.authentication_contracts a3
                   JOIN erp.authentication_splitter_ports p ON p.authentication_contract_id = a3.id AND p.deleted IS FALSE
                  WHERE a3.contract_id = c.id) AS em_splitter
    FROM erp.contracts c
    JOIN erp.people cl ON cl.id = c.client_id
    JOIN erp.insignias i ON i.id = cl.insignia_id
   WHERE c.v_status ILIKE 'normal'
     AND LOWER(TRIM(i.title)) = ANY($1::text[])
     AND (
       ($2::bigint IS NOT NULL AND c.id = $2::bigint)
       OR ($3::text IS NOT NULL AND cl.name ILIKE $3)
       OR ($3::text IS NOT NULL AND EXISTS (SELECT 1 FROM erp.authentication_contracts a2 WHERE a2.contract_id = c.id AND a2."user" ILIKE $3))
     )
   ORDER BY cl.name, c.id
   LIMIT ${SEARCH_LIMIT}`;

export function mapClienteRow(r) {
  return {
    contractId: Number(r.contrato),
    nome: text(r.nome),
    pppoe: text(r.pppoe),
    pontoAcesso: text(r.ponto_acesso),
    produtos: text(r.produtos) === '' ? [] : text(r.produtos).split(' | ').map((p) => p.trim()).filter((p) => p !== ''),
    emSplitter: r.em_splitter === true,
    /** Sugestão do tipo, pelo produto: fibra apagada se o contrato tem o produto "fibra apagada". */
    tipoSugerido: /apagada/i.test(text(r.produtos)) ? 'fibra_apagada' : 'ponto_a_ponto',
  };
}

export function createClientesEllevenSearch({ pool }) {
  return {
    /** @returns {Promise<ReturnType<typeof mapClienteRow>[]>} */
    async search(raw) {
      const params = buildSearchParams(raw);
      if (!params) return [];
      const { rows } = await pool.query(SEARCH_SQL, [CORPORATE_INSIGNIAS, params.contractId, params.like]);
      return rows.map(mapClienteRow);
    },
  };
}
