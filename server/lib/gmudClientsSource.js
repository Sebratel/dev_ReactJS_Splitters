/**
 * De onde saem os clientes de uma GMUD de rede externa: a mesma base de conexões da massiva
 * (SPLITTERS_BASE_QUERY), filtrada pelo site e, quando há afunilamento, por ponto de acesso → slot → PON → splitter.
 * Sem afunilamento vale o site inteiro. Quem não tem PPPoE ou contrato não entra (o gateway exige contrato).
 */

const text = (v) => String(v ?? '').trim();

const toPositiveInt = (v) => {
  const n = Number.parseInt(text(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function createGmudClientsSource({ pool, baseQuery, normalizeEscopoRede, rowMatchesEscopoRede }) {
  const sql = `
    SELECT
      base."CONTRATO ID[CLIENTE]"::text    AS contrato,
      base."USUÁRIO[CLIENTE]"              AS pppoe,
      base."CORPORATIVO"                   AS corporativo,
      base."PONTO DE ACESSO CODE",
      base."PONTO DE ACESSO",
      base."CÓDIGO[SPLT.SECUNDARIO]",
      base."SPLT.SECUNDARIO",
      base."SLOT[SPLT.SECUNDARIO]",
      base."PORTA EXTRAÍDA[SPLT.SECUNDARIO]",
      base."PORTA[SPLT.PRIMARIO]"
    FROM (${baseQuery}) base
    WHERE UPPER(TRIM(base."SITE")) = UPPER(TRIM($1))
      AND base."ID CONEXAO[CLIENTE]" IS NOT NULL
      AND base."OCUPADO:[SPLT.SECUNDARIO]" IS TRUE
  `;

  return {
    /**
     * @returns {Promise<{ ok: true, clients: {contractId:number, pppoe:string, corporate:boolean}[] } | { ok: false, reason: string }>}
     */
    async listClients(gmud) {
      const site = text(gmud?.popSite);
      if (site === '') return { ok: false, reason: 'GMUD sem POP/Site: não há como localizar os clientes.' };
      try {
        const escopo = normalizeEscopoRede(gmud?.categoriaData?.escopoRede);
        const { rows } = await pool.query(sql, [site]);
        const scoped = escopo ? rows.filter((row) => rowMatchesEscopoRede(row, escopo)) : rows;
        const byContract = new Map();
        for (const r of scoped) {
          const contractId = toPositiveInt(r.contrato);
          const pppoe = text(r.pppoe);
          if (contractId === null || pppoe === '' || byContract.has(contractId)) continue;
          byContract.set(contractId, { contractId, pppoe, corporate: r.corporativo === true });
        }
        return { ok: true, clients: [...byContract.values()] };
      } catch (error) {
        return { ok: false, reason: `Falha ao buscar os clientes do escopo: ${error?.message ?? 'erro desconhecido'}` };
      }
    },
  };
}
