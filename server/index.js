import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMassivaHistoryStore } from './massivaHistoryStore.js';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const app = express();
const port = process.env.PORT || 3001;
const geogridBaseUrl = (
  process.env.GEOGRID_BASE_URL ||
  process.env.VITE_GEOGRID_BASE_URL ||
  ''
).replace(/\/+$/, '');
const geogridApiKey =
  process.env.GEOGRID_API_KEY ||
  process.env.VITE_GEOGRID_API_KEY ||
  '';
const hubBaseUrl = (
  process.env.HUB_BASE_URL ||
  process.env.VITE_HUB_ORIGIN ||
  'https://sebratel-hub.web.app'
).replace(/\/+$/, '');

app.use(cors()); // Permite qualquer origem em desenvolvimento local
app.use(express.json());

function normalizeNumericSql(expression) {
  return `NULLIF(REPLACE(REGEXP_REPLACE(TRIM(${expression}::text), '[^0-9,.-]', '', 'g'), ',', '.'), '')::double precision`;
}

async function geogridProxyGetJson(relativePath) {
  if (!geogridBaseUrl || !geogridApiKey) {
    const missing = [];
    if (!geogridBaseUrl) missing.push('GEOGRID_BASE_URL');
    if (!geogridApiKey) missing.push('GEOGRID_API_KEY');
    throw new Error(`GeoGrid não configurado no backend (${missing.join(', ')})`);
  }

  const rel = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const response = await fetch(`${geogridBaseUrl}${rel}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'api-key': geogridApiKey,
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`GeoGrid HTTP ${response.status}: ${bodyText}`);
  }

  return response.json();
}

async function hubProxyGet(relativePath, authorizationHeader) {
  const rel = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const headers = {
    Accept: 'application/json',
  };

  if (authorizationHeader && authorizationHeader.trim() !== '') {
    headers.Authorization = authorizationHeader;
  }

  const response = await fetch(`${hubBaseUrl}${rel}`, {
    method: 'GET',
    headers,
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') || 'application/json',
    text,
  };
}

// Configuração do Pool de conexões
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

function isTransientPgError(error) {
  const code = String(error?.code ?? '').toUpperCase();
  const message = String(error?.message ?? '').toLowerCase();
  return (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === '57P01' ||
    message.includes('connection terminated unexpectedly') ||
    message.includes('terminating connection due to administrator command')
  );
}

async function queryWithTransientRetry(queryText, values = [], options = {}) {
  const retries = Number.isFinite(options.retries) ? Number(options.retries) : 1;
  const delayMs = Number.isFinite(options.delayMs) ? Number(options.delayMs) : 180;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await pool.query(queryText, values);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retries && isTransientPgError(error);
      if (!canRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

const massivaHistoryStore = createMassivaHistoryStore({
  host: process.env.MASSIVA_MYSQL_HOST,
  port: process.env.MASSIVA_MYSQL_PORT,
  user: process.env.MASSIVA_MYSQL_USER,
  password: process.env.MASSIVA_MYSQL_PASSWORD,
  database: process.env.MASSIVA_MYSQL_DATABASE,
});

function normalizeMassivaHistorySplitterEntries(entries) {
  const byCode = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const code = String(entry?.code ?? '').trim();
    if (code === '') continue;
    const label = String(entry?.label ?? '').trim() || code;
    if (!byCode.has(code)) byCode.set(code, { code, label });
  }
  return [...byCode.values()];
}

function normalizeMassivaHistoryResults(results) {
  if (!Array.isArray(results)) return [];
  return results.map((result) => ({
    protocol: result?.protocol ?? null,
    assignmentId: result?.assignmentId ?? null,
    accessPointCode: String(result?.accessPointCode ?? '').trim(),
  }));
}

async function fetchCurrentSplitterSnapshotRows() {
  const query = `
    SELECT DISTINCT ON (base."CÓDIGO[SPLT.SECUNDARIO]")
      base."CÓDIGO[SPLT.SECUNDARIO]" AS "splitterCode",
      base."SPLT.SECUNDARIO" AS "splitterTitle",
      COALESCE(NULLIF(TRIM(base."PONTO DE ACESSO CODE"), ''), TRIM(base."PONTO DE ACESSO")) AS "accessPointCode",
      base."ATIVO[SPLT.SECUNDARIO]" AS "active",
      COALESCE(base."CAPACIDADE[SPLT.SECUNDARIO]"::int, 0) AS "outPorts",
      (
        SELECT COUNT(*)::int
        FROM authentication_splitter_ports asp_sub
        WHERE asp_sub.authentication_splitter_id = base."ID[SPLT.SECUNDARIO]"
          AND asp_sub.busy IS TRUE
          AND asp_sub.deleted IS FALSE
      ) AS "busyCount",
      CASE
        WHEN COALESCE(base."CAPACIDADE[SPLT.SECUNDARIO]"::int, 0) > 0
        THEN ROUND((
          (
            SELECT COUNT(*)::int
            FROM authentication_splitter_ports asp_sub
            WHERE asp_sub.authentication_splitter_id = base."ID[SPLT.SECUNDARIO]"
              AND asp_sub.busy IS TRUE
              AND asp_sub.deleted IS FALSE
          )::numeric * 100.0
        ) / NULLIF(base."CAPACIDADE[SPLT.SECUNDARIO]"::int, 0), 2)
        ELSE 0
      END AS "usagePercent",
      NULLIF(TRIM(base."CIDADE[SPLT.SECUNDARIO]"), '') AS "city",
      NULLIF(TRIM(base."RUA[SPLT.SECUNDARIO]"), '') AS "street",
      NULLIF(TRIM(base."TIPO LOCAL"), '') AS "tipoLocal",
      NULLIF(TRIM(base."NOME CONDOMÍNIO"), '') AS "nomeCondominio"
    FROM (${SPLITTERS_BASE_QUERY}) base
    WHERE base."ID[SPLT.SECUNDARIO]" IS NOT NULL
    ORDER BY base."CÓDIGO[SPLT.SECUNDARIO]" ASC, base."PORTA SPLITTER[SPLT.SECUNDARIO]" ASC
  `;

  const result = await pool.query(query);
  return result.rows;
}

const SPLITTERS_BASE_QUERY = `
WITH primary_splitters AS (
    SELECT
        ps.id,
        ps.created::date AS created_date,
        ps.title,
        ps.authentication_access_point_id
    FROM authentication_splitters ps
    WHERE
        ps.active = TRUE
        AND ps.deleted = FALSE
        AND ps.type = 2
),
secondary_splitters AS (
    SELECT
        ss.id,
        ss.active,
        ss.code,
        ss.title,
        ss.created,
        ss.out_ports,
        ss.street,
        ss."number",
        ss.neighborhood,
        ss.city,
        ss.lat,
        ss.lng,
        ss.type,
        parts.parts,
        parts.parts_count,
        CASE
            WHEN parts.parts_count >= 3
                 AND parts.parts[parts.parts_count - 2] ~ '^\\d+$'
            THEN parts.parts[parts.parts_count - 2]::int
            ELSE NULL
        END AS slot,
        CASE
            WHEN parts.parts_count >= 2
                 AND parts.parts[parts.parts_count - 1] ~ '^\\d+$'
            THEN parts.parts[parts.parts_count - 1]::int
            ELSE NULL
        END AS porta_extraida,
        CASE
            WHEN ss.title ~* '\\m(RES|COND|ED)\\.' THEN 'CONDOMÍNIO'
            ELSE 'UNIDADE'
        END AS tipo_local,
        CASE
            WHEN ss.title ~* '\\mRES\\.'  THEN TRIM(REGEXP_REPLACE(ss.title, '.*RES\\. ?', '', 'i'))
            WHEN ss.title ~* '\\mCOND\\.' THEN TRIM(REGEXP_REPLACE(ss.title, '.*COND\\. ?', '', 'i'))
            WHEN ss.title ~* '\\mED\\.'   THEN TRIM(REGEXP_REPLACE(ss.title, '.*ED\\. ?', '', 'i'))
            ELSE NULL
        END AS nome_condominio
    FROM authentication_splitters ss
    CROSS JOIN LATERAL (
        SELECT
            string_to_array(ss.title, '-') AS parts,
            array_length(string_to_array(ss.title, '-'), 1) AS parts_count
    ) parts
)
SELECT
    ps.id                             AS "ID[SPLT.PRIMARIO]",
    ps.created_date                   AS "CRIADO EM:[SPLITTER PRIMARIO]",
    ps.title                          AS "SPLT.PRIMARIO",
    psp.port                          AS "PORTA[SPLT.PRIMARIO]",
    ss.active                         AS "ATIVO[SPLT.SECUNDARIO]",
    ss.id                             AS "ID[SPLT.SECUNDARIO]",
    ss.code                           AS "CÓDIGO[SPLT.SECUNDARIO]",
    ss.title                          AS "SPLT.SECUNDARIO",
    ss.created                        AS "CRIADO EM[SPLT.SECUNDARIO]",
    ssp.port                          AS "PORTA SPLITTER[SPLT.SECUNDARIO]",
    ssp."blocked"                     AS "BLOQUEIO",
    ssp.blocked_description           AS "DESCRICAO_PORTA",
    ss.slot                           AS "SLOT[SPLT.SECUNDARIO]",
    ss.porta_extraida                 AS "PORTA EXTRAÍDA[SPLT.SECUNDARIO]",
    concentrator.title                AS "CONCENTRADOR",
    concentrator.code                 AS "CONCENTRADOR_CODE",
    access_point.code                 AS "PONTO DE ACESSO CODE",
    access_point.title                AS "PONTO DE ACESSO",
    site.title                        AS "SITE",
    contract.id                       AS "CONTRATO ID[CLIENTE]",
    contract.v_stage                  AS "ESTAGIO_CONTRATO",
    contract.v_stage                  AS "ETAPA[CONTRATO]",
    contract.v_status                 AS "STATUS_CONTRATO",
    contract.v_status                 AS "STATUS[CONTRATO]",
    auth_contract.id                  AS "ID CONEXAO[CLIENTE]",
    auth_contract.integration_code    AS "CODIGO_INTEGRACAO",
    auth_contract.lat                 AS "LATITUDE_CLIENTE",
    auth_contract.lng                 AS "LONGITUDE_CLIENTE",
    client.id                         AS "ID[CLIENTE]",
    client.id                         AS "ID CLIENTE",
    auth_contract.user                AS "USUÁRIO[CLIENTE]",
    client.name                       AS "NOME CLIENTE",
    client.neighborhood               AS "BAIRRO",
    client.street                     AS "RUA",
    client."number"                   AS "NUMERO",
    client.address_complement         AS "ENDERECO COMPLE.",
    client.cell_phone_1               AS "CELULAR",
    client.city                       AS "CIDADE CLIENTE",
    client.state                      AS "UF",
    client.email                      AS "EMAIL",
    insig.title                       AS "INSIGNIA_CLIENTE",
    (
      LOWER(TRIM(COALESCE(insig.title, ''))) IN (
        'contrato corporativo',
        'contrato corporativo pme'
      )
    ) AS "CORPORATIVO",
    ss.out_ports                      AS "CAPACIDADE[SPLT.SECUNDARIO]",
    ss.street                         AS "RUA[SPLT.SECUNDARIO]",
    ss."number"                       AS "NÚMERO[SPLT.SECUNDARIO]",
    ss.neighborhood                   AS "BAIRRO[SPLT.SECUNDARIO]",
    ss.city                           AS "CIDADE[SPLT.SECUNDARIO]",
    ss.lat                            AS "LATITUDE[SPLT.SECUNDARIO]",
    ss.lng                            AS "LONGITUDE[SPLT.SECUNDARIO]",
    ss.type                           AS "TIPO EQUIPAMENTO[SPLT.SECUNDARIO]",
    ssp.busy                          AS "OCUPADO:[SPLT.SECUNDARIO]",
    ss.tipo_local                     AS "TIPO LOCAL",
    ss.nome_condominio                AS "NOME CONDOMÍNIO"
FROM primary_splitters ps
LEFT JOIN authentication_splitter_ports psp
    ON psp.authentication_splitter_id = ps.id
   AND psp.deleted = FALSE
LEFT JOIN secondary_splitters ss
    ON ss.id = psp.children_authentication_splitter_id
LEFT JOIN authentication_splitter_ports ssp
    ON ssp.authentication_splitter_id = ss.id
LEFT JOIN authentication_contracts auth_contract
    ON auth_contract.id = ssp.authentication_contract_id
LEFT JOIN contracts contract
    ON contract.id = auth_contract.contract_id
LEFT JOIN people client
    ON client.id = contract.client_id
LEFT JOIN insignias insig
    ON insig.id = client.insignia_id
LEFT JOIN authentication_access_points access_point
    ON access_point.id = ps.authentication_access_point_id
LEFT JOIN authentication_concentrators concentrator
    ON concentrator.id = access_point.authentication_concentrator_id
LEFT JOIN authentication_sites site
    ON site.id = access_point.authentication_site_id
`;

/** Data “operacional” no fuso de São Paulo (alinhada à captura diária). */
const DASHBOARD_KPI_TODAY_SQL = `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date`;

function buildNetworkStatsSql() {
  return `
      SELECT
        eq.catalog_equipment,
        eq.occupied_ports,
        eq.equipment_occupancy_green,
        eq.equipment_occupancy_yellow,
        eq.equipment_occupancy_red,
        olts.olt_count
      FROM (
        SELECT
          COUNT(*)::bigint AS catalog_equipment,
          COALESCE(SUM(sub.busy_count), 0)::bigint AS occupied_ports,
          COUNT(*) FILTER (WHERE sub.occupancy_band = 'green')::bigint AS equipment_occupancy_green,
          COUNT(*) FILTER (WHERE sub.occupancy_band = 'yellow')::bigint AS equipment_occupancy_yellow,
          COUNT(*) FILTER (WHERE sub.occupancy_band = 'red')::bigint AS equipment_occupancy_red
        FROM (
          SELECT
            busy_count,
            out_ports,
            CASE
              WHEN COALESCE(out_ports, 0) <= 0 THEN 'green'
              WHEN busy_count > out_ports THEN 'red'
              WHEN out_ports > 0 AND busy_count = out_ports THEN 'red'
              WHEN (busy_count::numeric * 100 / NULLIF(out_ports, 0)) > 70 THEN 'yellow'
              ELSE 'green'
            END AS occupancy_band
          FROM (
            SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
              base."ID[SPLT.SECUNDARIO]",
              COALESCE(base."CAPACIDADE[SPLT.SECUNDARIO]"::int, 0) AS out_ports,
              (
                SELECT COUNT(*)::int
                FROM authentication_splitter_ports asp_sub
                WHERE asp_sub.authentication_splitter_id = base."ID[SPLT.SECUNDARIO]"
                  AND asp_sub.busy IS TRUE
                  AND asp_sub.deleted IS FALSE
              ) AS busy_count
            FROM (${SPLITTERS_BASE_QUERY}) base
            ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
          ) equip
        ) sub
      ) eq
      CROSS JOIN (
        SELECT COUNT(DISTINCT ac2.code)::bigint AS olt_count
        FROM authentication_concentrators ac2
        WHERE ac2.deleted IS FALSE
          AND ac2.active IS TRUE
          AND ac2.code IS NOT NULL
          AND TRIM(ac2.code) <> ''
      ) olts
    `;
}

function nStats(v) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/** Variação % vs valor da última captura anterior (arredondada a 1 casa). */
function pctChangeVsBaseline(current, baseline) {
  const c = nStats(current);
  const b = nStats(baseline);
  if (b === 0) return c === 0 ? 0 : 100;
  return Number((((c - b) / b) * 100).toFixed(1));
}

/** Fica false se o Postgres recusar DDL (ex.: réplica / sessão read-only, código 25006). */
let dashboardKpiSnapshotWritesEnabled = true;

function isPostgresReadOnlyError(error) {
  const code = error?.code;
  const msg = String(error?.message ?? '');
  return code === '25006' || /\bread-?only\b/i.test(msg);
}

async function ensureDashboardKpiTable(pgPool) {
  if (!dashboardKpiSnapshotWritesEnabled) return;
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS dashboard_kpi_daily (
        snapshot_date date PRIMARY KEY,
        catalog_equipment bigint NOT NULL DEFAULT 0,
        occupied_ports bigint NOT NULL DEFAULT 0,
        equipment_occupancy_green bigint NOT NULL DEFAULT 0,
        equipment_occupancy_yellow bigint NOT NULL DEFAULT 0,
        equipment_occupancy_red bigint NOT NULL DEFAULT 0,
        olt_count bigint NOT NULL DEFAULT 0,
        massiva_open_count bigint NOT NULL DEFAULT 0,
        massiva_affected_open_sum bigint NOT NULL DEFAULT 0,
        captured_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  } catch (error) {
    if (isPostgresReadOnlyError(error)) {
      dashboardKpiSnapshotWritesEnabled = false;
      console.warn(
        '[dashboard-kpi] PostgreSQL só leitura: não é possível criar/gravar dashboard_kpi_daily. ' +
          'O BFF sobe normalmente; tendências % ficam vazias. Use conexão com escrita (primário) para snapshots.',
      );
      return;
    }
    throw error;
  }
}

async function queryCurrentNetworkStatsRow(pgPool) {
  const result = await pgPool.query(buildNetworkStatsSql());
  return result.rows[0];
}

/** Última linha gravada (por dia + horário de captura). Inclui o dia corrente — assim % aparece logo após a 1.ª captura. */
async function fetchLatestDashboardKpiBaseline(pgPool) {
  try {
    const result = await pgPool.query(
      `SELECT *
       FROM dashboard_kpi_daily
       ORDER BY snapshot_date DESC, captured_at DESC
       LIMIT 1`,
    );
    return result.rows[0] ?? null;
  } catch (error) {
    if (error?.code === '42P01') return null;
    throw error;
  }
}

function buildDashboardTrendsPayload(prevRow, statsRow, massivaLive) {
  if (!prevRow) return null;
  return {
    occupied_ports_pct: pctChangeVsBaseline(statsRow.occupied_ports, prevRow.occupied_ports),
    active_splitters_pct: pctChangeVsBaseline(
      statsRow.catalog_equipment,
      prevRow.catalog_equipment,
    ),
    olt_count_pct: pctChangeVsBaseline(statsRow.olt_count, prevRow.olt_count),
    massiva_open_pct: pctChangeVsBaseline(
      massivaLive.openMassivas,
      prevRow.massiva_open_count,
    ),
    massiva_affected_open_pct: pctChangeVsBaseline(
      massivaLive.affectedClientsOpen,
      prevRow.massiva_affected_open_sum,
    ),
  };
}

app.get('/api/olts', async (req, res) => {
  try {
    const accessPointLatSql = normalizeNumericSql('aap.lat');
    const accessPointLngSql = normalizeNumericSql('aap.lng');
    const siteLatSql = normalizeNumericSql('as3.lat');
    const siteLngSql = normalizeNumericSql('as3.lng');

    const query = `
      SELECT DISTINCT ON (ac2.code)
        ac2.id AS "id",
        ac2.code AS "code",
        ac2.title AS "title",
        ac2.server_ip AS "ip",
        ac2.active AS "active",
        COALESCE(aap.slots_number, 0) AS "slotsNumber",
        COALESCE(aap.ports_number, 0) AS "portsNumber",
        COALESCE(aap.ports_first_number, 0) AS "portsFirstNumber",
        COALESCE(aap.integration_code_map, ac2.integration_code) AS "integrationCodeMap",
        COALESCE(aap.postal_code, as3.postal_code) AS "postalCode",
        COALESCE(aap.street, as3.street) AS "street",
        COALESCE(aap.street_number, as3.number) AS "streetNumber",
        COALESCE(aap.neighborhood, as3.neighborhood) AS "neighborhood",
        COALESCE(aap.city, as3.city) AS "city",
        COALESCE(aap.uf, as3.state) AS "uf",
        COALESCE(${accessPointLatSql}, ${siteLatSql}) AS "lat",
        COALESCE(${accessPointLngSql}, ${siteLngSql}) AS "lng"
      FROM authentication_concentrators ac2
      LEFT JOIN authentication_access_points aap
        ON aap.authentication_concentrator_id = ac2.id
        AND aap.deleted IS FALSE
      LEFT JOIN authentication_sites as3
        ON as3.id = COALESCE(aap.authentication_site_id, ac2.authentication_site_id)
        AND as3.deleted IS FALSE
      WHERE
        ac2.deleted IS FALSE
        AND ac2.active IS TRUE
        AND ac2.code IS NOT NULL
        AND TRIM(ac2.code) <> ''
      ORDER BY
        ac2.code ASC,
        CASE
          WHEN ${accessPointLatSql} IS NOT NULL AND ${accessPointLngSql} IS NOT NULL THEN 0
          WHEN ${siteLatSql} IS NOT NULL AND ${siteLngSql} IS NOT NULL THEN 1
          ELSE 2
        END ASC,
        aap.id ASC NULLS LAST
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar OLTs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/splitters/primarios', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        TRIM(base."SPLT.PRIMARIO") AS "title"
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE
        base."SPLT.PRIMARIO" IS NOT NULL
        AND TRIM(base."SPLT.PRIMARIO") <> ''
      ORDER BY "title" ASC
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar splitters primários:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/geogrid/equipamentos/:integrationCode/portas', async (req, res) => {
  try {
    const { integrationCode } = req.params;
    const data = await geogridProxyGetJson(
      `/equipamentos/${encodeURIComponent(integrationCode)}/portas`,
    );
    res.json(data);
  } catch (error) {
    console.error('Erro ao consultar portas na GeoGrid:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

app.get('/api/geogrid/clientes/:idCliente', async (req, res) => {
  try {
    const { idCliente } = req.params;
    const data = await geogridProxyGetJson(
      `/clientes/${encodeURIComponent(idCliente)}`,
    );
    res.json(data);
  } catch (error) {
    console.error('Erro ao consultar cliente na GeoGrid:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

app.get('/api/geogrid/clientesAtendimentos', async (req, res) => {
  try {
    const nomesParam = Array.isArray(req.query.nomes)
      ? req.query.nomes.join(',')
      : String(req.query.nomes ?? '').trim();

    if (nomesParam === '') {
      return res.status(400).json({
        success: false,
        message: 'Informe ao menos um nome em `nomes`.',
      });
    }

    const pagina = Number.parseInt(String(req.query.pagina ?? '1'), 10);
    const registrosPorPagina = Number.parseInt(
      String(req.query.registrosPorPagina ?? '100'),
      10,
    );

    const params = new URLSearchParams({
      nomes: nomesParam,
      pagina: Number.isFinite(pagina) && pagina > 0 ? String(pagina) : '1',
      registrosPorPagina:
        Number.isFinite(registrosPorPagina) && registrosPorPagina > 0
          ? String(registrosPorPagina)
          : '100',
    });

    const data = await geogridProxyGetJson(
      `/clientesAtendimentos?${params.toString()}`,
    );
    res.json(data);
  } catch (error) {
    console.error('Erro ao consultar clientesAtendimentos na GeoGrid:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

app.get('/api/hub/session', async (req, res) => {
  try {
    const upstream = await hubProxyGet('/auth/session', req.headers.authorization);
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.contentType);
    res.send(upstream.text);
  } catch (error) {
    console.error('Erro ao consultar sessao no Hub:', error);
    res.status(502).json({ success: false, error: error.message });
  }
});

app.get('/api/splitters', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const search = req.query.search || '';
    const oltCodes = req.query.olts ? req.query.olts.split(',') : [];
    const statuses = req.query.statuses ? req.query.statuses.split(',') : [];
    const streetSelections = req.query.streets ? req.query.streets.split(',') : [];
    const citySelections = req.query.cities ? req.query.cities.split(',') : [];
    const condominiumSelections = req.query.condominiums
      ? req.query.condominiums.split(',')
      : [];
    const withOpenMassivaRaw = String(req.query.withOpenMassiva || '').trim();
    const corporateClientsRaw = String(req.query.corporateClients || '')
      .trim()
      .toLowerCase();
    const openMassivaSplitterCodes = req.query.openMassivaSplitterCodes
      ? req.query.openMassivaSplitterCodes.split(',')
      : [];
    const primarySplitters = req.query.primarySplitters
      ? req.query.primarySplitters.split(',')
      : [];
    
    const offset = (page - 1) * limit;
    const values = [];
    let currentParam = 1;
    
    let whereClauses = [];
    
    if (search) {
      whereClauses.push(`(
        base."SPLT.SECUNDARIO" ILIKE $${currentParam}
        OR base."CÓDIGO[SPLT.SECUNDARIO]" ILIKE $${currentParam}
        OR base."NOME CLIENTE" ILIKE $${currentParam}
        OR base."USUÁRIO[CLIENTE]" ILIKE $${currentParam}
        OR base."CODIGO_INTEGRACAO" ILIKE $${currentParam}
      )`);
      values.push(`%${search}%`);
      currentParam++;
    }
    
    const normalizedOltCodes = oltCodes
      .map((code) => String(code || '').trim())
      .filter((code) => code !== '');
    if (normalizedOltCodes.length > 0) {
      whereClauses.push(
        `COALESCE(NULLIF(TRIM(base."PONTO DE ACESSO CODE"), ''), TRIM(base."PONTO DE ACESSO")) = ANY($${currentParam})`,
      );
      values.push(normalizedOltCodes);
      currentParam++;
    }

    const normalizedPrimarySplitters = primarySplitters
      .map((title) => String(title || '').trim())
      .filter((title) => title !== '');

    if (normalizedPrimarySplitters.length > 0) {
      whereClauses.push(`TRIM(base."SPLT.PRIMARIO") = ANY($${currentParam})`);
      values.push(normalizedPrimarySplitters);
      currentParam++;
    }

    const normalizedStreetSelections = streetSelections
      .map((street) => String(street || '').trim())
      .filter((street) => street !== '');
    if (normalizedStreetSelections.length > 0) {
      const orParts = normalizedStreetSelections.map(
        (_, idx) => `base."RUA[SPLT.SECUNDARIO]" ILIKE $${currentParam + idx}`,
      );
      whereClauses.push(`(${orParts.join(' OR ')})`);
      for (const street of normalizedStreetSelections) {
        values.push(`%${street}%`);
      }
      currentParam += normalizedStreetSelections.length;
    }

    const normalizedCitySelections = citySelections
      .map((city) => String(city || '').trim())
      .filter((city) => city !== '');
    if (normalizedCitySelections.length > 0) {
      whereClauses.push(`TRIM(base."CIDADE[SPLT.SECUNDARIO]") = ANY($${currentParam})`);
      values.push(normalizedCitySelections);
      currentParam++;
    }

    const normalizedCondominiumSelections = condominiumSelections
      .map((name) => String(name || '').trim())
      .filter((name) => name !== '');
    if (normalizedCondominiumSelections.length > 0) {
      whereClauses.push(`TRIM(base."NOME CONDOMÍNIO") = ANY($${currentParam})`);
      values.push(normalizedCondominiumSelections);
      currentParam++;
    }

    const normalizedOpenMassivaSplitterCodes = openMassivaSplitterCodes
      .map((code) => String(code || '').trim())
      .filter((code) => code !== '');
    const withOpenMassiva = withOpenMassivaRaw === '1'
      ? true
      : withOpenMassivaRaw === '0'
        ? false
        : null;
    if (withOpenMassiva !== null) {
      if (normalizedOpenMassivaSplitterCodes.length === 0) {
        if (withOpenMassiva) {
          whereClauses.push('1 = 0');
        }
      } else {
        whereClauses.push(
          withOpenMassiva
            ? `base."CÓDIGO[SPLT.SECUNDARIO]" = ANY($${currentParam})`
            : `base."CÓDIGO[SPLT.SECUNDARIO]" <> ALL($${currentParam})`,
        );
        values.push(normalizedOpenMassivaSplitterCodes);
        currentParam++;
      }
    }

    if (corporateClientsRaw === 'with' || corporateClientsRaw === 'with-corporate') {
      whereClauses.push('base."CORPORATIVO" IS TRUE');
    } else if (
      corporateClientsRaw === 'without' ||
      corporateClientsRaw === 'without-corporate'
    ) {
      whereClauses.push(`NOT EXISTS (
        SELECT 1
        FROM (${SPLITTERS_BASE_QUERY}) corp_base
        WHERE corp_base."ID[SPLT.SECUNDARIO]" = base."ID[SPLT.SECUNDARIO]"
          AND corp_base."CORPORATIVO" IS TRUE
      )`);
    }

    const normalizedStatuses = statuses
      .map((status) => String(status || '').trim().toLowerCase())
      .filter((status) => ['normal', 'alerta', 'critico', 'excedente'].includes(status));

    let statusSql = '';
    if (normalizedStatuses.length > 0) {
      statusSql = `
        WHERE (
          CASE
            WHEN detailed."CAPACIDADE[SPLT.SECUNDARIO]" IS NULL
              OR detailed."CAPACIDADE[SPLT.SECUNDARIO]" <= 0 THEN 'normal'
            WHEN detailed."BUSY_COUNT" > detailed."CAPACIDADE[SPLT.SECUNDARIO]" THEN 'excedente'
            WHEN detailed."BUSY_COUNT" = detailed."CAPACIDADE[SPLT.SECUNDARIO]" THEN 'critico'
            WHEN (detailed."BUSY_COUNT"::double precision / NULLIF(detailed."CAPACIDADE[SPLT.SECUNDARIO]", 0)) > 0.7 THEN 'alerta'
            ELSE 'normal'
          END
        ) = ANY($${currentParam})
      `;
      values.push(normalizedStatuses);
      currentParam++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
            base.*,
            (
              SELECT COUNT(*)
              FROM authentication_splitter_ports asp_sub
              WHERE asp_sub.authentication_splitter_id = base."ID[SPLT.SECUNDARIO]"
                AND asp_sub.busy IS TRUE
                AND asp_sub.deleted IS FALSE
            ) AS "BUSY_COUNT"
        FROM (${SPLITTERS_BASE_QUERY}) base
        ${whereSql}
        ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      ) detailed
      ${statusSql}
    `;
    
    const countResult = await pool.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].total);

    const query = `
      SELECT *
      FROM (
        SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
            base.*,
            (
              SELECT COUNT(*)
              FROM authentication_splitter_ports asp_sub
              WHERE asp_sub.authentication_splitter_id = base."ID[SPLT.SECUNDARIO]"
                AND asp_sub.busy IS TRUE
                AND asp_sub.deleted IS FALSE
            ) AS "BUSY_COUNT"
        FROM (${SPLITTERS_BASE_QUERY}) base
        ${whereSql}
        ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      ) detailed
      ${statusSql}
      ORDER BY detailed."ID[SPLT.SECUNDARIO]" ASC
      LIMIT $${currentParam} OFFSET $${currentParam + 1}
    `;
    
    const result = await pool.query(query, [...values, limit, offset]);
    
    res.json({
      success: true,
      count: result.rowCount,
      totalCount: totalCount,
      page,
      limit,
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao executar query paginada:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar o banco de dados.',
      error: error.message
    });
  }
});

app.get('/api/splitters/filter-options', async (_req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        NULLIF(TRIM(base."RUA[SPLT.SECUNDARIO]"), '') AS "street",
        NULLIF(TRIM(base."CIDADE[SPLT.SECUNDARIO]"), '') AS "city",
        NULLIF(TRIM(base."NOME CONDOMÍNIO"), '') AS "condominium"
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE base."ID[SPLT.SECUNDARIO]" IS NOT NULL
    `;
    const result = await pool.query(query);

    const streets = new Set();
    const cities = new Set();
    const condominiums = new Set();

    for (const row of result.rows) {
      if (row.street) streets.add(String(row.street));
      if (row.city) cities.add(String(row.city));
      if (row.condominium) condominiums.add(String(row.condominium));
    }

    const sortPtBr = (a, b) => String(a).localeCompare(String(b), 'pt-BR');
    res.json({
      success: true,
      data: {
        streets: [...streets].sort(sortPtBr),
        cities: [...cities].sort(sortPtBr),
        condominiums: [...condominiums].sort(sortPtBr),
      },
    });
  } catch (error) {
    console.error('Erro ao listar opcoes de filtros de splitters:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar opções de filtro.',
      error: error.message,
    });
  }
});

app.get('/api/splitters/access-points', async (_req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        COALESCE(NULLIF(TRIM(base."PONTO DE ACESSO CODE"), ''), TRIM(base."PONTO DE ACESSO")) AS "code",
        COALESCE(NULLIF(TRIM(base."PONTO DE ACESSO"), ''), TRIM(base."PONTO DE ACESSO CODE")) AS "title"
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE
        base."ID[SPLT.SECUNDARIO]" IS NOT NULL
        AND COALESCE(NULLIF(TRIM(base."PONTO DE ACESSO CODE"), ''), TRIM(base."PONTO DE ACESSO")) IS NOT NULL
      ORDER BY "title" ASC, "code" ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar pontos de acesso para filtros de splitters:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/massiva/routes', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        COALESCE(NULLIF(base."PONTO DE ACESSO CODE", ''), base."PONTO DE ACESSO") AS "apCode",
        base."PONTO DE ACESSO" AS "apTitle",
        base."CONCENTRADOR" AS "oltTitle",
        base."CONCENTRADOR_CODE" AS "oltCode",
        COALESCE(base."SLOT[SPLT.SECUNDARIO]", 0) AS "slot",
        COALESCE(base."PORTA EXTRAÍDA[SPLT.SECUNDARIO]", base."PORTA[SPLT.PRIMARIO]", 0) AS "port",
        base."CÓDIGO[SPLT.SECUNDARIO]" AS "splitterCode",
        base."SPLT.SECUNDARIO" AS "splitterTitle"
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE
        base."ID[SPLT.SECUNDARIO]" IS NOT NULL
        AND base."CÓDIGO[SPLT.SECUNDARIO]" IS NOT NULL
        AND TRIM(base."CÓDIGO[SPLT.SECUNDARIO]") <> ''
      ORDER BY
        "apCode" ASC,
        "slot" ASC,
        "port" ASC,
        "splitterCode" ASC
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar rotas para Massiva:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Filtro opcional por AP/slot/porta/códigos.
 * Slot/porta: mesma expressão que GET `/api/massiva/routes` — com COALESCE(…,0);
 * senão, linhas com NULL em `SLOT[SPLT.SECUNDARIO]` não batem com `= 0` (NULL = 0 → false no Postgres)
 * e o batch fica vazio com o que o operador vê no catálogo.
 */
function buildMassivaConnectionsWhere({ apCode, slot, port, splitterCodes } = {}) {
  const values = [];
  const where = ['base."ID CONEXAO[CLIENTE]" IS NOT NULL'];
  let p = 1;

  const ap = String(apCode ?? '').trim();
  if (ap !== '') {
    where.push(
      `COALESCE(NULLIF(base."PONTO DE ACESSO CODE", ''), base."PONTO DE ACESSO") = $${p}`,
    );
    values.push(ap);
    p += 1;
  }

  if (slot != null) {
    const slotN = typeof slot === 'number' ? slot : Number.parseInt(String(slot).trim(), 10);
    if (Number.isFinite(slotN)) {
      where.push(`COALESCE(base."SLOT[SPLT.SECUNDARIO]", 0) = $${p}`);
      values.push(slotN);
      p += 1;
    }
  }

  if (port != null) {
    const portN = typeof port === 'number' ? port : Number.parseInt(String(port).trim(), 10);
    if (Number.isFinite(portN)) {
      where.push(
        `COALESCE(base."PORTA EXTRAÍDA[SPLT.SECUNDARIO]", base."PORTA[SPLT.PRIMARIO]", 0) = $${p}`,
      );
      values.push(portN);
      p += 1;
    }
  }

  const clean = Array.isArray(splitterCodes)
    ? splitterCodes.map((v) => String(v ?? '').trim()).filter((v) => v !== '')
    : [];
  if (clean.length > 0) {
    where.push(`base."CÓDIGO[SPLT.SECUNDARIO]" = ANY($${p})`);
    values.push(clean);
  }

  return { where, values };
}

function pickMassivaRowStrForDedupe(row, keys) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k) && row[k] != null) {
      const t = String(row[k]).trim();
      if (t !== '') return t;
    }
  }
  return '';
}

function massivaRowDedupeKey(row) {
  const id = pickMassivaRowStrForDedupe(row, ['ID CONEXAO[CLIENTE]']);
  const code = pickMassivaRowStrForDedupe(row, ['CÓDIGO[SPLT.SECUNDARIO]']);
  const splitterPort = pickMassivaRowStrForDedupe(row, ['PORTA SPLITTER[SPLT.SECUNDARIO]']);
  return `${id}|${code}|${splitterPort}`;
}

function massivaConnectionsSelectQuery(where) {
  return `
    SELECT base.*
    FROM (${SPLITTERS_BASE_QUERY}) base
    WHERE ${where.join(' AND ')}
    ORDER BY
      base."ID[SPLT.SECUNDARIO]" ASC,
      base."PORTA SPLITTER[SPLT.SECUNDARIO]" ASC
  `;
}

app.get('/api/massiva/connections', async (req, res) => {
  try {
    const apCode = String(req.query.apCode ?? '').trim();
    const slotRaw = String(req.query.slot ?? '').trim();
    const portRaw = String(req.query.port ?? '').trim();
    const splitterCodesRaw = String(req.query.splitterCodes ?? '').trim();

    const slot = slotRaw === '' ? null : slotRaw;
    const port = portRaw === '' ? null : portRaw;
    const splitterCodes = splitterCodesRaw
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '');

    const { where, values } = buildMassivaConnectionsWhere({
      apCode: apCode || undefined,
      slot,
      port,
      splitterCodes: splitterCodes.length > 0 ? splitterCodes : undefined,
    });

    const result = await queryWithTransientRetry(massivaConnectionsSelectQuery(where), values, {
      retries: 1,
      delayMs: 180,
    });
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao listar conexões para Massiva:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/massiva/connections/batch', async (req, res) => {
  try {
    if (!Array.isArray(req.body?.routes)) {
      return res
        .status(400)
        .json({ success: false, error: 'Body deve incluir "routes" (array de rotas).' });
    }

    const routes = req.body.routes;
    if (routes.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }
    if (routes.length > 80) {
      return res
        .status(400)
        .json({ success: false, error: 'Máximo 80 rotas por lote.' });
    }

    // Uma query por (AP, slot, port). Não filtrar `splitterCodes` no SQL: o client usa
    // `filterConnectionsBySplitterCode` (normaliza caixa/acentos) e `apCodesMatch` — o mesmo
    // critério do GET completo. O `= ANY(códigos)` no Postgres é exato e zerava o preview.
    const unique = new Map();
    for (const r of routes) {
      const apCode = String(r?.apCode ?? '').trim();
      const slotN = Number.parseInt(String(r?.slot ?? ''), 10);
      const portN = Number.parseInt(String(r?.port ?? ''), 10);
      if (apCode === '' || !Number.isFinite(slotN) || !Number.isFinite(portN)) {
        return res.status(400).json({
          success: false,
          error: 'Cada rota requer apCode, slot e port numéricos.',
        });
      }
      const key = `${apCode}|${slotN}|${portN}`;
      if (!unique.has(key)) {
        unique.set(key, { apCode, slot: slotN, port: portN });
      }
    }

    const merged = [];
    const seenKeys = new Set();
    for (const route of unique.values()) {
      const { where, values } = buildMassivaConnectionsWhere({
        apCode: route.apCode,
        slot: route.slot,
        port: route.port,
      });
      const result = await queryWithTransientRetry(massivaConnectionsSelectQuery(where), values, {
        retries: 1,
        delayMs: 180,
      });
      for (const row of result.rows) {
        const dk = massivaRowDedupeKey(row);
        if (seenKeys.has(dk)) continue;
        seenKeys.add(dk);
        merged.push(row);
      }
    }
    res.json({ success: true, count: merged.length, data: merged });
  } catch (error) {
    console.error('Erro ao listar conexões (batch) para Massiva:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/massiva/history/open', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.status(503).json({
        success: false,
        message: 'Histórico local de massivas não configurado no MySQL.',
      });
    }

    const payload = {
      operatorEmail: String(req.body?.operatorEmail ?? '').trim(),
      title: String(req.body?.title ?? '').trim(),
      splitterEntries: normalizeMassivaHistorySplitterEntries(req.body?.splitterEntries),
      results: normalizeMassivaHistoryResults(req.body?.results),
      affectedClients: req.body?.affectedClients ?? 0,
      expectedCloseAt: req.body?.expectedCloseAt ?? null,
      openedAt: req.body?.openedAt ?? null,
      autoClosedWithoutClients: req.body?.autoClosedWithoutClients === true,
      closeDescription: String(req.body?.closeDescription ?? '').trim(),
      closedAt: req.body?.closedAt ?? null,
    };

    const result = await massivaHistoryStore.registerOpenBatch(payload);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Erro ao registrar histórico local de abertura de massiva:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao registrar histórico local de abertura de massiva.',
      error: error.message,
    });
  }
});

app.post('/api/massiva/history/close', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.status(503).json({
        success: false,
        message: 'Histórico local de massivas não configurado no MySQL.',
      });
    }

    const result = await massivaHistoryStore.registerClose({
      protocol: req.body?.protocol ?? null,
      assignmentId: req.body?.assignmentId ?? null,
      closeDescription: String(req.body?.closeDescription ?? '').trim(),
      closedAt: req.body?.closedAt ?? null,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Erro ao registrar encerramento local de massiva:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao registrar encerramento local de massiva.',
      error: error.message,
    });
  }
});

app.get('/api/massiva/history/splitter-stats', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const splitterCodes = String(req.query.splitterCodes ?? '')
      .split(',')
      .map((value) => String(value ?? '').trim())
      .filter((value) => value !== '');

    const statsMap = await massivaHistoryStore.getSplitterStats(splitterCodes);
    const data = splitterCodes.map((code) => ({
      splitterCode: code,
      ...(statsMap.get(code) ?? {
        totalTickets: 0,
        openTickets: 0,
        closedTickets: 0,
        affectedClientsTotal: 0,
        latestOpenedAt: null,
      }),
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao consultar histórico local de massivas por splitter:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar histórico local de massivas por splitter.',
      error: error.message,
    });
  }
});

