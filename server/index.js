import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMassivaHistoryStore } from './massivaHistoryStore.js';
import { buildSplittersFilterContext } from './splittersFilterContext.js';
import {
  buildSplitterOperationalScore,
  compareRiskEntries,
} from './splittersOperationalScore.js';
import logger, { captureConsole } from './logger.js';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

captureConsole();

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

app.use((req, res, next) => {
  const startAt = Date.now();
  logger.info('http_request_start', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.on('finish', () => {
    logger.info('http_request_end', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startAt,
    });
  });

  next();
});

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
    title: String(result?.title ?? '').trim(),
    affectedClients: result?.affectedClients ?? null,
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
      COALESCE(base."BUSY_COUNT"::int, 0) AS "busyCount",
      CASE
        WHEN COALESCE(base."CAPACIDADE[SPLT.SECUNDARIO]"::int, 0) > 0
        THEN ROUND((
          COALESCE(base."BUSY_COUNT"::numeric, 0) * 100.0
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
        CASE
            WHEN regexp_match(split_part(ss.title, '/', 1), '(\\d+)\\D+(\\d+)$') IS NOT NULL
            THEN (regexp_match(split_part(ss.title, '/', 1), '(\\d+)\\D+(\\d+)$'))[1]::int
            ELSE NULL
        END AS slot,
        CASE
            WHEN regexp_match(split_part(ss.title, '/', 1), '(\\d+)\\D+(\\d+)$') IS NOT NULL
            THEN (regexp_match(split_part(ss.title, '/', 1), '(\\d+)\\D+(\\d+)$'))[2]::int
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
),
splitter_corporate AS (
    SELECT
        ssp_elem.authentication_splitter_id AS splitter_id,
        BOOL_OR(
            LOWER(TRIM(COALESCE(ins_c.title, ''))) IN (
                'contrato corporativo',
                'contrato corporativo pme'
            )
        ) AS has_corporate
    FROM authentication_splitter_ports ssp_elem
    INNER JOIN authentication_contracts auth_cc ON auth_cc.id = ssp_elem.authentication_contract_id
    INNER JOIN contracts ctr_c ON ctr_c.id = auth_cc.contract_id
    INNER JOIN people cl_c ON cl_c.id = ctr_c.client_id
    LEFT JOIN insignias ins_c ON ins_c.id = cl_c.insignia_id
    WHERE ssp_elem.deleted IS FALSE
    GROUP BY ssp_elem.authentication_splitter_id
),
splitter_busy AS (
    SELECT
        authentication_splitter_id AS splitter_id,
        COUNT(*)::int AS busy_count
    FROM authentication_splitter_ports
    WHERE deleted IS FALSE
      AND busy IS TRUE
    GROUP BY authentication_splitter_id
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
    ss.nome_condominio                AS "NOME CONDOMÍNIO",
    COALESCE(scorp.has_corporate, FALSE) AS "TEM_CORPORATIVO_SPLITTER",
    COALESCE(sbusy.busy_count, 0) AS "BUSY_COUNT"
FROM primary_splitters ps
LEFT JOIN authentication_splitter_ports psp
    ON psp.authentication_splitter_id = ps.id
   AND psp.deleted = FALSE
LEFT JOIN secondary_splitters ss
    ON ss.id = psp.children_authentication_splitter_id
LEFT JOIN splitter_corporate scorp
    ON scorp.splitter_id = ss.id
LEFT JOIN splitter_busy sbusy
    ON sbusy.splitter_id = ss.id
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
              COALESCE(base."BUSY_COUNT"::int, 0) AS busy_count
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

/**
 * Executa funções async com limite de concorrência (evita fila sequencial longa no PG/MySQL).
 */
async function runWithConcurrency(taskFns, concurrency) {
  if (taskFns.length === 0) return [];
  const results = new Array(taskFns.length);
  let index = 0;
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= taskFns.length) break;
      results[i] = await taskFns[i]();
    }
  }
  const n = Math.min(Math.max(1, concurrency), taskFns.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

app.get('/api/splitters/operational-priority', async (req, res) => {
  try {
    const PAGE_SIZE =
      Number.parseInt(process.env.OPERATIONAL_PRIORITY_PAGE_SIZE || '2500', 10) || 2500;
    const PAGE_CONCURRENCY =
      Number.parseInt(process.env.OPERATIONAL_PRIORITY_PAGE_CONCURRENCY || '6', 10) || 6;
    const MASSIVA_CHUNK =
      Number.parseInt(process.env.OPERATIONAL_PRIORITY_MASSIVA_CHUNK || '800', 10) || 800;
    const MASSIVA_CONCURRENCY =
      Number.parseInt(process.env.OPERATIONAL_PRIORITY_MASSIVA_CONCURRENCY || '4', 10) || 4;

    const ctx = buildSplittersFilterContext(req, SPLITTERS_BASE_QUERY);
    const { whereSql, values, statusSql, currentParam } = ctx;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
            base.*
        FROM (${SPLITTERS_BASE_QUERY}) base
        ${whereSql}
        ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      ) detailed
      ${statusSql}
    `;

    const countResult = await pool.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT *
      FROM (
        SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
            base.*
        FROM (${SPLITTERS_BASE_QUERY}) base
        ${whereSql}
        ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      ) detailed
      ${statusSql}
      ORDER BY detailed."ID[SPLT.SECUNDARIO]" ASC
      LIMIT $${currentParam} OFFSET $${currentParam + 1}
    `;

    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const pageTasks = [];
    for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
      const offset = (pageNum - 1) * PAGE_SIZE;
      pageTasks.push(() =>
        pool.query(dataQuery, [...values, PAGE_SIZE, offset]),
      );
    }
    const pageResults = await runWithConcurrency(pageTasks, PAGE_CONCURRENCY);
    const allRows = pageResults.flatMap((r) => r.rows);

    const codes = [
      ...new Set(
        allRows
          .map((r) => String(r['CÓDIGO[SPLT.SECUNDARIO]'] ?? '').trim())
          .filter(Boolean),
      ),
    ];

    const massivaByCode = new Map();
    const massivaTasks = [];
    for (let i = 0; i < codes.length; i += MASSIVA_CHUNK) {
      const slice = codes.slice(i, i + MASSIVA_CHUNK);
      massivaTasks.push(() => massivaHistoryStore.getSplitterStats(slice));
    }
    const massivaChunkResults = await runWithConcurrency(
      massivaTasks,
      MASSIVA_CONCURRENCY,
    );
    for (const batchMap of massivaChunkResults) {
      for (const [k, v] of batchMap.entries()) {
        massivaByCode.set(k, v);
      }
    }

    const emptyMassiva = {
      totalTickets: 0,
      openTickets: 0,
      closedTickets: 0,
      affectedClientsTotal: 0,
      latestOpenedAt: null,
    };

    const scored = allRows.map((row) => {
      const code = String(row['CÓDIGO[SPLT.SECUNDARIO]'] ?? '').trim();
      const outPorts = Number(row['CAPACIDADE[SPLT.SECUNDARIO]'] ?? 0) || 0;
      const busyCount = Number(row['BUSY_COUNT'] ?? 0) || 0;
      const splitter = {
        code,
        title: String(row['SPLT.SECUNDARIO'] ?? ''),
        busyCount,
        outPorts,
      };
      const massivaStats = massivaByCode.get(code) ?? emptyMassiva;
      const operationalScore = buildSplitterOperationalScore(splitter, massivaStats);
      return { splitter, massivaStats, operationalScore };
    });

    scored.sort(compareRiskEntries);
    /** Top 5 por pontuação no universo filtrado (inclui «Estável»), para a fila aparecer mesmo sem massivas no MySQL. */
    const top = scored.slice(0, 5);

    const data = top.map((s) => ({
      splitter: {
        code: s.splitter.code,
        title: s.splitter.title,
        busyCount: s.splitter.busyCount,
        outPorts: s.splitter.outPorts,
      },
      massivaStats: s.massivaStats,
      operationalScore: s.operationalScore,
    }));

    res.json({
      success: true,
      totalCount,
      scannedCount: allRows.length,
      truncated: allRows.length < totalCount,
      massivaSource: massivaHistoryStore.configured ? 'mysql-history' : 'none',
      data,
    });
  } catch (error) {
    console.error('Erro na fila operacional:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao calcular prioridade operacional.',
      error: error.message,
    });
  }
});