app.get('/api/massiva/history/open-splitter-codes', async (_req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const data = await massivaHistoryStore.getOpenSplitterCodes();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao consultar códigos de splitters com massiva aberta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar códigos de splitters com massiva aberta.',
      error: error.message,
    });
  }
});

app.post('/api/splitters/snapshots/capture', async (_req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.status(503).json({
        success: false,
        message: 'Snapshots de splitters não configurados no MySQL.',
      });
    }

    const splitterRows = await fetchCurrentSplitterSnapshotRows();
    const openSplitterCodes = await massivaHistoryStore.getOpenSplitterCodes();
    const openSet = new Set(openSplitterCodes);
    const snapshotRows = splitterRows.map((row) => ({
      splitterCode: String(row.splitterCode ?? '').trim(),
      splitterTitle: String(row.splitterTitle ?? '').trim(),
      accessPointCode: String(row.accessPointCode ?? '').trim(),
      active: row.active === true,
      outPorts: Number(row.outPorts ?? 0),
      busyCount: Number(row.busyCount ?? 0),
      usagePercent: Number(row.usagePercent ?? 0),
      city: row.city,
      street: row.street,
      tipoLocal: row.tipoLocal,
      nomeCondominio: row.nomeCondominio,
      massivaOpenCount: openSet.has(String(row.splitterCode ?? '').trim()) ? 1 : 0,
      massivaTotalCount: 0,
      capturedAt: new Date().toISOString(),
    }));

    const result = await massivaHistoryStore.upsertSplitterSnapshots(snapshotRows);
    res.json({
      success: true,
      data: {
        ...result,
        snapshotCount: snapshotRows.length,
      },
    });
  } catch (error) {
    console.error('Erro ao capturar snapshots diários de splitters:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao capturar snapshots diários de splitters.',
      error: error.message,
    });
  }
});

app.get('/api/splitters/trends', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const splitterCodes = String(req.query.codes ?? '')
      .split(',')
      .map((value) => String(value ?? '').trim())
      .filter((value) => value !== '');

    const trendsMap = await massivaHistoryStore.getSplitterTrends(splitterCodes);
    const data = splitterCodes.map((code) => ({
      splitterCode: code,
      ...(trendsMap.get(code) ?? {
        label: 'Estavel',
        currentUsagePercent: 0,
        delta7d: 0,
        delta30d: 0,
        capturedAt: null,
      }),
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao consultar tendências dos splitters:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar tendências dos splitters.',
      error: error.message,
    });
  }
});

function resolveSplitterCodeParam(req) {
  const queryCode =
    typeof req.query?.code === 'string' ? req.query.code.trim() : '';
  const paramsCode =
    typeof req.params?.code === 'string' ? req.params.code.trim() : '';
  const raw = queryCode || paramsCode;
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
}

app.get(['/api/splitters/:code/neighbors', '/api/splitters/neighbors'], async (req, res) => {
  try {
    const code = resolveSplitterCodeParam(req);
    if (!code) {
      return res.status(400).json({ success: false, message: 'Parametro code obrigatorio.' });
    }
    const radiusMetersRaw = Number.parseFloat(String(req.query.radius ?? '200'));
    const radiusMeters =
      Number.isFinite(radiusMetersRaw) && radiusMetersRaw > 0
        ? radiusMetersRaw
        : 200;

    const normalizedLatSql = normalizeNumericSql('as4.lat');
    const normalizedLngSql = normalizeNumericSql('as4.lng');

    const query = `
      WITH current_splitter AS (
        SELECT
          as4.id,
          as4.code,
          ${normalizedLatSql} AS lat,
          ${normalizedLngSql} AS lng
        FROM authentication_splitters AS as2
        LEFT JOIN authentication_splitter_ports asp
          ON asp.authentication_splitter_id = as2.id
        LEFT JOIN authentication_splitters as4
          ON as4.id = asp.children_authentication_splitter_id
        WHERE
          as4.code = $1
          AND as2.active IS TRUE
          AND as2.deleted IS FALSE
          AND asp.deleted IS FALSE
          AND as2."type" = 2
          AND as4.lat IS NOT NULL
          AND as4.lng IS NOT NULL
          AND TRIM(as4.lat::text) <> ''
          AND TRIM(as4.lng::text) <> ''
        ORDER BY as4.id ASC
        LIMIT 1
      )
      SELECT DISTINCT ON (as4.id)
        as4.code AS "code",
        as4.title AS "title",
        as4.out_ports AS "outPorts",
        (
          SELECT COUNT(*)
          FROM authentication_splitter_ports asp_sub
          WHERE asp_sub.authentication_splitter_id = as4.id
            AND asp_sub.busy IS TRUE
            AND asp_sub.deleted IS FALSE
        ) AS "busyCount",
        ${normalizedLatSql} AS "lat",
        ${normalizedLngSql} AS "lng",
        (
          6371000 * ACOS(
            LEAST(
              1,
              GREATEST(
                -1,
                COS(RADIANS(cs.lat))
                * COS(RADIANS(${normalizedLatSql}))
                * COS(RADIANS(${normalizedLngSql}) - RADIANS(cs.lng))
                + SIN(RADIANS(cs.lat))
                * SIN(RADIANS(${normalizedLatSql}))
              )
            )
          )
        ) AS "distanceMeters"
      FROM current_splitter cs
      JOIN authentication_splitters AS as2
        ON as2.active IS TRUE
        AND as2.deleted IS FALSE
        AND as2."type" = 2
      JOIN authentication_splitter_ports asp
        ON asp.authentication_splitter_id = as2.id
        AND asp.deleted IS FALSE
      JOIN authentication_splitters as4
        ON as4.id = asp.children_authentication_splitter_id
      WHERE
        as4.id <> cs.id
        AND ${normalizedLatSql} IS NOT NULL
        AND ${normalizedLngSql} IS NOT NULL
        AND (
          6371000 * ACOS(
            LEAST(
              1,
              GREATEST(
                -1,
                COS(RADIANS(cs.lat))
                * COS(RADIANS(${normalizedLatSql}))
                * COS(RADIANS(${normalizedLngSql}) - RADIANS(cs.lng))
                + SIN(RADIANS(cs.lat))
                * SIN(RADIANS(${normalizedLatSql}))
              )
            )
          )
        ) <= $2
      ORDER BY as4.id ASC, "distanceMeters" ASC;
    `;

    const result = await pool.query(query, [code, radiusMeters]);

    res.json({
      success: true,
      radiusMeters,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar splitters vizinhos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get(['/api/splitters-by-code/:code', '/api/splitters-by-code'], async (req, res) => {
  try {
    const code = resolveSplitterCodeParam(req);
    if (!code) {
      return res.status(400).json({ success: false, message: 'Parametro code obrigatorio.' });
    }

    const query = `
      SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
          base.*,
          (
            SELECT COUNT(*)
            FROM authentication_splitter_ports asp_sub
            WHERE asp_sub.authentication_splitter_id = base."ID[SPLT.SECUNDARIO]"
              AND asp_sub.busy IS TRUE
              AND asp_sub.deleted IS FALSE
          ) AS "BUSY_COUNT"
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE base."CÓDIGO[SPLT.SECUNDARIO]" = $1
      ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      LIMIT 1;
    `;

    const result = await queryWithTransientRetry(query, [code], {
      retries: 1,
      delayMs: 180,
    });

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Splitter não encontrado.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar splitter por código:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.get(['/api/splitters/:code/connections', '/api/splitters/connections'], async (req, res) => {
  try {
    const code = resolveSplitterCodeParam(req);
    if (!code) {
      return res.status(400).json({ success: false, message: 'Parametro code obrigatorio.' });
    }
    
    const query = `
      SELECT base.*
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE base."CÓDIGO[SPLT.SECUNDARIO]" = $1
      ORDER BY base."PORTA SPLITTER[SPLT.SECUNDARIO]" ASC;
    `;
    
    const result = await pool.query(query, [code]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao buscar conexões detalhadas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/clientes/:id', async (req, res) => {
  try {
    const authId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(authId) || authId <= 0) {
      return res.status(400).json({ success: false, message: 'ID de cliente inválido.' });
    }

    const query = `
      SELECT base.*
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE base."ID CONEXAO[CLIENTE]" = $1
      ORDER BY base."PORTA SPLITTER[SPLT.SECUNDARIO]" ASC
      LIMIT 1;
    `;

    const result = await pool.query(query, [authId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado.' });
    }

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao buscar cliente por ID:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', async (req, res) => {
  try {
    const row = await queryCurrentNetworkStatsRow(pool);
    const massivaLive = await massivaHistoryStore.getOpenMassivaDashboardKpis();
    const baselineSnapshot = await fetchLatestDashboardKpiBaseline(pool);
    const trends = buildDashboardTrendsPayload(baselineSnapshot, row, massivaLive);

    const oltCount = Number(row.olt_count ?? 0);
    const n = (v) => {
      const x = Number(v ?? 0);
      return Number.isFinite(x) ? x : 0;
    };
    res.json({
      success: true,
      data: {
        catalog_equipment: row.catalog_equipment,
        occupied_ports: row.occupied_ports,
        equipment_occupancy_green: n(row.equipment_occupancy_green),
        equipment_occupancy_yellow: n(row.equipment_occupancy_yellow),
        equipment_occupancy_red: n(row.equipment_occupancy_red),
        olt_count: Number.isFinite(oltCount) ? oltCount : 0,
        /** Legado: nomes antigos do dashboard */
        active_splitters: row.catalog_equipment,
        online_clients: row.occupied_ports,
      },
      /** % vs valores da última linha em `dashboard_kpi_daily` (pode ser captura de hoje = variação desde o snapshot). */
      trends,
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Grava/atualiza o snapshot do dia (fus São Paulo). Usado pelo POST e pelo cron matinal. */
async function captureDashboardKpiDaily() {
  if (!dashboardKpiSnapshotWritesEnabled) {
    throw new Error(
      'Snapshot KPI indisponível: PostgreSQL só leitura. Use DB_HOST/URL com escrita no primário.',
    );
  }
  await ensureDashboardKpiTable(pool);
  const row = await queryCurrentNetworkStatsRow(pool);
  const massiva = await massivaHistoryStore.getOpenMassivaDashboardKpis();

  await pool.query(
    `INSERT INTO dashboard_kpi_daily (
      snapshot_date,
      catalog_equipment,
      occupied_ports,
      equipment_occupancy_green,
      equipment_occupancy_yellow,
      equipment_occupancy_red,
      olt_count,
      massiva_open_count,
      massiva_affected_open_sum,
      captured_at
    ) VALUES (
      ${DASHBOARD_KPI_TODAY_SQL},
      $1, $2, $3, $4, $5, $6, $7, $8,
      NOW()
    )
    ON CONFLICT (snapshot_date) DO UPDATE SET
      catalog_equipment = EXCLUDED.catalog_equipment,
      occupied_ports = EXCLUDED.occupied_ports,
      equipment_occupancy_green = EXCLUDED.equipment_occupancy_green,
      equipment_occupancy_yellow = EXCLUDED.equipment_occupancy_yellow,
      equipment_occupancy_red = EXCLUDED.equipment_occupancy_red,
      olt_count = EXCLUDED.olt_count,
      massiva_open_count = EXCLUDED.massiva_open_count,
      massiva_affected_open_sum = EXCLUDED.massiva_affected_open_sum,
      captured_at = EXCLUDED.captured_at`,
    [
      nStats(row.catalog_equipment),
      nStats(row.occupied_ports),
      nStats(row.equipment_occupancy_green),
      nStats(row.equipment_occupancy_yellow),
      nStats(row.equipment_occupancy_red),
      nStats(row.olt_count),
      massiva.openMassivas,
      massiva.affectedClientsOpen,
    ],
  );

  const dateRow = await pool.query(`SELECT ${DASHBOARD_KPI_TODAY_SQL} AS d`);
  return { snapshot_date: dateRow.rows[0]?.d ?? null };
}

/**
 * Grava/atualiza o snapshot do dia (fus São Paulo) com KPIs atuais + massivas abertas (MySQL).
 * Também roda automaticamente de manhã (cron no fuso America/Sao_Paulo), salvo se desativado no .env.
 */
app.post('/api/dashboard/kpi-daily-snapshot', async (req, res) => {
  try {
    const { snapshot_date: snapshotDate } = await captureDashboardKpiDaily();
    res.json({
      success: true,
      snapshot_date: snapshotDate,
      message: 'Snapshot diário gravado.',
    });
  } catch (error) {
    console.error('Erro ao gravar snapshot de KPIs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function startServer() {
  await ensureDashboardKpiTable(pool);
  if (dashboardKpiSnapshotWritesEnabled) {
    console.log('Tabela dashboard_kpi_daily (PostgreSQL) verificada.');
  }
  if (massivaHistoryStore.configured) {
    await massivaHistoryStore.ensureReady();
    console.log('Histórico local de massivas (MySQL) pronto.');
  } else {
    console.warn('Histórico local de massivas (MySQL) desativado: configure MASSIVA_MYSQL_* no .env.local.');
  }

  app.listen(port, () => {
    console.log(`BFF Local rodando em http://localhost:${port}`);
  });

  const kpiCronDisabled = String(process.env.DASHBOARD_KPI_CRON_DISABLED ?? '').toLowerCase() === 'true';
  const kpiCronExpr = (process.env.DASHBOARD_KPI_CRON ?? '0 6 * * *').trim();
  if (!dashboardKpiSnapshotWritesEnabled) {
    console.log('[dashboard-kpi] Cron não registrado (PostgreSQL só leitura).');
  } else if (!kpiCronDisabled) {
    cron.schedule(
      kpiCronExpr,
      async () => {
        try {
          const { snapshot_date: d } = await captureDashboardKpiDaily();
          console.log(`[dashboard-kpi] Snapshot agendado OK (data operacional: ${d}).`);
        } catch (error) {
          console.error('[dashboard-kpi] Falha no snapshot agendado:', error);
        }
      },
      { timezone: 'America/Sao_Paulo' },
    );
    console.log(
      `[dashboard-kpi] Cron ativo: "${kpiCronExpr}" America/Sao_Paulo (padrão 06:00). Desative com DASHBOARD_KPI_CRON_DISABLED=true.`,
    );
  } else {
    console.log('[dashboard-kpi] Cron desativado (DASHBOARD_KPI_CRON_DISABLED=true).');
  }
}

startServer().catch((error) => {
  console.error('Falha ao iniciar o BFF Local:', error);
  process.exit(1);
});