app.get('/api/splitters', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    const offset = (page - 1) * limit;
    const ctx = buildSplittersFilterContext(req, SPLITTERS_BASE_QUERY);
    const { whereSql, values, statusSql, currentParam } = ctx;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
            base.*
        FROM (${SPLITTERS_BASE_QUERY}) base
        ${whereSql}
        ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      ) detailed
      ${statusSql}
    `;

    const dataQuery = `
      SELECT *
      FROM (
        SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
            base.*
        FROM (${SPLITTERS_BASE_QUERY}) base
        ${whereSql}
        ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      ) detailed
      ${statusSql}
      ORDER BY detailed."ID[SPLT.SECUNDARIO]" ASC
      LIMIT $${currentParam} OFFSET $${currentParam + 1}
    `;

    const dataParams = [...values, limit, offset];
    const [countResult, result] = await Promise.all([
      pool.query(countQuery, values),
      pool.query(dataQuery, dataParams),
    ]);
    const totalCount = parseInt(countResult.rows[0].total, 10);

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
    // Uma query por (AP, slot, port). Não filtrar `splitterCodes` no SQL: o client usa
    // `filterConnectionsBySplitterCode` (normaliza caixa/acentos) e `apCodesMatch` — o mesmo
    // critério do GET completo. O `= ANY(códigos)` no Postgres é exato e zerava o preview.
    const unique = new Map();
    const invalidIndexes = [];
    for (const [routeIndex, r] of routes.entries()) {
      const apCode = String(r?.apCode ?? r?.apId ?? '').trim();
      const slotN = Number.parseInt(String(r?.slot ?? r?.slotOlt ?? ''), 10);
      const rawPort = r?.port ?? r?.porta ?? r?.portOlt;
      const portN = Number.parseInt(String(rawPort ?? ''), 10);
      if (apCode === '' || !Number.isFinite(slotN) || !Number.isFinite(portN)) {
        invalidIndexes.push(routeIndex);
        continue;
      }
      const key = `${apCode}|${slotN}|${portN}`;
      if (!unique.has(key)) {
        unique.set(key, { apCode, slot: slotN, port: portN });
      }
    }

    if (unique.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma rota válida recebida no lote.',
        invalidRouteIndexes: invalidIndexes,
      });
    }

    const merged = [];
    const seenKeys = new Set();
    const uniqueRoutes = Array.from(unique.values());
    const chunkSizeRaw = Number.parseInt(
      String(process.env.MASSIVA_BATCH_ROUTE_CHUNK_SIZE ?? '80'),
      10,
    );
    const chunkSize =
      Number.isFinite(chunkSizeRaw) && chunkSizeRaw > 0 ? chunkSizeRaw : 80;
    let chunksProcessed = 0;

    for (let index = 0; index < uniqueRoutes.length; index += chunkSize) {
      const chunk = uniqueRoutes.slice(index, index + chunkSize);
      chunksProcessed += 1;

      const chunkResults = await Promise.all(
        chunk.map(async (route) => {
          const { where, values } = buildMassivaConnectionsWhere({
            apCode: route.apCode,
            slot: route.slot,
            port: route.port,
          });
          return queryWithTransientRetry(massivaConnectionsSelectQuery(where), values, {
            retries: 1,
            delayMs: 180,
          });
        }),
      );

      for (const result of chunkResults) {
        for (const row of result.rows) {
          const dk = massivaRowDedupeKey(row);
          if (seenKeys.has(dk)) continue;
          seenKeys.add(dk);
          merged.push(row);
        }
      }
    }
    res.json({
      success: true,
      count: merged.length,
      data: merged,
      ignoredInvalidRoutes: invalidIndexes.length,
      invalidRouteIndexes: invalidIndexes,
      totalRoutesReceived: routes.length,
      uniqueRoutesProcessed: uniqueRoutes.length,
      chunkSize,
      chunksProcessed,
    });
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

app.get('/api/massiva/history/list', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const statusRaw = String(req.query.status ?? '').trim().toLowerCase();
    const status = statusRaw === 'aberta' || statusRaw === 'encerrada' ? statusRaw : null;
    const startDateText = String(req.query.startDate ?? '').trim();
    const endDateText = String(req.query.endDate ?? '').trim();
    const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 3000;

    const startDate = startDateText !== '' ? new Date(startDateText) : null;
    const endDate = endDateText !== '' ? new Date(endDateText) : null;

    const data = await massivaHistoryStore.getHistoryList({
      status,
      startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate.toISOString() : null,
      endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate.toISOString() : null,
      limit,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao consultar listagem histórica local de massivas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar listagem histórica local de massivas.',
      error: error.message,
    });
  }
});

async function captureSplitterSnapshots() {
  if (!massivaHistoryStore.configured) {
    throw new Error('Snapshots de splitters não configurados no MySQL.');
  }

  const splitterRows = await fetchCurrentSplitterSnapshotRows();
  const openSplitterCodes = await massivaHistoryStore.getOpenSplitterCodes();
  const openSet = new Set(openSplitterCodes);
  const splitterCodes = splitterRows
    .map((row) => String(row.splitterCode ?? '').trim())
    .filter((code) => code !== '');
  const statsBySplitter = await massivaHistoryStore.getSplitterStats(splitterCodes);
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
    massivaOpenCount:
      statsBySplitter.get(String(row.splitterCode ?? '').trim())?.openTickets ??
      (openSet.has(String(row.splitterCode ?? '').trim()) ? 1 : 0),
    massivaTotalCount:
      statsBySplitter.get(String(row.splitterCode ?? '').trim())?.totalTickets ?? 0,
    capturedAt: new Date().toISOString(),
  }));

  const result = await massivaHistoryStore.upsertSplitterSnapshots(snapshotRows);
  return {
    ...result,
    snapshotCount: snapshotRows.length,
  };
}

app.post('/api/splitters/snapshots/capture', async (_req, res) => {
  try {
    const data = await captureSplitterSnapshots();
    res.json({
      success: true,
      data,
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

/**
 * Painel da rede: um GET por lote — mesmas fontes que `/api/splitters/trends` +
 * `/api/massiva/history/splitter-stats`, mas metade das idas à rede no cliente.
 */
app.get('/api/splitters/intelligence-batch', async (req, res) => {
  try {
    const splitterCodes = String(req.query.codes ?? '')
      .split(',')
      .map((value) => String(value ?? '').trim())
      .filter((value) => value !== '');

    if (!massivaHistoryStore.configured) {
      const emptyTrend = {
        label: 'Estavel',
        currentUsagePercent: 0,
        delta7d: 0,
        delta30d: 0,
        capturedAt: null,
      };
      const emptyMassiva = {
        totalTickets: 0,
        openTickets: 0,
        closedTickets: 0,
        affectedClientsTotal: 0,
        latestOpenedAt: null,
      };
      return res.json({
        success: true,
        trends: splitterCodes.map((splitterCode) => ({ splitterCode, ...emptyTrend })),
        massiva: splitterCodes.map((splitterCode) => ({ splitterCode, ...emptyMassiva })),
      });
    }

    const [trendsMap, statsMap] = await Promise.all([
      massivaHistoryStore.getSplitterTrends(splitterCodes),
      massivaHistoryStore.getSplitterStats(splitterCodes),
    ]);

    const trends = splitterCodes.map((code) => ({
      splitterCode: code,
      ...(trendsMap.get(code) ?? {
        label: 'Estavel',
        currentUsagePercent: 0,
        delta7d: 0,
        delta30d: 0,
        capturedAt: null,
      }),
    }));

    const massiva = splitterCodes.map((code) => ({
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
      trends,
      massiva,
    });
  } catch (error) {
    console.error('Erro ao consultar lote de inteligência dos splitters:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar lote de inteligência dos splitters.',
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

function parseIsoDateParam(rawValue, fallback) {
  const txt = String(rawValue ?? '').trim();
  if (txt === '') return fallback;
  const parsed = new Date(txt);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

app.get('/api/intelligence/maintenance-by-splitter', async (req, res) => {
  try {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    defaultStart.setHours(0, 0, 0, 0);
    const defaultEnd = new Date(now);
    defaultEnd.setHours(23, 59, 59, 999);

    const start = parseIsoDateParam(req.query.start, defaultStart);
    const end = parseIsoDateParam(req.query.end, defaultEnd);
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos: start precisa ser menor ou igual a end.',
      });
    }

    const catalogsRaw = String(req.query.catalogs ?? '').trim();
    const catalogs = catalogsRaw
      ? catalogsRaw.split(',').map((value) => value.trim()).filter((value) => value !== '')
      : ['Equipe reparo', 'Equipe tecnologia'];
    const splitterCodes = String(req.query.splitterCodes ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '');
    const limitRaw = Number.parseInt(String(req.query.limit ?? '5000'), 10);
    const rowsLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20000) : 5000;

    const query = `
      WITH maintenance_raw AS (
        SELECT
          ai.protocol::bigint AS protocol,
          a.id::bigint AS assignment_id,
          a.title::text AS solicitation_title,
          a.created AS created_at,
          ai.client_id::bigint AS client_id,
          p.name::text AS client_name,
          cs.title::text AS catalog_title,
          ss.title::text AS solution_title,
          t.title::text AS incident_status
        FROM assignments a
        INNER JOIN assignment_incidents ai
          ON ai.assignment_id = a.id
        INNER JOIN catalog_services cs
          ON cs.id = ai.catalog_service_id
        LEFT JOIN people p
          ON p.id = ai.client_id
        LEFT JOIN solicitation_solutions ss
          ON ss.id = ai.solicitation_solution_id
        LEFT JOIN incident_status t
          ON t.id = ai.incident_status_id
        WHERE
          a.created >= $1
          AND a.created <= $2
          AND cs.title = ANY($3::text[])
      ),
      splitter_client_map AS (
        SELECT DISTINCT ON (base."ID[CLIENTE]")
          base."ID[CLIENTE]"::bigint AS client_id,
          TRIM(base."CÓDIGO[SPLT.SECUNDARIO]") AS splitter_code,
          COALESCE(
            NULLIF(TRIM(base."SPLT.SECUNDARIO"), ''),
            TRIM(base."CÓDIGO[SPLT.SECUNDARIO]")
          ) AS splitter_title,
          COALESCE(
            NULLIF(TRIM(base."PONTO DE ACESSO CODE"), ''),
            NULLIF(TRIM(base."PONTO DE ACESSO"), ''),
            ''
          ) AS access_point_code
        FROM (${SPLITTERS_BASE_QUERY}) base
        WHERE
          base."ID[CLIENTE]" IS NOT NULL
          AND base."CÓDIGO[SPLT.SECUNDARIO]" IS NOT NULL
          AND TRIM(base."CÓDIGO[SPLT.SECUNDARIO]") <> ''
        ORDER BY
          base."ID[CLIENTE]",
          base."ATIVO[SPLT.SECUNDARIO]" DESC,
          base."ID CONEXAO[CLIENTE]" DESC
      ),
      enriched AS (
        SELECT
          m.protocol,
          m.assignment_id,
          m.created_at,
          m.client_id,
          m.catalog_title,
          m.solution_title,
          m.incident_status,
          map.splitter_code,
          map.splitter_title,
          map.access_point_code
        FROM maintenance_raw m
        LEFT JOIN splitter_client_map map
          ON map.client_id = m.client_id
      )
      SELECT
        COALESCE(splitter_code, 'SEM_MAPEAMENTO') AS "splitterCode",
        COALESCE(splitter_title, 'Sem splitter mapeado') AS "splitterTitle",
        COALESCE(access_point_code, '') AS "accessPointCode",
        COUNT(*)::int AS "totalMaintenances",
        COUNT(DISTINCT protocol)::int AS "uniqueProtocols",
        COUNT(DISTINCT client_id)::int AS "uniqueClients",
        COUNT(*) FILTER (
          WHERE lower(COALESCE(incident_status, '')) LIKE '%abert%'
        )::int AS "openMaintenances",
        COUNT(*) FILTER (
          WHERE lower(COALESCE(solution_title, '')) LIKE '%romp%'
        )::int AS "rompimentoCount",
        COUNT(*) FILTER (
          WHERE lower(COALESCE(solution_title, '')) LIKE '%flat%'
        )::int AS "trocaFlatCount",
        MAX(created_at) AS "latestCreatedAt"
      FROM enriched
      ${splitterCodes.length > 0 ? 'WHERE splitter_code = ANY($4::text[])' : ''}
      GROUP BY
        COALESCE(splitter_code, 'SEM_MAPEAMENTO'),
        COALESCE(splitter_title, 'Sem splitter mapeado'),
        COALESCE(access_point_code, '')
      ORDER BY "totalMaintenances" DESC, "splitterCode" ASC
      LIMIT ${rowsLimit};
    `;

    const values = splitterCodes.length > 0
      ? [start.toISOString(), end.toISOString(), catalogs, splitterCodes]
      : [start.toISOString(), end.toISOString(), catalogs];

    const grouped = await queryWithTransientRetry(query, values, {
      retries: 1,
      delayMs: 180,
    });

    const rows = grouped.rows;
    const totals = rows.reduce(
      (acc, row) => {
        acc.totalMaintenances += Number(row.totalMaintenances ?? 0);
        acc.totalProtocols += Number(row.uniqueProtocols ?? 0);
        acc.totalClients += Number(row.uniqueClients ?? 0);
        acc.openMaintenances += Number(row.openMaintenances ?? 0);
        if (String(row.splitterCode ?? '') === 'SEM_MAPEAMENTO') {
          acc.unmappedMaintenances += Number(row.totalMaintenances ?? 0);
        } else {
          acc.splittersWithMaintenances += 1;
        }
        return acc;
      },
      {
        totalMaintenances: 0,
        totalProtocols: 0,
        totalClients: 0,
        openMaintenances: 0,
        splittersWithMaintenances: 0,
        unmappedMaintenances: 0,
      },
    );

    return res.json({
      success: true,
      data: {
        start: start.toISOString(),
        end: end.toISOString(),
        catalogs,
        rows,
        totals,
      },
    });
  } catch (error) {
    console.error('Erro ao consultar manutenções por splitter:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao consultar manutenções por splitter.',
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
          base.*
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
  // Escutar primeiro: /api/health fica pronto de imediato (Docker/Portainer). Antes, await a
  // Postgresql/MySQL podia atrasar ou bloquear e o healthcheck falhava (container unhealthy).
  await new Promise((resolve, reject) => {
    const httpServer = app.listen(port, () => {
      logger.info(`BFF Local rodando em http://localhost:${port}`);
      resolve();
    });
    httpServer.on('error', reject);
  });

  try {
    await ensureDashboardKpiTable(pool);
    if (dashboardKpiSnapshotWritesEnabled) {
      logger.info('Tabela dashboard_kpi_daily (PostgreSQL) verificada.');
    }
  } catch (error) {
    logger.error('Arranque: falha ao verificar PostgreSQL (conexao ou DDL). Rotas com DB podem falhar.', {
      error,
    });
  }

  if (massivaHistoryStore.configured) {
    try {
      await massivaHistoryStore.ensureReady();
      logger.info('Histórico local de massivas (MySQL) pronto.');
    } catch (error) {
      logger.error('Arranque: falha ao preparar MySQL (massiva).', { error });
    }
  } else {
    logger.warn('Histórico local de massivas (MySQL) desativado: configure MASSIVA_MYSQL_* no .env.local.');
  }

  const kpiCronDisabled = String(process.env.DASHBOARD_KPI_CRON_DISABLED ?? '').toLowerCase() === 'true';
  const kpiCronExpr = (process.env.DASHBOARD_KPI_CRON ?? '0 6 * * *').trim();
  if (!dashboardKpiSnapshotWritesEnabled) {
    logger.info('[dashboard-kpi] Cron não registrado (PostgreSQL só leitura).');
  } else if (!kpiCronDisabled) {
    cron.schedule(
      kpiCronExpr,
      async () => {
        try {
          const { snapshot_date: d } = await captureDashboardKpiDaily();
          logger.info(`[dashboard-kpi] Snapshot agendado OK (data operacional: ${d}).`);
        } catch (error) {
          logger.error('[dashboard-kpi] Falha no snapshot agendado:', { error });
        }
      },
      { timezone: 'America/Sao_Paulo' },
    );
    logger.info(
      `[dashboard-kpi] Cron ativo: "${kpiCronExpr}" America/Sao_Paulo (padrão 06:00). Desative com DASHBOARD_KPI_CRON_DISABLED=true.`,
    );
  } else {
    logger.info('[dashboard-kpi] Cron desativado (DASHBOARD_KPI_CRON_DISABLED=true).');
  }

  const splitterSnapshotCronDisabled =
    String(process.env.SPLITTER_SNAPSHOT_CRON_DISABLED ?? '').toLowerCase() === 'true';
  const splitterSnapshotCronExpr = (process.env.SPLITTER_SNAPSHOT_CRON ?? '59 23 * * *').trim();
  if (!massivaHistoryStore.configured) {
    logger.info('[splitter-snapshot] Cron não registrado (MySQL de massivas não configurado).');
  } else if (!splitterSnapshotCronDisabled) {
    cron.schedule(
      splitterSnapshotCronExpr,
      async () => {
        try {
          const data = await captureSplitterSnapshots();
          logger.info(
            `[splitter-snapshot] Captura agendada OK (${data.insertedOrUpdated} alterados, ${data.skippedUnchanged} sem mudança, ${data.snapshotCount} avaliados).`,
          );
        } catch (error) {
          logger.error('[splitter-snapshot] Falha na captura agendada:', { error });
        }
      },
      { timezone: 'America/Sao_Paulo' },
    );
    logger.info(
      `[splitter-snapshot] Cron ativo: "${splitterSnapshotCronExpr}" America/Sao_Paulo (padrão 23:59). Desative com SPLITTER_SNAPSHOT_CRON_DISABLED=true.`,
    );
  } else {
    logger.info('[splitter-snapshot] Cron desativado (SPLITTER_SNAPSHOT_CRON_DISABLED=true).');
  }
}

process.on('uncaughtException', (error) => {
  logger.fatal('uncaught_exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('unhandled_rejection', { reason });
});

app.use((error, req, res, next) => {
  logger.error('express_error', {
    message: error?.message,
    stack: error?.stack,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(error?.status || 500).json({
    success: false,
    error: 'Internal server error',
  });
});

startServer().catch((error) => {
  logger.fatal('Falha ao iniciar o BFF Local:', { error });
  process.exit(1);
});
