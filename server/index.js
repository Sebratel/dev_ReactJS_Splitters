import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMassivaHistoryStore } from './massivaHistoryStore.js';
import {
  analyzeStreetReliefContext,
  evaluateReliefForSplitter,
  evaluateReliefForMapMirror,
  fetchOsrmFootDistanceRowMeters,
  hasIntraCondominiumFreePortSibling,
  isCondominiumSplitterTitle,
  normalizeStreetForRelief,
  queryFullOccupancySplitterCandidates,
  querySplitterNeighborsWithOrigin,
  splitterIdentifierMatchSql,
  SPLITTER_MAP_STRAIGHT_RADIUS_METERS,
  STREET_RELIEF_MAX_ROUTE_METERS,
  RELIEF_NEIGHBOR_GEOCODE_MAX,
} from './splitterNeighborRouting.js';
import { buildSplittersFilterContext } from './splittersFilterContext.js';
import {
  buildSplitterOperationalScore,
  compareRiskEntries,
} from './splittersOperationalScore.js';
import {
  askPlanningAssistant,
  isPlanningAssistantConfigured,
} from './planningAssistant.js';
import {
  requireAuthenticatedSplittersUser,
  requireIsaAdminAccess,
  requireSplittersAdminAccess,
} from './firebaseAdminAuth.js';
import {
  readIsaPromptConfig,
  resetIsaPromptConfig,
  saveIsaPromptConfig,
} from './isaPromptConfigStore.js';
import {
  addPlatformSuggestionComment,
  createPlatformSuggestion,
  listPlatformSuggestions,
  updatePlatformSuggestionStatus,
  voteOnPlatformSuggestion,
} from './platformSuggestionsStore.js';
import {
  normalizeMassivaRouteRowTituloPreferido,
  rowMatchesMassivaOltRoute,
} from './splitterTitleOltDerivation.js';
import logger, { captureConsole } from './logger.js';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

if (!String(process.env.REVERSE_GEOCODE_ENDPOINT ?? '').trim()) {
  const viteReverse = String(process.env.VITE_REVERSE_GEOCODE_ENDPOINT ?? '').trim();
  if (viteReverse !== '') {
    process.env.REVERSE_GEOCODE_ENDPOINT = viteReverse;
  }
}

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
app.use(express.json({ limit: '512kb' }));

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

function normalizeGeoName(name) {
  return String(name)
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
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

// Pool separado para o banco de monitoramento de ONUs (diagnóstico de sinal).
// As tabelas onu_statuses/onu_infos/gpon_macs/gpon_clients/olts vivem em outro
// servidor PostgreSQL, distinto do banco principal (dbemp00100).
const onuPool = process.env.ONU_DB_HOST
  ? new Pool({
      host: process.env.ONU_DB_HOST,
      port: parseInt(process.env.ONU_DB_PORT || '5432'),
      database: process.env.ONU_DB_NAME,
      user: process.env.ONU_DB_USER,
      password: process.env.ONU_DB_PASSWORD,
      ssl: process.env.ONU_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.ONU_DB_POOL_MAX || '6'),
      connectionTimeoutMillis: 6000,
      idleTimeoutMillis: 30000,
    })
  : null;

if (onuPool) {
  onuPool.on('error', (err) => {
    console.error('[onu] Erro inesperado no pool PostgreSQL de monitoramento:', err.message);
  });
  onuPool.connect().then((client) => {
    client.release();
    console.log('[onu] Conexão com banco de monitoramento estabelecida com sucesso.');
  }).catch((err) => {
    console.error('[onu] Falha ao conectar no banco de monitoramento ONU:', err.message);
  });
}

if (!onuPool) {
  console.warn(
    '[onu] ONU_DB_HOST não definido — rotas /api/onu-diagnostics responderão 503 até configurar o banco de monitoramento.',
  );
}

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

function coercePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeAssistantText(value) {
  return String(value ?? '').trim();
}

const EMPTY_ASSISTANT_MASSIVA_STATS = {
  totalTickets: 0,
  openTickets: 0,
  closedTickets: 0,
  affectedClientsTotal: 0,
  latestOpenedAt: null,
};

const EMPTY_ASSISTANT_TREND = {
  label: 'Sem historico',
  currentUsagePercent: 0,
  delta7d: 0,
  delta30d: 0,
  capturedAt: null,
};

async function buildPlanningAssistantContext({ splitterCode, straightRadiusMeters, maxRouteMeters }) {
  /** Alívio e badge "Apoio" do mapa usam 200 m em linha reta; pedidos maiores são limitados aqui. */
  const neighborStraightRadiusMeters = Math.min(
    Math.max(Number(straightRadiusMeters) || SPLITTER_MAP_STRAIGHT_RADIUS_METERS, 1),
    SPLITTER_MAP_STRAIGHT_RADIUS_METERS,
  );
  /** A ISA deve seguir a mesma régua operacional da fila de alívio: até 200 m pela rota. */
  const effectiveMaxRouteMeters = Math.min(Math.max(Number(maxRouteMeters) || 200, 1), 200);

  const context = {
    generatedAt: new Date().toISOString(),
    reliefRule: {
      straightRadiusMeters: neighborStraightRadiusMeters,
      straightRadiusMetersSolicitado:
        Number(straightRadiusMeters) > neighborStraightRadiusMeters
          ? Number(straightRadiusMeters)
          : null,
      maxRouteMeters: effectiveMaxRouteMeters,
      crossStreetMaxRouteMeters: 30,
      sameStreetOnlyForFullRouteLimit: true,
    },
    splitter: null,
    networkContext: null,
    trendSummary: null,
    recentSnapshots: [],
    massivaSummary: null,
    recentMassivaHistory: [],
    operationalPriority: null,
    neighborsSample: [],
    reliefEvaluation: null,
  };

  const normalizedCode = normalizeAssistantText(splitterCode);
  if (normalizedCode === '') return context;

  const splitterResult = await queryWithTransientRetry(
    `
      SELECT DISTINCT ON (base."ID[SPLT.SECUNDARIO]")
        base."ID[SPLT.SECUNDARIO]" AS id,
        base."CÓDIGO[SPLT.SECUNDARIO]" AS code,
        base."SPLT.SECUNDARIO" AS title,
        base."CAPACIDADE[SPLT.SECUNDARIO]" AS "outPorts",
        base."BUSY_COUNT" AS "busyCount",
        base."SPLT.PRIMARIO" AS "primarySplitterTitle",
        base."PORTA[SPLT.PRIMARIO]" AS "primarySplitterPort",
        base."PONTO DE ACESSO CODE" AS "accessPointCode",
        base."PONTO DE ACESSO" AS "accessPointTitle",
        base."CONCENTRADOR_CODE" AS "concentratorCode",
        base."CONCENTRADOR" AS "concentratorTitle",
        base."SLOT[SPLT.SECUNDARIO]" AS slot,
        base."PORTA EXTRAÍDA[SPLT.SECUNDARIO]" AS "ponPort",
        base."RUA[SPLT.SECUNDARIO]" AS street,
        base."BAIRRO[SPLT.SECUNDARIO]" AS neighborhood,
        base."CIDADE[SPLT.SECUNDARIO]" AS city,
        base."TIPO LOCAL" AS "tipoLocal",
        base."NOME CONDOMÍNIO" AS "nomeCondominio",
        base."TEM_CORPORATIVO_SPLITTER" AS "hasCorporateClients"
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE (
        TRIM(base."CÓDIGO[SPLT.SECUNDARIO]"::text) = TRIM($1::text)
        OR TRIM(base."SPLT.SECUNDARIO"::text) = TRIM($1::text)
      )
      ORDER BY base."ID[SPLT.SECUNDARIO]" ASC
      LIMIT 1
    `,
    [normalizedCode],
    { retries: 1, delayMs: 180 },
  );

  const splitterRow = splitterResult.rows?.[0] ?? null;
  if (!splitterRow) {
    context.splitter = {
      code: normalizedCode,
      found: false,
    };
    return context;
  }

  context.splitter = {
    found: true,
    id: Number(splitterRow.id ?? 0),
    code: normalizeAssistantText(splitterRow.code),
    title: normalizeAssistantText(splitterRow.title),
    outPorts: Number(splitterRow.outPorts ?? 0),
    busyCount: Number(splitterRow.busyCount ?? 0),
    street: normalizeAssistantText(splitterRow.street),
    neighborhood: normalizeAssistantText(splitterRow.neighborhood),
    city: normalizeAssistantText(splitterRow.city),
    tipoLocal: normalizeAssistantText(splitterRow.tipoLocal),
    nomeCondominio: normalizeAssistantText(splitterRow.nomeCondominio),
    hasCorporateClients: Boolean(splitterRow.hasCorporateClients),
    isCondominium: isCondominiumSplitterTitle(splitterRow.title),
  };

  context.networkContext = {
    primarySplitterTitle: normalizeAssistantText(splitterRow.primarySplitterTitle),
    primarySplitterPort: Number(splitterRow.primarySplitterPort ?? 0),
    accessPointCode: normalizeAssistantText(splitterRow.accessPointCode),
    accessPointTitle: normalizeAssistantText(splitterRow.accessPointTitle),
    concentratorCode: normalizeAssistantText(splitterRow.concentratorCode),
    concentratorTitle: normalizeAssistantText(splitterRow.concentratorTitle),
    slot: Number(splitterRow.slot ?? 0),
    ponPort: Number(splitterRow.ponPort ?? 0),
  };

  const [
    trendMap,
    massivaStatsMap,
    massivaRollup,
    recentSnapshots,
    recentMassivaHistory,
  ] = await Promise.all([
    massivaHistoryStore.getSplitterTrends([normalizedCode]),
    massivaHistoryStore.getSplitterStats([normalizedCode]),
    massivaHistoryStore.getMassivaPeriodRollup([normalizedCode]),
    massivaHistoryStore.getRecentSplitterSnapshots(normalizedCode, 6),
    massivaHistoryStore.getRecentHistoryBySplitter(normalizedCode, 5),
  ]);

  const massivaStats =
    massivaStatsMap.get(normalizedCode) ?? EMPTY_ASSISTANT_MASSIVA_STATS;
  const trendSummary = trendMap.get(normalizedCode) ?? EMPTY_ASSISTANT_TREND;

  context.trendSummary = trendSummary;
  context.recentSnapshots = recentSnapshots;
  context.massivaSummary = {
    stats: massivaStats,
    rollup: massivaRollup,
  };
  context.recentMassivaHistory = recentMassivaHistory;
  context.operationalPriority = {
    ...buildSplitterOperationalScore(context.splitter, massivaStats),
    massivaStats,
  };

  const reliefAnalysis = await analyzeStreetReliefContext(pool, normalizedCode, {
    straightRadiusMeters: neighborStraightRadiusMeters,
    maxRouteMeters: effectiveMaxRouteMeters,
    reliefGeocodeNeighborMax: RELIEF_NEIGHBOR_GEOCODE_MAX,
  });
  context.reliefEvaluation = {
    hasReliefWithinRoute: Boolean(
      reliefAnalysis.reliefMatch || reliefAnalysis.condominiumRelief,
    ),
    routingOk: Boolean(reliefAnalysis.routingOk),
    straightNeighborsCount: Number(reliefAnalysis.straightNeighborsCount ?? 0),
    condominiumRelief: Boolean(reliefAnalysis.condominiumRelief),
    reliefNeighborCode: reliefAnalysis.reliefMatch
      ? normalizeAssistantText(reliefAnalysis.reliefMatch.code)
      : null,
    reliefNeighborTitle: reliefAnalysis.reliefMatch
      ? normalizeAssistantText(reliefAnalysis.reliefMatch.title)
      : null,
    reliefNeighborRouteMeters:
      reliefAnalysis.reliefMatch?.routeMeters == null
        ? null
        : Math.round(Number(reliefAnalysis.reliefMatch.routeMeters)),
  };

  context.origin = reliefAnalysis.origin;
  context.originStreet = normalizeAssistantText(
    reliefAnalysis.targetStreetDisplay ?? reliefAnalysis.targetStreetNormalized ?? '',
  );
  context.originIsCondominium = Boolean(reliefAnalysis.originIsCondominium);

  if (reliefAnalysis.origin && Array.isArray(reliefAnalysis.analyzedNeighbors)) {
    context.neighborsSample = reliefAnalysis.analyzedNeighbors.slice(0, 8).map((neighbor) => ({
      code: normalizeAssistantText(neighbor.code),
      title: normalizeAssistantText(neighbor.title),
      street: normalizeAssistantText(neighbor.streetDisplay ?? neighbor.street ?? ''),
      outPorts: Number(neighbor.outPorts ?? 0),
      busyCount: Number(neighbor.busyCount ?? 0),
      straightMeters: Number(neighbor.distanceMeters ?? 0),
      routeMeters:
        neighbor.routeMeters == null ? null : Math.round(Number(neighbor.routeMeters)),
      isCondominium: Boolean(neighbor.isCondominium),
      sameStreet: Boolean(neighbor.sameStreet),
    }));
  }

  return context;
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
        ss.network_box_id,
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
    insig.title                       AS "INSIGNIA_CLIENTE",
    client.id                         AS "ID[CLIENTE]",
    client.id                         AS "ID CLIENTE",
    client.name                       AS "NOME CLIENTE",
    auth_contract.lat                 AS "LATITUDE_CLIENTE",
    auth_contract.lng                 AS "LONGITUDE_CLIENTE",
    auth_contract.user                AS "USUÁRIO[CLIENTE]",
    client.neighborhood               AS "BAIRRO",
    client.street                     AS "RUA",
    client."number"                   AS "NUMERO",
    client.address_complement         AS "ENDERECO COMPLE.",
    client.cell_phone_1               AS "CELULAR",
    client.city                       AS "CIDADE CLIENTE",
    client.state                      AS "UF",
    client.email                      AS "EMAIL",
    (
      LOWER(TRIM(COALESCE(insig.title, ''))) IN (
        'contrato corporativo',
        'contrato corporativo pme'
      )
    ) AS "CORPORATIVO",
    ss.out_ports                      AS "CAPACIDADE[SPLT.SECUNDARIO]",
    COALESCE(
      NULLIF(TRIM(ss.street::text), ''),
      NULLIF(TRIM(nba.street::text), '')
    )                                 AS "RUA[SPLT.SECUNDARIO]",
    ss."number"                       AS "NÚMERO[SPLT.SECUNDARIO]",
    ss.neighborhood                   AS "BAIRRO[SPLT.SECUNDARIO]",
    ss.city                           AS "CIDADE[SPLT.SECUNDARIO]",
    COALESCE(nba.latitude, ss.lat)    AS "LATITUDE[SPLT.SECUNDARIO]",
    COALESCE(nba.longitude, ss.lng)   AS "LONGITUDE[SPLT.SECUNDARIO]",
    nba.latitude                      AS "LATITUDE_CAIXADEREDE",
    nba.longitude                     AS "LONGITUDE_CAIXADEREDE",
    ss.type                           AS "TIPO EQUIPAMENTO[SPLT.SECUNDARIO]",
    ssp.busy                          AS "OCUPADO:[SPLT.SECUNDARIO]",
    nb.title                          AS "CAIXA_DE_REDE",
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
LEFT JOIN network_boxes nb
    ON nb.id = ss.network_box_id
LEFT JOIN network_box_addresses nba
    ON nba.id = nb.network_box_address_id
`;


/** Data “operacional” no fuso de São Paulo (alinhada à captura diária). */
const DASHBOARD_KPI_TODAY_SQL = `(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date`;

function buildNetworkStatsSql() {
  return `
      SELECT
        eq.catalog_equipment,
        eq.occupied_ports,
        eq.total_port_capacity,
        eq.equipment_occupancy_green,
        eq.equipment_occupancy_yellow,
        eq.equipment_occupancy_red,
        olts.olt_count
      FROM (
        SELECT
          COUNT(*)::bigint AS catalog_equipment,
          COALESCE(SUM(sub.busy_count), 0)::bigint AS occupied_ports,
          COALESCE(SUM(sub.out_ports), 0)::bigint AS total_port_capacity,
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
    const data = result.rows.map((row) => normalizeMassivaRouteRowTituloPreferido(row));

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Erro ao listar rotas para Massiva:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Filtro opcional por AP / códigos de splitter.
 * Slot/porta na rota seguem a nomenclatura do título (`…-slot-porta/…`); o pareamento com linhas
 * do catálogo faz-se em memória via `rowMatchesMassivaOltRoute` (mesma regra do detalhe splitter).
 */
function buildMassivaConnectionsWhere({ apCode, apCodes, splitterCodes } = {}) {
  const values = [];
  const where = ['base."ID CONEXAO[CLIENTE]" IS NOT NULL'];
  let p = 1;

  // apCodes (array) tem precedência sobre apCode (string)
  const apArr = Array.isArray(apCodes)
    ? apCodes.map((c) => String(c ?? '').trim()).filter((c) => c !== '')
    : [];
  const singleAp = String(apCode ?? '').trim();

  if (apArr.length > 0) {
    where.push(
      `COALESCE(NULLIF(base."PONTO DE ACESSO CODE", ''), base."PONTO DE ACESSO") = ANY($${p})`,
    );
    values.push(apArr);
    p += 1;
  } else if (singleAp !== '') {
    where.push(
      `COALESCE(NULLIF(base."PONTO DE ACESSO CODE", ''), base."PONTO DE ACESSO") = $${p}`,
    );
    values.push(singleAp);
    p += 1;
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

/** Sem ORDER BY — mais rápido para contagem/amostra no batch-summary. */
function massivaConnectionsSummaryQuery(where) {
  return `
    SELECT base.*
    FROM (${SPLITTERS_BASE_QUERY}) base
    WHERE ${where.join(' AND ')}
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

    const slotN =
      slot == null ? null : Number.parseInt(String(slot).trim(), 10);
    const portN =
      port == null ? null : Number.parseInt(String(port).trim(), 10);
    const slotPortFilter =
      slotN != null && portN != null && Number.isFinite(slotN) && Number.isFinite(portN);

    const { where, values } = buildMassivaConnectionsWhere({
      apCode: apCode || undefined,
      splitterCodes: splitterCodes.length > 0 ? splitterCodes : undefined,
    });

    const result = await queryWithTransientRetry(massivaConnectionsSelectQuery(where), values, {
      retries: 1,
      delayMs: 180,
    });
    let rows = result.rows;
    if (slotPortFilter) {
      rows = rows.filter((row) => rowMatchesMassivaOltRoute(slotN, portN, row));
    }
    res.json({
      success: true,
      count: rows.length,
      data: rows,
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

    // O SQL filtra apenas por apCode (slot/porta são filtrados em memória). Rotas do
    // mesmo AP compartilham a MESMA query — então agrupamos por AP e consultamos UMA vez
    // por AP, em vez de uma vez por rota (evita N queries idênticas e o timeout em
    // massivas com muitas PONs do mesmo AP).
    const slotPortsByAp = new Map();
    for (const route of uniqueRoutes) {
      const list = slotPortsByAp.get(route.apCode) ?? [];
      list.push({ slot: route.slot, port: route.port });
      slotPortsByAp.set(route.apCode, list);
    }
    const apEntries = Array.from(slotPortsByAp.entries());

    const chunkSizeRaw = Number.parseInt(
      String(process.env.MASSIVA_BATCH_ROUTE_CHUNK_SIZE ?? '80'),
      10,
    );
    const chunkSize =
      Number.isFinite(chunkSizeRaw) && chunkSizeRaw > 0 ? chunkSizeRaw : 80;
    let chunksProcessed = 0;

    for (let index = 0; index < apEntries.length; index += chunkSize) {
      const chunk = apEntries.slice(index, index + chunkSize);
      chunksProcessed += 1;

      const chunkResults = await Promise.all(
        chunk.map(async ([apCode, slotPorts]) => {
          const { where, values } = buildMassivaConnectionsWhere({ apCode });
          const result = await queryWithTransientRetry(
            massivaConnectionsSelectQuery(where),
            values,
            {
              retries: 1,
              delayMs: 180,
            },
          );
          return {
            rows: result.rows.filter((row) =>
              slotPorts.some((sp) =>
                rowMatchesMassivaOltRoute(sp.slot, sp.port, row),
              ),
            ),
          };
        }),
      );

      for (const pack of chunkResults) {
        for (const row of pack.rows) {
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
      uniqueApsProcessed: apEntries.length,
      chunkSize,
      chunksProcessed,
    });
  } catch (error) {
    console.error('Erro ao listar conexões (batch) para Massiva:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/massiva/connections/batch-summary', async (req, res) => {
  try {
    if (!Array.isArray(req.body?.routes)) {
      return res
        .status(400)
        .json({ success: false, error: 'Body deve incluir "routes" (array de rotas).' });
    }

    const routes = req.body.routes;
    if (routes.length === 0) {
      return res.json({
        success: true,
        counts: { total: 0, pppoe: 0, corporate: 0, uniqueAuthIds: 0 },
        sample: [],
      });
    }

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

    const uniqueRoutes = Array.from(unique.values());

    // Uma única query para todos os APs do lote — CTEs pesados rodam uma só vez
    const apCodes = [...new Set(uniqueRoutes.map((r) => r.apCode))];
    const { where, values } = buildMassivaConnectionsWhere({ apCodes });
    const result = await queryWithTransientRetry(
      massivaConnectionsSummaryQuery(where),
      values,
      { retries: 1, delayMs: 180 },
    );

    // Filtra em memória: cada linha deve corresponder a alguma rota (apCode + slot/porta)
    const merged = [];
    const seenKeys = new Set();
    for (const row of result.rows) {
      const rowAp = String(
        row['PONTO DE ACESSO CODE'] || row['PONTO DE ACESSO'] || '',
      ).trim();
      const matches = uniqueRoutes.some(
        (route) =>
          route.apCode === rowAp &&
          rowMatchesMassivaOltRoute(route.slot, route.port, row),
      );
      if (!matches) continue;
      const dk = massivaRowDedupeKey(row);
      if (seenKeys.has(dk)) continue;
      seenKeys.add(dk);
      merged.push(row);
    }

    // Aggregate server-side — never transfer all rows to the client
    const CORPORATE_KEYS = [
      'CORPORATIVO', 'CLIENTE CORPORATIVO', 'FL_CORPORATIVO', 'IS_CORPORATE', 'corporativo',
    ];
    const seenPppoes = new Set();
    const seenAuthIds = new Set();
    let corporate = 0;

    for (const row of merged) {
      const authId = row['ID CONEXAO[CLIENTE]'];
      if (authId != null) {
        const s = String(authId).trim();
        if (s !== '') seenAuthIds.add(s);
      }
      const user = String(
        row['USUARIO[CLIENTE]'] ?? row['USUÁRIO[CLIENTE]'] ?? '',
      ).trim().toLowerCase();
      if (user !== '') seenPppoes.add(user);

      for (const key of CORPORATE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
        const v = row[key];
        if (v === undefined || v === null) continue;
        let isCorp = false;
        if (v === true) isCorp = true;
        else if (v !== false) {
          if (typeof v === 'number') isCorp = v === 1;
          else {
            const t = String(v).trim().toLowerCase();
            isCorp = t === '1' || t === 'true' || t === 't' || t === 's' || t === 'sim' || t === 'y' || t === 'yes';
          }
        }
        if (isCorp) corporate += 1;
        break;
      }
    }

    res.json({
      success: true,
      counts: {
        total: merged.length,
        pppoe: seenPppoes.size,
        corporate,
        uniqueAuthIds: seenAuthIds.size,
      },
      sample: merged.slice(0, 50),
    });
  } catch (error) {
    console.error('Erro ao sumarizar conexões (batch-summary) para Massiva:', error);
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
      eventIdentifiedAt: req.body?.eventIdentifiedAt ?? null,
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

app.post('/api/massiva/history/mark-closed-by-protocols', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.status(503).json({
        success: false,
        message: 'Histórico local de massivas não configurado no MySQL.',
      });
    }

    const result = await massivaHistoryStore.markClosedByProtocols({
      protocols: req.body?.protocols,
      closeDescription: String(req.body?.closeDescription ?? '').trim(),
      closedAt: req.body?.closedAt ?? null,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Erro ao sincronizar encerramentos locais de massiva:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao sincronizar encerramentos locais de massiva.',
      error: error.message,
    });
  }
});

/**
 * Total do período sem repetir afetados por splitter (uma soma por massiva distinta).
 */
app.post('/api/massiva/history/period-rollup', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.json({
        success: true,
        data: {
          distinctMassivaCount: 0,
          affectedClientsDistinctSum: 0,
          openMassivasCount: 0,
          closedMassivasCount: 0,
        },
      });
    }

    const scope =
      String(req.body?.scope ?? '').trim() === 'all_linked' ? 'all_linked' : 'by_codes';

    const splitterCodes = Array.isArray(req.body?.splitterCodes)
      ? req.body.splitterCodes
          .map((value) => String(value ?? '').trim())
          .filter((value) => value !== '')
      : [];

    const parseOptionalIsoDate = (value) => {
      if (value == null || String(value).trim() === '') return null;
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const openedAtFrom = parseOptionalIsoDate(req.body?.openedAtFrom);
    const openedAtTo = parseOptionalIsoDate(req.body?.openedAtTo);
    const massivaRange =
      openedAtFrom !== null || openedAtTo !== null
        ? { openedAtFrom, openedAtTo }
        : undefined;

    const data = await massivaHistoryStore.getMassivaPeriodRollup(
      splitterCodes,
      massivaRange,
      { scope },
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao agregar massivas do período:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao agregar massivas do período.',
      error: error.message,
    });
  }
});

/**
 * Massivas do período com splitters vinculados (payload leve) — ex.: curva de envelhecimento.
 */
app.post('/api/massiva/history/period-links', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.json({ success: true, data: [] });
    }

    const parseOptionalIsoDate = (value) => {
      if (value == null || String(value).trim() === '') return null;
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const openedAtFrom = parseOptionalIsoDate(req.body?.openedAtFrom);
    const openedAtTo = parseOptionalIsoDate(req.body?.openedAtTo);
    const massivaRange =
      openedAtFrom !== null || openedAtTo !== null
        ? { openedAtFrom, openedAtTo }
        : undefined;

    const data = await massivaHistoryStore.getMassivaSplitterLinksInPeriod(massivaRange);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao listar vínculos de massivas do período:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao listar vínculos de massivas do período.',
      error: error.message,
    });
  }
});

/**
 * Recorrência dia × turno: massivas distintas por data/hora de abertura (não por equipamento).
 */
app.post('/api/massiva/history/day-shift-recurrence', async (req, res) => {
  try {
    if (!massivaHistoryStore.configured) {
      return res.json({ success: true, data: [] });
    }

    const parseOptionalIsoDate = (value) => {
      if (value == null || String(value).trim() === '') return null;
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const openedAtFrom = parseOptionalIsoDate(req.body?.openedAtFrom);
    const openedAtTo = parseOptionalIsoDate(req.body?.openedAtTo);
    const massivaRange =
      openedAtFrom !== null || openedAtTo !== null
        ? { openedAtFrom, openedAtTo }
        : undefined;

    const data = await massivaHistoryStore.getMassivaRecurrenceByDayShift(massivaRange);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Erro ao agregar recorrência dia×turno:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao agregar recorrência dia×turno.',
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

function parseCsvQueryParam(raw) {
  return String(raw ?? '')
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

function parsePositiveIntCsvQueryParam(raw) {
  const out = new Set();
  for (const item of parseCsvQueryParam(raw)) {
    const n = Number.parseInt(item, 10);
    if (Number.isFinite(n) && n > 0) out.add(n);
  }
  return [...out];
}

async function querySplitterCodesByAccessPointCodes(accessPointCodes) {
  const normalized = [...new Set(parseCsvQueryParam(accessPointCodes))];
  if (normalized.length === 0) return [];

  const result = await pool.query(
    `
      SELECT DISTINCT TRIM(base."CÓDIGO[SPLT.SECUNDARIO]"::text) AS "splitterCode"
      FROM (${SPLITTERS_BASE_QUERY}) base
      WHERE COALESCE(
        NULLIF(TRIM(base."PONTO DE ACESSO CODE"::text), ''),
        TRIM(base."PONTO DE ACESSO"::text)
      ) = ANY($1::text[])
        AND TRIM(base."CÓDIGO[SPLT.SECUNDARIO]"::text) <> ''
      ORDER BY "splitterCode" ASC
    `,
    [normalized],
  );

  return result.rows
    .map((row) => String(row.splitterCode ?? '').trim())
    .filter((code) => code !== '');
}

/**
 * Códigos de splitter para o filtro “com massiva aberta” (Elleven + vínculos locais + AP).
 * Query: protocols=1,2&apCodes=25903&ticketSplitterCodes=SPL-1
 */
app.get('/api/massiva/history/open-filter-splitter-codes', async (req, res) => {
  try {
    const protocols = parsePositiveIntCsvQueryParam(req.query.protocols);
    const apCodes = parseCsvQueryParam(req.query.apCodes);
    const ticketSplitterCodes = parseCsvQueryParam(req.query.ticketSplitterCodes);
    const codes = new Set(ticketSplitterCodes);

    if (massivaHistoryStore.configured && protocols.length > 0) {
      const fromHistory = await massivaHistoryStore.getSplitterCodesForProtocols(protocols);
      for (const code of fromHistory) codes.add(code);
    }

    if (apCodes.length > 0) {
      const fromAp = await querySplitterCodesByAccessPointCodes(apCodes);
      for (const code of fromAp) codes.add(code);
    }

    res.json({
      success: true,
      data: [...codes].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    });
  } catch (error) {
    console.error('Erro ao resolver splitters para filtro de massiva aberta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao resolver splitters para filtro de massiva aberta.',
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

    const parseOptionalIsoDate = (value) => {
      if (value == null || String(value).trim() === '') return null;
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const openedAtFrom = parseOptionalIsoDate(req.query.from);
    const openedAtTo = parseOptionalIsoDate(req.query.to);
    const massivaRange =
      openedAtFrom !== null || openedAtTo !== null
        ? { openedAtFrom, openedAtTo }
        : undefined;

    const [trendsMap, statsMap] = await Promise.all([
      massivaHistoryStore.getSplitterTrends(splitterCodes),
      massivaHistoryStore.getSplitterStats(splitterCodes, massivaRange),
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

/** Catálogos ERP usados na aba Manutenções do Painel da rede (assignments + catalog_services). */
const DEFAULT_MAINTENANCE_ERP_CATALOGS = [
  'Oper. Reparo',
  'Oper. Tecnologia',
  // Legado — mantido para períodos em que o ERP ainda usava estes títulos.
  'Equipe reparo',
  'Equipe tecnologia',
];

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
    const catalogsFromEnv = String(process.env.MAINTENANCE_ERP_CATALOGS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '');
    const catalogs = catalogsRaw
      ? catalogsRaw.split(',').map((value) => value.trim()).filter((value) => value !== '')
      : catalogsFromEnv.length > 0
        ? catalogsFromEnv
        : DEFAULT_MAINTENANCE_ERP_CATALOGS;
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
          ${splitterIdentifierMatchSql('as4')}
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

/** Vizinhos com distância em linha reta + distância por rede viária (OSRM foot); inclui alívio intra-condomínio (titulo). */
app.get('/api/splitters/neighbors-routed', async (req, res) => {
  try {
    const code = resolveSplitterCodeParam(req);
    if (!code) {
      return res.status(400).json({ success: false, message: 'Parametro code obrigatorio.' });
    }

    const straightRaw = Number.parseFloat(String(req.query.straightRadius ?? '200'));
    const straightRadius =
      Number.isFinite(straightRaw) && straightRaw > 0 ? straightRaw : 200;

    const [{ origin, neighbors, originIsCondominium, originStreet }, condominiumReliefAvailable] = await Promise.all([
      querySplitterNeighborsWithOrigin(pool, code, straightRadius),
      hasIntraCondominiumFreePortSibling(pool, code),
    ]);

    /**
     * Reverse geocode da origem e ruas dos vizinhos ficam no browser (`resolveGeocodedAddressForSplitter` /
     * `useNeighborStreetsReverseGeocode`) para esta rota responder só com PG + OSRM e o mapa sair do loading rápido.
     */
    const originStreetRaw = null;

    if (!origin) {
      return res.json({
        success: true,
        straightRadiusMeters: straightRadius,
        routingProfile: 'foot',
        routingUnavailable: false,
        isCondominium: originIsCondominium,
        condominiumReliefAvailable,
        originStreet,
        originStreetRaw,
        origin: null,
        neighbors: [],
      });
    }

    const capped = neighbors.slice(0, 80);
    let routeMeters = [];
    let routingUnavailable = false;
    try {
      routeMeters = await fetchOsrmFootDistanceRowMeters(
        origin,
        capped.map((n) => ({ lat: Number(n.lat), lng: Number(n.lng) })),
      );
    } catch (err) {
      routingUnavailable = true;
      routeMeters = capped.map(() => null);
      logger.warn('OSRM neighbors-routed indisponivel', { error: String(err?.message ?? err) });
    }

    const data = capped.map((n, i) => ({
      code: String(n.code ?? '').trim(),
      title: String(n.title ?? '').trim(),
      street: String(n.street ?? '').trim(),
      outPorts: Number(n.outPorts ?? 0),
      busyCount: Number(n.busyCount ?? 0),
      lat: Number(n.lat),
      lng: Number(n.lng),
      straightMeters: Math.round(Number(n.distanceMeters ?? 0)),
      routeMeters: routeMeters[i] ?? null,
      isCondominium: isCondominiumSplitterTitle(n.title),
    }));

    res.json({
      success: true,
      straightRadiusMeters: straightRadius,
      routingProfile: 'foot',
      routingUnavailable,
      isCondominium: originIsCondominium,
      condominiumReliefAvailable,
      originStreet,
      originStreetRaw,
      origin,
      neighbors: data,
    });
  } catch (error) {
    console.error('Erro ao buscar vizinhos roteados:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseSnapshotReliefGeocodeMax() {
  /** Padrão 14 = paridade com `NEIGHBOR_CLIENT_GEOCODE_MAX` no mapa. Use 0 só para debug rápido (não espelha o mapa). */
  const raw = Number.parseInt(String(process.env.NETWORK_RELIEF_SNAPSHOT_GEOCODE_MAX ?? '14'), 10);
  const parsed = Number.isFinite(raw) ? raw : RELIEF_NEIGHBOR_GEOCODE_MAX;
  return Math.min(Math.max(parsed, 0), RELIEF_NEIGHBOR_GEOCODE_MAX);
}

/** @type {Map<string, Promise<unknown>>} */
const networkReliefSnapshotCaptureInflight = new Map();

function networkReliefSnapshotParamsKey(straightRadiusMeters, maxRouteMeters) {
  return `${straightRadiusMeters}:${maxRouteMeters}`;
}

function isNetworkReliefSnapshotInflight(straightRadiusMeters, maxRouteMeters) {
  return networkReliefSnapshotCaptureInflight.has(
    networkReliefSnapshotParamsKey(straightRadiusMeters, maxRouteMeters),
  );
}

function scheduleNetworkReliefSnapshotCapture(straightRadiusMeters, maxRouteMeters) {
  const key = networkReliefSnapshotParamsKey(straightRadiusMeters, maxRouteMeters);
  if (networkReliefSnapshotCaptureInflight.has(key)) return;

  const promise = captureNetworkReliefSnapshot({ straightRadiusMeters, maxRouteMeters })
    .then((result) => {
      logger.info('[network-relief-snapshot] Captura em background concluída.', {
        entryCount: result.entryCount,
        scannedCount: result.scannedCount,
      });
      return result;
    })
    .catch((error) => {
      logger.error('[network-relief-snapshot] Captura em background falhou.', {
        error: String(error?.message ?? error),
      });
      throw error;
    })
    .finally(() => {
      networkReliefSnapshotCaptureInflight.delete(key);
    });

  networkReliefSnapshotCaptureInflight.set(key, promise);
}

function reliefSnapshotUsesMapMirror() {
  return String(process.env.NETWORK_RELIEF_SNAPSHOT_FAST_CAPTURE ?? '').toLowerCase() !== 'true';
}

function reliefSnapshotEvalConcurrency() {
  /** Com Nominatim público, 1 por vez — geocode já passa por fila global, mas OSRM+geo por CTO em paralelo estourava 429. */
  return reliefSnapshotUsesMapMirror() ? 1 : 6;
}

async function evaluateReliefSnapshotRow(row, straightRadiusMeters, maxRouteMeters) {
  const splitterCode = String(row.code ?? '').trim();
  if (!splitterCode) return null;

  const relief = reliefSnapshotUsesMapMirror()
    ? await evaluateReliefForMapMirror(pool, splitterCode, {
        straightRadiusMeters,
        maxRouteMeters,
      })
    : await evaluateReliefForSplitter(pool, splitterCode, {
        straightRadiusMeters,
        maxRouteMeters,
        reliefGeocodeNeighborMax: 0,
        skipReliefReverseGeocode: true,
      });

  if (!relief.routingOk || relief.hasReliefWithinRoute) return null;

  return {
    splitter: {
      code: splitterCode,
      title: String(row.title ?? '').trim() || splitterCode,
      outPorts: Number(row.outPorts ?? 0),
      busyCount: Number(row.busyCount ?? 0),
    },
    neighborStraightRadiusScanned: straightRadiusMeters,
    maxRouteMeters,
    straightNeighborsSampled: relief.straightNeighborsCount,
    ruleType: isCondominiumSplitterTitle(row.title) ? 'CONDOMINIUM' : 'STREET',
  };
}

async function computeNetworkReliefSnapshotData({ straightRadiusMeters, maxRouteMeters }) {
  const entries = [];
  let scannedCount = 0;
  let offset = 0;
  const batchSize = 40;
  const maxCandidatesToScan = 400;
  let reachedEnd = false;

  while (scannedCount < maxCandidatesToScan) {
    const candidates = await queryFullOccupancySplitterCandidates(pool, batchSize, offset);
    if (candidates.length === 0) {
      reachedEnd = true;
      break;
    }

    const remaining = maxCandidatesToScan - scannedCount;
    const slice = candidates.slice(0, remaining);
    scannedCount += slice.length;

    const evalConcurrency = reliefSnapshotEvalConcurrency();
    for (let i = 0; i < slice.length; i += evalConcurrency) {
      const chunk = slice.slice(i, i + evalConcurrency);
      const chunkEntries = await Promise.all(
        chunk.map((row) =>
          evaluateReliefSnapshotRow(row, straightRadiusMeters, maxRouteMeters),
        ),
      );
      for (const entry of chunkEntries) {
        if (entry) entries.push(entry);
      }
    }

    offset += candidates.length;
    if (candidates.length < batchSize) {
      reachedEnd = true;
      break;
    }
    if (scannedCount >= maxCandidatesToScan) {
      break;
    }
  }

  return {
    straightRadiusMeters,
    maxRouteMeters,
    scannedCount,
    entries,
    totalEntries: entries.length,
    sourceHasMoreCandidates: !reachedEnd && scannedCount < maxCandidatesToScan,
  };
}

async function captureNetworkReliefSnapshot({ straightRadiusMeters, maxRouteMeters }) {
  if (!massivaHistoryStore.configured) {
    return { configured: false, snapshotRunId: null, entryCount: 0, scannedCount: 0 };
  }

  const data = await computeNetworkReliefSnapshotData({ straightRadiusMeters, maxRouteMeters });
  const persisted = await massivaHistoryStore.replaceNetworkReliefSnapshot(data);
  return {
    configured: true,
    snapshotRunId: persisted.snapshotRunId,
    entryCount: persisted.entryCount,
    scannedCount: persisted.scannedCount,
    totalEntries: data.totalEntries,
  };
}

/**
 * Splitters secundários (filhos de primário type=2) 100% ocupados sem porta livre em vizinho
 * dentro de maxRouteMeters (OSRM foot). Pesado: varredura sequencial; limit baixo.
 */
app.get('/api/splitters/network-relief-queue', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');

    const limitRaw = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 40);
    const cursorRaw = Number.parseInt(String(req.query.cursor ?? '0'), 10);
    const cursor = Math.max(Number.isFinite(cursorRaw) ? cursorRaw : 0, 0);

    const straightPre = Number.parseFloat(
      String(req.query.straightRadius ?? String(SPLITTER_MAP_STRAIGHT_RADIUS_METERS)),
    );
    const straightRadius =
      Number.isFinite(straightPre) && straightPre > 0
        ? straightPre
        : SPLITTER_MAP_STRAIGHT_RADIUS_METERS;

    const maxRouteRaw = Number.parseFloat(String(req.query.maxRouteMeters ?? '200'));
    const maxRouteMeters =
      Number.isFinite(maxRouteRaw) && maxRouteRaw > 0 ? maxRouteRaw : 200;
    const oltSlot = (() => {
      const raw = req.query.oltSlot;
      if (raw === undefined || raw === null || raw === '') return null;
      const n = Number.parseInt(String(raw), 10);
      return Number.isFinite(n) ? n : null;
    })();
    const oltPort = (() => {
      const raw = req.query.oltPort;
      if (raw === undefined || raw === null || raw === '') return null;
      const n = Number.parseInt(String(raw), 10);
      return Number.isFinite(n) ? n : null;
    })();
    const usePonFilter = oltSlot !== null || oltPort !== null;

    let page = massivaHistoryStore.configured
      ? await massivaHistoryStore.getLatestNetworkReliefSnapshotPage({
          straightRadiusMeters: straightRadius,
          maxRouteMeters,
          limit,
          cursor,
          oltSlot,
          oltPort,
        })
      : null;

    if (!page) {
      const building = isNetworkReliefSnapshotInflight(straightRadius, maxRouteMeters);
      return res.json({
        success: true,
        snapshotMissing: !building,
        snapshotBuilding: building,
        maxRouteMeters,
        straightRadiusMeters: straightRadius,
        scannedCount: 0,
        entries: [],
        hasMore: false,
        nextCursor: null,
        totalEntries: 0,
        generatedAt: null,
        snapshotRunId: null,
        cacheHit: true,
        ponFilterActive: usePonFilter,
        message: building
          ? 'Atualizando tabela de planejamento no servidor (regra do mapa, 200 m). Tente de novo em instantes.'
          : 'Nenhum snapshot pronto na tabela. O cron do servidor grava os casos sem alívio; aguarde ou dispare a captura manual.',
      });
    }

    const nextCursor = usePonFilter
      ? page.ponFilterHasMore
        ? page.ponFilterResumePosition
        : null
      : cursor + limit < page.totalEntries
        ? cursor + limit
        : null;

    const hasMore = usePonFilter ? page.ponFilterHasMore : nextCursor !== null;

    res.json({
      success: true,
      maxRouteMeters,
      straightRadiusMeters: straightRadius,
      scannedCount: page.scannedCount,
      entries: page.entries,
      hasMore,
      nextCursor,
      totalEntries: page.totalEntries,
      generatedAt: page.generatedAt,
      snapshotRunId: page.snapshotRunId,
      cacheHit: true,
      ponFilterActive: usePonFilter,
    });
  } catch (error) {
    console.error('Erro na fila de alívio de rede:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/splitters/network-relief-snapshot/capture', async (req, res) => {
  try {
    const straightPre = Number.parseFloat(
      String(
        req.body?.straightRadius ??
          req.query.straightRadius ??
          String(SPLITTER_MAP_STRAIGHT_RADIUS_METERS),
      ),
    );
    const straightRadius =
      Number.isFinite(straightPre) && straightPre > 0
        ? straightPre
        : SPLITTER_MAP_STRAIGHT_RADIUS_METERS;
    const maxRouteRaw = Number.parseFloat(String(req.body?.maxRouteMeters ?? req.query.maxRouteMeters ?? '200'));
    const maxRouteMeters =
      Number.isFinite(maxRouteRaw) && maxRouteRaw > 0 ? maxRouteRaw : STREET_RELIEF_MAX_ROUTE_METERS;

    if (!massivaHistoryStore.configured) {
      return res.status(503).json({
        success: false,
        error: 'MySQL de histórico não configurado; snapshot indisponível.',
      });
    }

    if (isNetworkReliefSnapshotInflight(straightRadius, maxRouteMeters)) {
      return res.json({
        success: true,
        scheduled: false,
        snapshotBuilding: true,
        straightRadiusMeters: straightRadius,
        maxRouteMeters,
        message: 'Captura já em andamento no servidor.',
      });
    }

    scheduleNetworkReliefSnapshotCapture(straightRadius, maxRouteMeters);

    res.json({
      success: true,
      scheduled: true,
      snapshotBuilding: true,
      straightRadiusMeters: straightRadius,
      maxRouteMeters,
      message: 'Captura agendada em background; a fila passa a ler só da tabela quando terminar.',
    });
  } catch (error) {
    console.error('Erro ao capturar snapshot da fila de alívio de rede:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/isa-config', async (req, res) => {
  try {
    await requireIsaAdminAccess(req);
    const config = await readIsaPromptConfig();
    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Falha ao carregar a configuracao da ISA.',
    });
  }
});

app.get('/api/platform-suggestions', async (req, res) => {
  try {
    const actor = await requireAuthenticatedSplittersUser(req);
    const suggestions = await listPlatformSuggestions({
      viewerUid: actor.profile.uid,
      limit: req.query?.limit,
    });
    return res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error ? error.message : 'Falha ao listar sugestoes da plataforma.',
    });
  }
});

app.post('/api/platform-suggestions', async (req, res) => {
  try {
    const actor = await requireAuthenticatedSplittersUser(req);
    const suggestion = await createPlatformSuggestion({
      title: req.body?.title,
      description: req.body?.description,
      sector: req.body?.sector,
      category: req.body?.category,
      authorUid: actor.profile.uid,
      authorEmail: actor.profile.email || actor.identity.email,
      authorName:
        actor.profile.displayName ||
        actor.identity.name ||
        actor.profile.email ||
        actor.identity.email,
      authorPhotoURL: actor.profile.photoURL,
    });
    return res.status(201).json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error ? error.message : 'Falha ao criar sugestao da plataforma.',
    });
  }
});

app.post('/api/platform-suggestions/:suggestionId/vote', async (req, res) => {
  try {
    const actor = await requireAuthenticatedSplittersUser(req);
    const suggestion = await voteOnPlatformSuggestion({
      suggestionId: req.params?.suggestionId,
      voteType: req.body?.voteType,
      userUid: actor.profile.uid,
      userEmail: actor.profile.email || actor.identity.email,
      userName:
        actor.profile.displayName ||
        actor.identity.name ||
        actor.profile.email ||
        actor.identity.email,
      userPhotoURL: actor.profile.photoURL,
    });
    return res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error ? error.message : 'Falha ao votar na sugestao da plataforma.',
    });
  }
});

app.post('/api/platform-suggestions/:suggestionId/comments', async (req, res) => {
  try {
    const actor = await requireAuthenticatedSplittersUser(req);
    const suggestion = await addPlatformSuggestionComment({
      suggestionId: req.params?.suggestionId,
      message: req.body?.message,
      authorUid: actor.profile.uid,
      authorEmail: actor.profile.email || actor.identity.email,
      authorName:
        actor.profile.displayName ||
        actor.identity.name ||
        actor.profile.email ||
        actor.identity.email,
      authorPhotoURL: actor.profile.photoURL,
      viewerUid: actor.profile.uid,
    });
    return res.status(201).json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error ? error.message : 'Falha ao comentar na sugestao da plataforma.',
    });
  }
});

app.patch('/api/platform-suggestions/:suggestionId/status', async (req, res) => {
  try {
    const actor = await requireSplittersAdminAccess(
      req,
      'Somente administradores podem alterar o status das sugestoes.',
    );
    const suggestion = await updatePlatformSuggestionStatus({
      suggestionId: req.params?.suggestionId,
      status: req.body?.status,
      viewerUid: actor.profile.uid,
    });
    return res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Falha ao atualizar o status da sugestao da plataforma.',
    });
  }
});

app.put('/api/admin/isa-config', async (req, res) => {
  try {
    const actor = await requireIsaAdminAccess(req);
    const resetToDefault = req.body?.resetToDefault === true;

    let config;
    if (resetToDefault) {
      config = await resetIsaPromptConfig();
    } else {
      const rawSections = req.body?.sections;
      if (!rawSections || typeof rawSections !== 'object' || Array.isArray(rawSections)) {
        return res.status(400).json({
          success: false,
          message: 'Campo sections obrigatorio para salvar a configuracao da ISA.',
        });
      }

      config = await saveIsaPromptConfig({
        sections: rawSections,
        updatedByUid: actor.profile.uid,
        updatedByEmail: actor.profile.email || actor.identity.email,
      });
    }

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Falha ao salvar a configuracao da ISA.',
    });
  }
});

app.post('/api/isa/planning-assistant/chat', async (req, res) => {
  try {
    const message = normalizeAssistantText(req.body?.message);
    const splitterCode = normalizeAssistantText(req.body?.splitterCode);
    const conversationHistory = Array.isArray(req.body?.conversationHistory)
      ? req.body.conversationHistory
          .slice(-20)
          .map((turn) => ({
            userPrompt: normalizeAssistantText(turn?.userPrompt),
            assistantSummary: {
              conclusao: normalizeAssistantText(turn?.assistantSummary?.conclusao),
              decisao_operacional: normalizeAssistantText(turn?.assistantSummary?.decisao_operacional),
              acao_prioritaria: normalizeAssistantText(turn?.assistantSummary?.acao_prioritaria),
              recomendacao: normalizeAssistantText(turn?.assistantSummary?.recomendacao),
            },
          }))
          .filter((turn) => turn.userPrompt !== '')
      : [];
    const straightRadiusMeters = coercePositiveInt(
      req.body?.straightRadiusMeters,
      500,
    );
    const maxRouteMeters = coercePositiveInt(
      req.body?.maxRouteMeters,
      200,
    );

    if (message === '') {
      return res.status(400).json({
        success: false,
        message: 'Campo message obrigatorio.',
      });
    }

    if (!isPlanningAssistantConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Assistente ISA nao configurado no servidor.',
      });
    }

    const [context, promptConfig] = await Promise.all([
      buildPlanningAssistantContext({
        splitterCode,
        straightRadiusMeters,
        maxRouteMeters,
      }),
      readIsaPromptConfig(),
    ]);

    const result = await askPlanningAssistant({
      question: message,
      context,
      promptSections: Object.fromEntries(
        (promptConfig?.sections ?? []).map((section) => [section.key, section.value]),
      ),
      promptMeta: {
        source: promptConfig?.source,
        version: promptConfig?.version,
      },
      conversationHistory,
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({
      success: true,
      structuredAnswer: result.structured,
      model: result.model,
      contextPreview: {
        splitterCode: context?.splitter?.code ?? splitterCode,
        splitterTitle: context?.splitter?.title ?? null,
        found: context?.splitter?.found ?? splitterCode === '',
      },
    });
  } catch (error) {
    logger.error('planning_assistant_chat_error', { error });
    const statusCode = Number(error?.statusCode ?? 500);
    return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Falha ao consultar o assistente ISA.',
    });
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
      WHERE (
        TRIM(base."CÓDIGO[SPLT.SECUNDARIO]"::text) = TRIM($1::text)
        OR TRIM(base."SPLT.SECUNDARIO"::text) = TRIM($1::text)
      )
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
      WHERE (
        TRIM(base."CÓDIGO[SPLT.SECUNDARIO]"::text) = TRIM($1::text)
        OR TRIM(base."SPLT.SECUNDARIO"::text) = TRIM($1::text)
      )
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

// Patrimônios (equipamentos: roteador, ONU etc.) do cliente — banco principal.
// O parâmetro é o `client_id` (= people.id = cliente.clientId no app), NÃO o
// authenticationId da rota /clientes/:id. Cancelados ficam de fora.
const CLIENTE_PATRIMONIES_QUERY = `
SELECT
    p.client_id          AS "clientId",
    p.contract_id        AS "contractId",
    c.contract_number    AS "contractNumber",
    ct.title             AS "contractTypeTitle",
    c.v_status           AS "contractStatus",
    p.title              AS "patrimonyTitle",
    p.serial_number      AS "serialNumber",
    p.tag_number         AS "tagNumber",
    p.mac                AS "mac"
FROM patrimonies p
INNER JOIN people pe          ON pe.id = p.client_id
INNER JOIN contracts c        ON c.id  = p.contract_id
INNER JOIN contract_types ct  ON ct.id = c.contract_type_id
WHERE c.v_status <> 'Cancelado'
  AND p.client_id = $1
ORDER BY p.mac ASC
`;

app.get('/api/clientes/:clientId/patrimonios', async (req, res) => {
  try {
    const clientId = Number.parseInt(String(req.params.clientId), 10);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(400).json({ success: false, message: 'client_id inválido.' });
    }

    const result = await pool.query(CLIENTE_PATRIMONIES_QUERY, [clientId]);
    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erro ao buscar patrimônios do cliente:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Visão de frota de equipamentos (agregações sobre patrimonies — banco principal)
// ---------------------------------------------------------------------------

// População base: mesma da consulta por cliente (patrimonies ativos, contrato
// não cancelado). Agregamos no SQL para não trazer ~centenas de milhares de
// linhas; o tipo (roteador/ONU) e o Pareto são derivados no frontend.
const EQUIP_BASE_FROM = `
FROM patrimonies p
INNER JOIN people pe          ON pe.id = p.client_id
INNER JOIN contracts c        ON c.id  = p.contract_id
INNER JOIN contract_types ct  ON ct.id = c.contract_type_id
WHERE c.v_status <> 'Cancelado'
`;

const EQUIP_TOTALS_SQL = `
SELECT
  COUNT(*)                                                          AS total_patrimonies,
  COUNT(DISTINCT p.client_id)                                       AS distinct_clients,
  COUNT(DISTINCT NULLIF(TRIM(p.title), ''))                         AS distinct_models,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(p.serial_number), '') IS NULL) AS without_serial,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(p.mac), '') IS NULL)           AS without_mac
${EQUIP_BASE_FROM}
`;

const EQUIP_BY_MODEL_SQL = `
SELECT COALESCE(NULLIF(TRIM(p.title), ''), '(sem descrição)') AS model, COUNT(*) AS count
${EQUIP_BASE_FROM}
GROUP BY 1
ORDER BY count DESC, model ASC
`;

const EQUIP_BY_CONTRACT_STATUS_SQL = `
SELECT COALESCE(NULLIF(TRIM(c.v_status), ''), '(sem status)') AS status, COUNT(*) AS count
${EQUIP_BASE_FROM}
GROUP BY 1
ORDER BY count DESC
`;

// MACs repetidos: cada valor que aparece em mais de um patrimônio. Retornamos a
// contagem de grupos e o total de unidades envolvidas para o KPI de cadastro.
const EQUIP_DUP_MAC_SQL = `
SELECT COUNT(*) AS dup_groups, COALESCE(SUM(c2), 0) AS dup_units
FROM (
  SELECT TRIM(p.mac) AS mac, COUNT(*) AS c2
  ${EQUIP_BASE_FROM}
    AND NULLIF(TRIM(p.mac), '') IS NOT NULL
  GROUP BY 1
  HAVING COUNT(*) > 1
) d
`;

app.get('/api/equipamentos/overview', async (_req, res) => {
  try {
    const [totals, byModel, byStatus, dupMac] = await Promise.all([
      pool.query(EQUIP_TOTALS_SQL),
      pool.query(EQUIP_BY_MODEL_SQL),
      pool.query(EQUIP_BY_CONTRACT_STATUS_SQL),
      pool.query(EQUIP_DUP_MAC_SQL),
    ]);

    const t = totals.rows[0] ?? {};
    const dm = dupMac.rows[0] ?? {};

    return res.json({
      success: true,
      data: {
        totals: {
          totalPatrimonies: Number(t.total_patrimonies ?? 0),
          distinctClients: Number(t.distinct_clients ?? 0),
          distinctModels: Number(t.distinct_models ?? 0),
          withoutSerial: Number(t.without_serial ?? 0),
          withoutMac: Number(t.without_mac ?? 0),
          duplicateMacGroups: Number(dm.dup_groups ?? 0),
          duplicateMacUnits: Number(dm.dup_units ?? 0),
        },
        byModel: byModel.rows.map((r) => ({ model: r.model, count: Number(r.count) })),
        byContractStatus: byStatus.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      },
    });
  } catch (error) {
    console.error('Erro ao agregar overview de equipamentos:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Diagnóstico de ONU (banco de monitoramento — onuPool)
// ---------------------------------------------------------------------------

// O banco de monitoramento grava os timestamps SEM timezone, num relógio que
// está 3h adiantado em relação ao UTC (validado: a queda mais recente fica a
// poucos segundos quando interpretada assim). 'Etc/GMT-3' = UTC+3 no padrão
// POSIX. Usado para converter os naive em instante correto e calcular "há X".
// Se o coletor mudar de fuso, ajustar SÓ aqui.
const ONU_DB_TZ = 'Etc/GMT-3';

// Uma linha por pppoe_username (o cliente mais recente, caso haja mais de uma
// conexão para o mesmo login). As tabelas onu_statuses/onu_infos têm índice
// UNIQUE em gpon_client_id, e gpon_clients.pppoe_username é indexado — filtrar
// por username primeiro mantém a consulta leve mesmo com ~210k clientes.
const ONU_DIAGNOSTICS_QUERY = `
SELECT DISTINCT ON (gc.pppoe_username)
    gc.pppoe_username,
    gc.id                   AS gpon_client_id,
    gm.id                   AS gpon_mac_id,
    gm.mac,
    o.hostname              AS olt_hostname,
    oi.onu_model,
    oi.distance,
    oi.temperature,
    gm.created_at           AS gpon_mac_created_at,
    gm.updated_at           AS gpon_mac_updated_at,
    gm.serial_number        AS gpon_mac_serial_number,
    lgm.id                  AS related_gpon_mac_id,
    lgm.ponlink             AS related_ponlink,
    lgm.serial_number       AS related_serial_number,
    os.id                   AS onu_status_id,
    os.rx_good,
    os.rx_power,
    os.olt_olt_rx_power,
    os.zabbix_olt_rx_power,
    os.zabbix_onu_rx_power,
    os.olt_onu_status,
    os.status               AS onu_oper_status,
    os.calculated_status,
    os.tx_power,
    os.last_off,
    os.updated_at           AS onu_status_updated_at,
    -- Frescor do STATUS up/down (atualizado por trap/alarme, ~tempo real),
    -- distinto do updated_at das métricas (rxPower, atualizado em ondas lentas).
    EXTRACT(EPOCH FROM (now() - (
      GREATEST(os.status_update_timestamp, os.olt_onu_status_timestamp, os.calculated_status_timestamp)
      AT TIME ZONE '${ONU_DB_TZ}')))::bigint AS status_seen_age_seconds,
    EXTRACT(EPOCH FROM (now() - (os.last_off AT TIME ZONE '${ONU_DB_TZ}')))::bigint AS last_off_age_seconds,
    gc.power_threshold,
    gc.ponlink              AS client_ponlink,
    gc.onu                  AS onu_index,
    gc.splitter             AS gpon_splitter
FROM gpon_clients gc
LEFT JOIN gpon_macs gm
    ON gm.gpon_client_id = gc.id
LEFT JOIN gpon_macs lgm
    ON lgm.mac = gm.mac AND lgm.id <> gm.id
LEFT JOIN olts o
    ON o.id = gm.olt_id
LEFT JOIN onu_infos oi
    ON oi.gpon_client_id = gc.id
LEFT JOIN onu_statuses os
    ON os.gpon_client_id = gc.id
WHERE gc.pppoe_username = ANY($1::text[])
ORDER BY
    gc.pppoe_username,
    os.updated_at DESC NULLS LAST,
    gm.updated_at DESC NULLS LAST,
    gm.id DESC
`;

// Normaliza "null"/"" textuais (vindos do agente de coleta) para null real.
function cleanOnuText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;
  return s;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapOnuDiagnosticRow(row) {
  return {
    pppoeUsername: row.pppoe_username ?? null,
    gponClientId: row.gpon_client_id ?? null,
    gponMacId: row.gpon_mac_id ?? null,
    mac: cleanOnuText(row.mac),
    serialNumber: cleanOnuText(row.gpon_mac_serial_number),
    oltHostname: cleanOnuText(row.olt_hostname),
    onuModel: cleanOnuText(row.onu_model),
    distance: toNumberOrNull(row.distance),
    temperature: toNumberOrNull(row.temperature),
    relatedGponMacId: row.related_gpon_mac_id ?? null,
    relatedPonlink: cleanOnuText(row.related_ponlink),
    relatedSerialNumber: cleanOnuText(row.related_serial_number),
    onuStatusId: row.onu_status_id ?? null,
    rxGood: cleanOnuText(row.rx_good),
    rxPower: toNumberOrNull(row.rx_power),
    oltOltRxPower: toNumberOrNull(row.olt_olt_rx_power),
    zabbixOltRxPower: toNumberOrNull(row.zabbix_olt_rx_power),
    zabbixOnuRxPower: toNumberOrNull(row.zabbix_onu_rx_power),
    oltOnuStatus: cleanOnuText(row.olt_onu_status),
    onuOperStatus: cleanOnuText(row.onu_oper_status),
    calculatedStatus: cleanOnuText(row.calculated_status),
    txPower: toNumberOrNull(row.tx_power),
    lastOff: row.last_off ?? null,
    statusUpdatedAt: row.onu_status_updated_at ?? null,
    // Idade (s) do status up/down e da última queda — near-real-time (trap).
    statusSeenAgeSeconds: toNumberOrNull(row.status_seen_age_seconds),
    lastOffAgeSeconds: toNumberOrNull(row.last_off_age_seconds),
    powerThreshold: toNumberOrNull(row.power_threshold),
    ponlink: cleanOnuText(row.client_ponlink),
    onuIndex: row.onu_index ?? null,
    gponSplitter: cleanOnuText(row.gpon_splitter),
    // Fase 2: sinal projetado da porta alocada (outra plataforma). Mantido aqui
    // para o contrato não mudar quando a integração chegar.
    projectedRxPower: null,
  };
}

async function fetchOnuDiagnosticsByUsernames(usernames) {
  const list = Array.from(
    new Set(
      (usernames || [])
        .map((u) => String(u ?? '').trim())
        .filter((u) => u.length > 0),
    ),
  );
  if (list.length === 0) return [];
  const result = await onuPool.query(ONU_DIAGNOSTICS_QUERY, [list]);
  return result.rows.map(mapOnuDiagnosticRow);
}

// Diagnóstico de uma ONU pelo usuário PPPoE (= "user" do cliente no sistema principal).
app.get('/api/onu-diagnostics/by-username/:username', async (req, res) => {
  if (!onuPool) {
    return res
      .status(503)
      .json({ success: false, message: 'Banco de monitoramento de ONU não configurado.' });
  }
  try {
    const username = String(req.params.username ?? '').trim();
    if (!username) {
      return res.status(400).json({ success: false, message: 'Parâmetro username obrigatório.' });
    }
    const rows = await fetchOnuDiagnosticsByUsernames([username]);
    return res.json({ success: true, data: rows[0] ?? null });
  } catch (error) {
    console.error('Erro ao buscar diagnóstico de ONU:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Diagnóstico em lote (cards da lista de clientes). Body: { usernames: string[] }.
// Retorna um mapa { [username]: diagnostic } para casar fácil no frontend.
app.post('/api/onu-diagnostics/batch', async (req, res) => {
  if (!onuPool) {
    return res
      .status(503)
      .json({ success: false, message: 'Banco de monitoramento de ONU não configurado.' });
  }
  try {
    if (!Array.isArray(req.body?.usernames)) {
      return res
        .status(400)
        .json({ success: false, error: 'Body deve incluir "usernames" (array de strings).' });
    }
    const rows = await fetchOnuDiagnosticsByUsernames(req.body.usernames);
    const byUsername = {};
    for (const row of rows) {
      if (row.pppoeUsername) byUsername[row.pppoeUsername] = row;
    }
    return res.json({ success: true, count: rows.length, data: byUsername });
  } catch (error) {
    const isConnTimeout =
      error.message?.includes('Connection terminated') ||
      error.message?.includes('connection timeout') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT';
    if (isConnTimeout) {
      console.warn('[onu-batch] Banco de monitoramento inacessível — retornando dados vazios:', error.message);
      return res.status(503).json({ success: false, unavailable: true, data: {}, count: 0, error: 'Banco de monitoramento ONU inacessível.' });
    }
    console.error('Erro ao buscar diagnóstico de ONU em lote:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Resumo agregado da saúde de sinal da rede (Painel da Rede). Caro de calcular
// (agrega ~209k status), então cacheia em memória por 60s — o polling do
// frontend bate no cache, não no banco.
const ONU_SUMMARY_TTL_MS = 60_000;
const ONU_SUMMARY_WORST_LIMIT = 25;
const ONU_SUMMARY_HEAT_LIMIT = 8000;
const ONU_SUMMARY_MARKER_LIMIT = 2000;
const ONU_SUMMARY_OLT_LIMIT = 30;
const ONU_SUMMARY_HOT_LIMIT = 25;
// Limiares de temperatura da ONU (°C). Faixa de operação típica de ONUs GPON
// chega a ~65 °C; acima disso há risco térmico crescente de falha de hardware.
const ONU_TEMP_WARM_C = 60;
const ONU_TEMP_HOT_C = 70;
// Faixa de leitura válida — descarta 0/negativos (sensor ausente) e absurdos.
const ONU_TEMP_MIN_VALID = 1;
const ONU_TEMP_MAX_VALID = 120;
let onuSummaryCache = { at: 0, payload: null };
// Single-flight: enquanto um cálculo do resumo está em andamento, novas
// requisições aguardam o MESMO resultado em vez de disparar outro (evita
// "cache stampede" — N usuários rebuildando em paralelo na virada do cache).
let onuSummaryInflight = null;
function buildOnuSummaryOnce() {
  if (onuSummaryInflight) return onuSummaryInflight;
  onuSummaryInflight = buildOnuNetworkSummary()
    .then((payload) => {
      onuSummaryCache = { at: Date.now(), payload };
      return payload;
    })
    .finally(() => {
      // Limpa a trava em sucesso E em falha — erro transitório não fica preso.
      onuSummaryInflight = null;
    });
  return onuSummaryInflight;
}

// Classificação de estado de uma ONU, na MESMA ordem/regra do
// deriveOnuSignalStatus do front. PRIORIDADE: calculated_status (reconciliado
// pela monitoração, fresco) sobre os campos brutos (olt_onu_status pode ficar
// horas velho). Fallback para os brutos só quando o reconciliado falta.
const ONU_BUCKET_CASE = `
  CASE
    WHEN os.rx_power = 0 THEN 'offline'
    WHEN lower(os.calculated_status) IN ('down','offline','power_fail','loss_signal','inactive') THEN 'offline'
    WHEN lower(os.calculated_status) IN ('ok','up') THEN
      CASE WHEN os.rx_power IS NOT NULL AND os.rx_power <= -25 THEN 'degraded' ELSE 'online' END
    WHEN lower(os.calculated_status) IN ('warning','critical') THEN 'degraded'
    -- Fallback: sem calculated_status confiável, usa os campos brutos.
    WHEN os.olt_onu_status IN ('down','power_fail','loss_signal')
         OR os.rx_good IN ('inactive','power_fail','down','loss_signal') THEN 'offline'
    WHEN os.olt_onu_status = 'up'
         AND (os.rx_good IN ('warning','critical','unavailable')
              OR (os.rx_power IS NOT NULL AND os.rx_power <= -25)) THEN 'degraded'
    WHEN os.olt_onu_status = 'up' THEN 'online'
    ELSE 'unknown'
  END`;

// "Operante" = ONU no ar segundo o estado reconciliado (ok/up/warning/critical),
// com fallback ao bruto (olt_onu_status='up') quando o reconciliado falta. Usado
// para filtrar as distribuições de sinal (só de quem está operante).
const ONU_OPERANTE = `(
  lower(os.calculated_status) IN ('ok','up','warning','critical')
  OR (os.calculated_status IS NULL AND os.olt_onu_status = 'up')
)`;

// `onu_infos.temperature` pode estar como numeric OU varchar. Cast seguro por
// regex: vira número só quando o texto é numérico (senão NULL), evitando que
// AVG/comparação quebre a query inteira se a coluna for texto com lixo.
const ONU_TEMP_NUMERIC = `CASE WHEN oi.temperature::text ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN oi.temperature::text::numeric END`;

async function buildOnuNetworkSummary() {
  // Base canônica: gpon_macs com gpon_client_id (= ONU ativo com MAC atribuído),
  // deduplicada por pppoe_username (status mais recente por cliente). Mesma
  // população da query de diagnóstico individual.
  //
  // A quebra por OLT já carrega TODAS as contagens (online/degraded/offline/
  // unknown/critical) — os totais da rede são derivados somando as OLTs, então
  // não precisamos de uma query de totais separada.
  const oltBreakdownSql = `
    SELECT
      COALESCE(NULLIF(TRIM(olt_hostname), ''), 'Sem OLT') AS olt,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE bucket = 'online')::int AS online,
      COUNT(*) FILTER (WHERE bucket = 'degraded')::int AS degraded,
      COUNT(*) FILTER (WHERE bucket = 'offline')::int AS offline,
      COUNT(*) FILTER (WHERE bucket = 'unknown')::int AS unknown,
      COUNT(*) FILTER (WHERE is_critical)::int AS critical
    FROM (
      SELECT DISTINCT ON (gc.pppoe_username)
        o.hostname AS olt_hostname,
        ${ONU_BUCKET_CASE} AS bucket,
        (os.rx_power IS NOT NULL AND os.rx_power <= -28) AS is_critical
      FROM gpon_macs gm
      JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
      JOIN onu_statuses os ON os.gpon_client_id = gc.id
      LEFT JOIN olts o ON o.id = gm.olt_id
      WHERE gm.gpon_client_id IS NOT NULL
      ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST
    ) t
    GROUP BY olt`;

  // Estatísticas de distribuição do sinal de recepção das ONUs online.
  const signalStatsSql = `
    SELECT
      COUNT(*)::int AS n,
      ROUND(AVG(rx_power)::numeric, 2) AS avg,
      ROUND(percentile_cont(0.10) WITHIN GROUP (ORDER BY rx_power)::numeric, 2) AS p10,
      ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY rx_power)::numeric, 2) AS p50,
      ROUND(percentile_cont(0.90) WITHIN GROUP (ORDER BY rx_power)::numeric, 2) AS p90
    FROM (
      SELECT DISTINCT ON (gc.pppoe_username) os.rx_power
      FROM gpon_macs gm
      JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
      JOIN onu_statuses os ON os.gpon_client_id = gc.id
      WHERE gm.gpon_client_id IS NOT NULL
        AND os.rx_power IS NOT NULL AND os.rx_power < 0 AND ${ONU_OPERANTE}
      ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST
    ) t`;

  const histogramSql = `
    SELECT width_bucket(rx_power, -40, 0, 8) AS b, COUNT(*)::int AS n FROM (
      SELECT DISTINCT ON (gc.pppoe_username) os.rx_power
      FROM gpon_macs gm
      JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
      JOIN onu_statuses os ON os.gpon_client_id = gc.id
      WHERE gm.gpon_client_id IS NOT NULL
        AND os.rx_power IS NOT NULL AND os.rx_power < 0 AND ${ONU_OPERANTE}
      ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST
    ) t GROUP BY b ORDER BY b`;

  const worstSql = `
    SELECT DISTINCT ON (gc.pppoe_username)
      gc.pppoe_username, os.rx_power, os.olt_onu_status, os.rx_good, o.hostname AS olt
    FROM gpon_macs gm
    JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
    JOIN onu_statuses os ON os.gpon_client_id = gc.id
    LEFT JOIN olts o ON o.id = gm.olt_id
    WHERE gm.gpon_client_id IS NOT NULL
      AND ${ONU_OPERANTE} AND os.rx_power IS NOT NULL AND os.rx_power <= -25
    ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST`;

  // Pontos com problema + identidade (cliente/OLT/sinal), para o mapa: heat de
  // densidade dos atenuados e marcadores clicáveis dos offline/críticos.
  const heatSql = `
    SELECT DISTINCT ON (gc.pppoe_username)
      gc.pppoe_username, gc.latitude, gc.longitude,
      os.calculated_status, os.olt_onu_status, os.rx_power, o.hostname AS olt
    FROM gpon_macs gm
    JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
    JOIN onu_statuses os ON os.gpon_client_id = gc.id
    LEFT JOIN olts o ON o.id = gm.olt_id
    WHERE gm.gpon_client_id IS NOT NULL
      AND gc.latitude IS NOT NULL AND gc.latitude <> ''
      AND gc.longitude IS NOT NULL AND gc.longitude <> ''
      AND (
        os.rx_power = 0
        OR lower(os.calculated_status) IN ('down','offline','power_fail','loss_signal','inactive')
        OR (os.rx_power IS NOT NULL AND os.rx_power <= -25)
      )
    ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST
    LIMIT ${ONU_SUMMARY_HEAT_LIMIT}`;

  // Temperatura das ONUs online (onu_infos), para detectar superaquecimento.
  const tempStatsSql = `
    SELECT
      COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE temp >= ${ONU_TEMP_WARM_C})::int AS warm,
      COUNT(*) FILTER (WHERE temp >= ${ONU_TEMP_HOT_C})::int AS hot,
      ROUND(AVG(temp)::numeric, 1) AS avg,
      ROUND(MAX(temp)::numeric, 1) AS max
    FROM (
      SELECT DISTINCT ON (gc.pppoe_username) (${ONU_TEMP_NUMERIC}) AS temp
      FROM gpon_macs gm
      JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
      JOIN onu_statuses os ON os.gpon_client_id = gc.id
      LEFT JOIN onu_infos oi ON oi.gpon_client_id = gc.id
      WHERE gm.gpon_client_id IS NOT NULL
        AND os.olt_onu_status = 'up'
        AND oi.temperature IS NOT NULL
      ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST
    ) t
    WHERE temp IS NOT NULL AND temp >= ${ONU_TEMP_MIN_VALID} AND temp < ${ONU_TEMP_MAX_VALID}`;

  const hottestSql = `
    SELECT pppoe_username, temp AS temperature, rx_power, olt FROM (
      SELECT DISTINCT ON (gc.pppoe_username)
        gc.pppoe_username, (${ONU_TEMP_NUMERIC}) AS temp, os.rx_power, o.hostname AS olt
      FROM gpon_macs gm
      JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
      JOIN onu_statuses os ON os.gpon_client_id = gc.id
      LEFT JOIN onu_infos oi ON oi.gpon_client_id = gc.id
      LEFT JOIN olts o ON o.id = gm.olt_id
      WHERE gm.gpon_client_id IS NOT NULL
        AND os.olt_onu_status = 'up'
        AND oi.temperature IS NOT NULL
      ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST
    ) t
    WHERE temp >= ${ONU_TEMP_WARM_C} AND temp < ${ONU_TEMP_MAX_VALID}`;

  // Resiliência: a quebra por OLT é o núcleo (totais derivam dela) — se falhar,
  // o resumo falha de verdade. As demais são enriquecimentos: se uma falhar
  // (timeout, tipo inesperado), degrada para vazio em vez de derrubar o painel.
  const runSafe = async (sql, label) => {
    try {
      return await onuPool.query(sql);
    } catch (e) {
      console.error(`Resumo de ONU: query "${label}" falhou (seguindo sem ela):`, e.message);
      return { rows: [] };
    }
  };
  const oltR = await onuPool.query(oltBreakdownSql);
  const [statsR, histR, worstR, heatR, tempR, hottestR] = await Promise.all([
    runSafe(signalStatsSql, 'signalStats'),
    runSafe(histogramSql, 'histogram'),
    runSafe(worstSql, 'worst'),
    runSafe(heatSql, 'heat'),
    runSafe(tempStatsSql, 'tempStats'),
    runSafe(hottestSql, 'hottest'),
  ]);

  // Totais da rede = soma de todas as OLTs.
  const buckets = { online: 0, degraded: 0, offline: 0, unknown: 0 };
  let criticalSignal = 0;
  const oltRows = oltR.rows.map((r) => {
    const online = Number(r.online) || 0;
    const degraded = Number(r.degraded) || 0;
    const offline = Number(r.offline) || 0;
    const unknown = Number(r.unknown) || 0;
    const critical = Number(r.critical) || 0;
    buckets.online += online;
    buckets.degraded += degraded;
    buckets.offline += offline;
    buckets.unknown += unknown;
    criticalSignal += critical;
    const monitored = online + degraded + offline;
    return {
      olt: r.olt,
      total: Number(r.total) || 0,
      online,
      degraded,
      offline,
      unknown,
      critical,
      monitored,
      // Taxa de problema = (offline + atenuado) / monitoradas da OLT.
      problemRate: monitored > 0 ? (offline + degraded) / monitored : 0,
      offlineRate: monitored > 0 ? offline / monitored : 0,
    };
  });
  const total = buckets.online + buckets.degraded + buckets.offline + buckets.unknown;
  const oltCount = oltRows.length;

  // OLTs mais afetadas: prioriza volume absoluto de problemas (offline + atenuado),
  // que é o que mais impacta a operação; desempata pela taxa.
  const oltBreakdown = oltRows
    .filter((o) => o.monitored > 0)
    .sort((a, b) => {
      const pa = a.offline + a.degraded;
      const pb = b.offline + b.degraded;
      if (pb !== pa) return pb - pa;
      return b.problemRate - a.problemRate;
    })
    .slice(0, ONU_SUMMARY_OLT_LIMIT);

  const statsRow = statsR.rows[0] ?? {};
  const signalStats = {
    sampled: Number(statsRow.n) || 0,
    avg: toNumberOrNull(statsRow.avg),
    p10: toNumberOrNull(statsRow.p10),
    p50: toNumberOrNull(statsRow.p50),
    p90: toNumberOrNull(statsRow.p90),
  };

  const histLabels = [
    '-40 a -35', '-35 a -30', '-30 a -25', '-25 a -20',
    '-20 a -15', '-15 a -10', '-10 a -5', '-5 a 0',
  ];
  const histCounts = new Array(8).fill(0);
  for (const row of histR.rows) {
    const i = Number(row.b);
    if (i >= 1 && i <= 8) histCounts[i - 1] = row.n;
  }
  const histogram = histLabels.map((label, i) => ({
    label,
    count: histCounts[i],
    // Faixas (dBm) → banda de qualidade para colorir as barras.
    // Crítico abaixo de -30, atenção entre -30 e -25, saudável acima de -25.
    band: i <= 1 ? 'critical' : i === 2 ? 'warning' : 'ok',
  }));

  const worst = worstR.rows
    .map((r) => ({
      username: r.pppoe_username ?? null,
      oltHostname: cleanOnuText(r.olt),
      rxPower: toNumberOrNull(r.rx_power),
      oltOnuStatus: cleanOnuText(r.olt_onu_status),
      rxGood: cleanOnuText(r.rx_good),
    }))
    .filter((r) => r.rxPower !== null)
    .sort((a, b) => a.rxPower - b.rxPower)
    .slice(0, ONU_SUMMARY_WORST_LIMIT);

  // Heat = densidade dos ATENUADOS (massa). Marcadores clicáveis = OFFLINE e
  // CRÍTICOS. Offline usa o calculated_status RECONCILIADO (fresco) — não o
  // olt_onu_status bruto, que pode estar horas velho e gerar falso-offline.
  const OFFLINE_CALC = ['down', 'offline', 'power_fail', 'loss_signal', 'inactive'];
  const heatPoints = [];
  const problemMarkers = [];
  for (const r of heatR.rows) {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const rx = toNumberOrNull(r.rx_power);
    const calc = String(r.calculated_status ?? '').trim().toLowerCase();
    const isOffline = rx === 0 || OFFLINE_CALC.includes(calc);
    const kind = isOffline ? 'offline' : rx !== null && rx <= -28 ? 'critical' : 'degraded';

    if (kind === 'degraded') {
      // Peso proporcional à atenuação abaixo de -25 dBm.
      const weight = rx !== null ? Math.min(1, Math.max(0.3, (Math.abs(rx) - 25) / 15)) : 0.3;
      heatPoints.push([lat, lng, Number(weight.toFixed(2))]);
    } else if (problemMarkers.length < ONU_SUMMARY_MARKER_LIMIT) {
      problemMarkers.push({
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        kind,
        username: r.pppoe_username ?? null,
        oltHostname: cleanOnuText(r.olt),
        rxPower: rx,
      });
    }
  }

  const tempRow = tempR.rows[0] ?? {};
  const temperature = {
    sampled: Number(tempRow.n) || 0,
    warm: Number(tempRow.warm) || 0, // >= ONU_TEMP_WARM_C
    hot: Number(tempRow.hot) || 0, // >= ONU_TEMP_HOT_C
    avg: toNumberOrNull(tempRow.avg),
    max: toNumberOrNull(tempRow.max),
    warmThreshold: ONU_TEMP_WARM_C,
    hotThreshold: ONU_TEMP_HOT_C,
    hottest: hottestR.rows
      .map((r) => ({
        username: r.pppoe_username ?? null,
        oltHostname: cleanOnuText(r.olt),
        temperature: toNumberOrNull(r.temperature),
        rxPower: toNumberOrNull(r.rx_power),
      }))
      .filter((r) => r.temperature !== null)
      .sort((a, b) => b.temperature - a.temperature)
      .slice(0, ONU_SUMMARY_HOT_LIMIT),
  };

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      total,
      online: buckets.online,
      degraded: buckets.degraded,
      offline: buckets.offline,
      noData: buckets.unknown,
      criticalSignal,
    },
    signalStats,
    temperature,
    oltCount,
    oltBreakdown,
    histogram,
    worst,
    heatPoints,
    problemMarkers,
  };
}

app.get('/api/onu-diagnostics/summary', async (req, res) => {
  if (!onuPool) {
    return res
      .status(503)
      .json({ success: false, message: 'Banco de monitoramento de ONU não configurado.' });
  }
  try {
    const now = Date.now();
    const force = String(req.query.force ?? '') === 'true';
    if (!force && onuSummaryCache.payload && now - onuSummaryCache.at < ONU_SUMMARY_TTL_MS) {
      return res.json({ success: true, cached: true, data: onuSummaryCache.payload });
    }
    const payload = await buildOnuSummaryOnce();
    return res.json({ success: true, cached: false, data: payload });
  } catch (error) {
    console.error('Erro ao montar resumo de ONU da rede:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Saúde de sinal agregada POR MODELO de ONU (banco de monitoramento). Responde
// "quais modelos concentram clientes com sinal ruim?" — usa onu_infos.onu_model
// (modelo real visto pela OLT) e a MESMA classificação de status do summary.
const ONU_BY_MODEL_TTL_MS = 60_000;
let onuByModelCache = { at: 0, payload: null };
let onuByModelInflight = null;

const ONU_BY_MODEL_SQL = `
  SELECT
    COALESCE(NULLIF(TRIM(onu_model), ''), '(modelo não informado)') AS model,
    COUNT(*)::int                                  AS total,
    COUNT(*) FILTER (WHERE bucket = 'online')::int   AS online,
    COUNT(*) FILTER (WHERE bucket = 'degraded')::int AS degraded,
    COUNT(*) FILTER (WHERE bucket = 'offline')::int  AS offline,
    COUNT(*) FILTER (WHERE bucket = 'unknown')::int  AS unknown,
    COUNT(*) FILTER (WHERE is_critical)::int         AS critical,
    ROUND(AVG(rx_power) FILTER (
      WHERE operante AND rx_power IS NOT NULL AND rx_power < 0
    )::numeric, 2)                                   AS avg_rx
  FROM (
    SELECT DISTINCT ON (gc.pppoe_username)
      oi.onu_model,
      ${ONU_BUCKET_CASE} AS bucket,
      (os.rx_power IS NOT NULL AND os.rx_power <= -28) AS is_critical,
      os.rx_power,
      ${ONU_OPERANTE} AS operante
    FROM gpon_macs gm
    JOIN gpon_clients gc ON gc.id = gm.gpon_client_id
    JOIN onu_statuses os ON os.gpon_client_id = gc.id
    LEFT JOIN onu_infos oi ON oi.gpon_client_id = gc.id
    WHERE gm.gpon_client_id IS NOT NULL
    ORDER BY gc.pppoe_username, os.updated_at DESC NULLS LAST
  ) t
  GROUP BY model
  ORDER BY total DESC`;

async function buildOnuByModel() {
  const result = await onuPool.query(ONU_BY_MODEL_SQL);
  return {
    generatedAt: new Date().toISOString(),
    models: result.rows.map((r) => ({
      model: r.model,
      total: Number(r.total ?? 0),
      online: Number(r.online ?? 0),
      degraded: Number(r.degraded ?? 0),
      offline: Number(r.offline ?? 0),
      unknown: Number(r.unknown ?? 0),
      critical: Number(r.critical ?? 0),
      avgRx: r.avg_rx === null || r.avg_rx === undefined ? null : Number(r.avg_rx),
    })),
  };
}

function buildOnuByModelOnce() {
  if (onuByModelInflight) return onuByModelInflight;
  onuByModelInflight = buildOnuByModel()
    .then((payload) => {
      onuByModelCache = { at: Date.now(), payload };
      return payload;
    })
    .finally(() => {
      onuByModelInflight = null;
    });
  return onuByModelInflight;
}

app.get('/api/onu-diagnostics/by-model', async (req, res) => {
  if (!onuPool) {
    return res
      .status(503)
      .json({ success: false, message: 'Banco de monitoramento de ONU não configurado.' });
  }
  try {
    const now = Date.now();
    const force = String(req.query.force ?? '') === 'true';
    if (!force && onuByModelCache.payload && now - onuByModelCache.at < ONU_BY_MODEL_TTL_MS) {
      return res.json({ success: true, cached: true, data: onuByModelCache.payload });
    }
    const payload = await buildOnuByModelOnce();
    return res.json({ success: true, cached: false, data: payload });
  } catch (error) {
    console.error('Erro ao agregar sinal por modelo de ONU:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Feed near-real-time de mudanças de status (quedas/recuperações), lendo o log
// onu_status_changes. Ordena por id DESC (PK, monotônico ≈ tempo) p/ usar índice
// — varredura barata mesmo com ~3,3M linhas; filtra/classifica em JS.
const ONU_OFFLINE_STATES = new Set(['down', 'power_fail', 'loss_signal']);
const ONU_CHANGES_SCAN = 400; // linhas mais recentes lidas do log
const ONU_CHANGES_RETURN = 60; // eventos relevantes devolvidos
const ONU_CHANGES_TTL_MS = 15_000;
let onuChangesCache = { at: 0, payload: null };
// Single-flight (mesmo padrão do resumo) — evita rebuilds paralelos do feed.
let onuChangesInflight = null;
function buildOnuRecentChangesOnce() {
  if (onuChangesInflight) return onuChangesInflight;
  onuChangesInflight = buildOnuRecentChanges()
    .then((payload) => {
      onuChangesCache = { at: Date.now(), payload };
      return payload;
    })
    .finally(() => {
      onuChangesInflight = null;
    });
  return onuChangesInflight;
}

const ONU_RECENT_CHANGES_QUERY = `
  SELECT
    osc.id,
    osc.previous_status,
    osc.new_status,
    osc.new_status_trigger,
    osc.previous_rx_power,
    osc.new_rx_power,
    osc.new_status_timestamp AS at,
    EXTRACT(EPOCH FROM (now() - osc.new_status_timestamp))::bigint AS age_seconds,
    gc.pppoe_username,
    olt.hostname AS olt
  FROM onu_status_changes osc
  JOIN gpon_clients gc ON gc.id = osc.gpon_client_id
  LEFT JOIN LATERAL (
    SELECT o.hostname
    FROM gpon_macs gm
    JOIN olts o ON o.id = gm.olt_id
    WHERE gm.gpon_client_id = gc.id AND gm.olt_id IS NOT NULL
    ORDER BY gm.updated_at DESC NULLS LAST
    LIMIT 1
  ) olt ON true
  ORDER BY osc.id DESC
  LIMIT ${ONU_CHANGES_SCAN}`;

function normState(value) {
  return String(value ?? '').trim().toLowerCase();
}

async function buildOnuRecentChanges() {
  const result = await onuPool.query(ONU_RECENT_CHANGES_QUERY);
  const events = [];
  for (const r of result.rows) {
    const next = normState(r.new_status);
    const prev = normState(r.previous_status);
    const nextOffline = ONU_OFFLINE_STATES.has(next);
    const prevOffline = ONU_OFFLINE_STATES.has(prev);

    // Só interessam transições: caiu (queda) ou voltou (recuperação).
    let kind = null;
    if (nextOffline && !prevOffline) kind = 'drop';
    else if (!nextOffline && prevOffline) kind = 'recovery';
    if (!kind) continue;

    events.push({
      id: Number(r.id),
      kind,
      previousStatus: cleanOnuText(r.previous_status),
      newStatus: cleanOnuText(r.new_status),
      trigger: cleanOnuText(r.new_status_trigger),
      previousRxPower: toNumberOrNull(r.previous_rx_power),
      newRxPower: toNumberOrNull(r.new_rx_power),
      at: r.at ?? null,
      ageSeconds: toNumberOrNull(r.age_seconds),
      username: r.pppoe_username ?? null,
      oltHostname: cleanOnuText(r.olt),
    });
    if (events.length >= ONU_CHANGES_RETURN) break;
  }
  const drops = events.filter((e) => e.kind === 'drop').length;
  return {
    generatedAt: new Date().toISOString(),
    drops,
    recoveries: events.length - drops,
    events,
  };
}

app.get('/api/onu-diagnostics/recent-changes', async (req, res) => {
  if (!onuPool) {
    return res
      .status(503)
      .json({ success: false, message: 'Banco de monitoramento de ONU não configurado.' });
  }
  try {
    const now = Date.now();
    const force = String(req.query.force ?? '') === 'true';
    if (!force && onuChangesCache.payload && now - onuChangesCache.at < ONU_CHANGES_TTL_MS) {
      return res.json({ success: true, cached: true, data: onuChangesCache.payload });
    }
    const payload = await buildOnuRecentChangesOnce();
    return res.json({ success: true, cached: false, data: payload });
  } catch (error) {
    console.error('Erro ao montar feed de mudanças de ONU:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Resumo de sinal ONU agrupado por código de splitter — alimenta os cards da
// listagem sem N queries individuais. Cache 60s + single-flight.
const ONU_SPLITTER_SUMMARY_TTL_MS = 60_000;
let onuSplitterSummaryCache = { at: 0, payload: null };
let onuSplitterSummaryInflight = null;

// Query 1 (main DB): username → splitter code + título legível.
const ONU_SPLITTER_USERNAME_MAP_SQL = `
SELECT DISTINCT ac."user" AS pppoe_username, ss.code AS splitter_code, ss.title AS splitter_title
FROM authentication_splitter_ports ssp
JOIN authentication_splitters ss ON ss.id = ssp.authentication_splitter_id
JOIN authentication_contracts  ac ON ac.id = ssp.authentication_contract_id
WHERE ssp.deleted = FALSE
  AND ssp.busy    = TRUE
  AND ac."user"   IS NOT NULL
  AND ss.code     IS NOT NULL
`;

// Query 2 (monitoring DB): status/bucket por username (DISTINCT ON = mais recente).
const ONU_SPLITTER_STATUS_SQL = `
SELECT DISTINCT ON (gc.pppoe_username)
  gc.pppoe_username,
  os.rx_power,
  ${ONU_BUCKET_CASE} AS bucket
FROM gpon_macs gm
JOIN  gpon_clients  gc ON gc.id = gm.gpon_client_id
LEFT JOIN onu_statuses os ON os.gpon_client_id = gc.id
WHERE gm.gpon_client_id IS NOT NULL
  AND gc.pppoe_username  IS NOT NULL
ORDER BY gc.pppoe_username,
         os.updated_at  DESC NULLS LAST,
         gm.updated_at  DESC NULLS LAST,
         gm.id          DESC
`;

// Query 3 (main DB): um nome de cliente representativo por splitter — o sinal
// projetado no GeoGrid é idêntico para toda a fibra, então um único lookup basta.
const ONU_SPLITTER_CLIENT_NAME_SQL = `
SELECT DISTINCT ON (ss.code)
  ss.code AS splitter_code,
  p.name  AS client_name
FROM authentication_splitter_ports ssp
JOIN authentication_splitters ss ON ss.id = ssp.authentication_splitter_id
JOIN authentication_contracts  ac ON ac.id = ssp.authentication_contract_id
JOIN contracts ct ON ct.id = ac.contract_id
JOIN people    p  ON p.id  = ct.client_id
WHERE ssp.deleted = FALSE
  AND ssp.busy    = TRUE
  AND ss.code     IS NOT NULL
  AND p.name      IS NOT NULL
ORDER BY ss.code
`;

async function buildOnuSplitterSummary() {
  // Executa as três queries em paralelo — as duas do main DB e a do monitoring são independentes.
  const [[mainResult, clientNameResult], monitorResult] = await Promise.all([
    Promise.all([
      pool.query(ONU_SPLITTER_USERNAME_MAP_SQL),
      pool.query(ONU_SPLITTER_CLIENT_NAME_SQL),
    ]),
    onuPool.query(ONU_SPLITTER_STATUS_SQL),
  ]);

  // Mapa: pppoe_username → splitter_code.
  const splitterByUser = new Map();
  // Mapa: splitter_code → splitter_title (nome legível).
  const titleByCode = new Map();
  for (const row of mainResult.rows) {
    if (row.pppoe_username && row.splitter_code) {
      const code = String(row.splitter_code).trim();
      splitterByUser.set(String(row.pppoe_username).trim(), code);
      if (row.splitter_title && !titleByCode.has(code)) {
        titleByCode.set(code, String(row.splitter_title).trim());
      }
    }
  }

  // Mapa: splitter_code → client_name (para busca de sinal projetado no GeoGrid).
  const nameByCode = new Map();
  for (const row of clientNameResult.rows) {
    if (row.splitter_code && row.client_name) {
      nameByCode.set(String(row.splitter_code).trim(), String(row.client_name).trim());
    }
  }

  // Agrega bucket + rxPower por splitter_code.
  const agg = new Map();
  for (const row of monitorResult.rows) {
    const username = String(row.pppoe_username ?? '').trim();
    const code = splitterByUser.get(username);
    if (!code) continue;

    if (!agg.has(code)) {
      agg.set(code, { total: 0, online: 0, degraded: 0, offline: 0, rxValues: [], title: titleByCode.get(code) ?? null });
    }
    const entry = agg.get(code);
    entry.total++;
    if (row.bucket === 'online') entry.online++;
    else if (row.bucket === 'degraded') entry.degraded++;
    else if (row.bucket === 'offline') entry.offline++;
    const rx = toNumberOrNull(row.rx_power);
    if (rx !== null && rx < 0) entry.rxValues.push(rx);
  }

  const data = {};
  for (const [code, entry] of agg) {
    const avg = entry.rxValues.length > 0
      ? Math.round((entry.rxValues.reduce((a, b) => a + b, 0) / entry.rxValues.length) * 10) / 10
      : null;
    data[code] = {
      title:            entry.title,
      total:            entry.total,
      online:           entry.online,
      degraded:         entry.degraded,
      offline:          entry.offline,
      avgRxPower:       avg,
      projectedRxPower: null,
    };
  }

  // Sinal projetado via GeoGrid — um nome representativo por splitter.
  // O valor projetado é idêntico para todos os clientes no mesmo splitter (mesma fibra),
  // então um único lookup por splitter é suficiente. Falha do GeoGrid não impede o retorno.
  if (geogridBaseUrl && geogridApiKey) {
    try {
      const normToCode = new Map();
      for (const [code] of agg) {
        const rawName = nameByCode.get(code);
        if (!rawName) continue;
        const norm = normalizeGeoName(rawName);
        if (!norm.includes(',')) normToCode.set(norm, code);
      }

      if (normToCode.size > 0) {
        const params = new URLSearchParams({
          nomes: [...normToCode.keys()].join(','),
          pagina: '1',
          registrosPorPagina: String(Math.max(100, normToCode.size + 20)),
        });
        const geoResult = await geogridProxyGetJson(`/clientesAtendimentos?${params.toString()}`);
        for (const reg of geoResult?.registros ?? []) {
          const normName = normalizeGeoName(String(reg.nome ?? ''));
          const code = normToCode.get(normName);
          if (!code || !data[code]) continue;
          for (const at of reg.atendimentos ?? []) {
            const pf = at?.potencia?.potenciaFinal;
            if (typeof pf === 'number' && Number.isFinite(pf)) {
              data[code].projectedRxPower = pf;
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('GeoGrid indisponível para sinal projetado por splitter:', err.message);
    }
  }

  return data;
}

function buildOnuSplitterSummaryOnce() {
  if (onuSplitterSummaryInflight) return onuSplitterSummaryInflight;
  onuSplitterSummaryInflight = buildOnuSplitterSummary()
    .then((payload) => {
      onuSplitterSummaryCache = { at: Date.now(), payload };
      return payload;
    })
    .finally(() => { onuSplitterSummaryInflight = null; });
  return onuSplitterSummaryInflight;
}

app.get('/api/onu-diagnostics/summary-by-splitter', async (req, res) => {
  if (!onuPool) {
    return res
      .status(503)
      .json({ success: false, message: 'Banco de monitoramento de ONU não configurado.' });
  }
  try {
    const now = Date.now();
    const force = String(req.query.force ?? '') === 'true';
    if (!force && onuSplitterSummaryCache.payload && now - onuSplitterSummaryCache.at < ONU_SPLITTER_SUMMARY_TTL_MS) {
      return res.json({ success: true, cached: true, data: onuSplitterSummaryCache.payload });
    }
    const payload = await buildOnuSplitterSummaryOnce();
    return res.json({ success: true, cached: false, data: payload });
  } catch (error) {
    const isConnTimeout =
      error.message?.includes('Connection terminated') ||
      error.message?.includes('connection timeout') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT';
    if (isConnTimeout) {
      console.warn('[onu-summary-splitter] Banco inacessível:', error.message);
      return res.status(503).json({ success: false, unavailable: true, data: {} });
    }
    console.error('Erro ao montar resumo ONU por splitter:', error.message, error.code ?? '', error.detail ?? '');
    return res.status(500).json({ success: false, error: error.message, code: error.code ?? null });
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
        total_port_capacity: n(row.total_port_capacity),
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

      const hasReliefSnapshot = await massivaHistoryStore.hasCompletedNetworkReliefSnapshot(
        SPLITTER_MAP_STRAIGHT_RADIUS_METERS,
        STREET_RELIEF_MAX_ROUTE_METERS,
      );
      if (
        !hasReliefSnapshot &&
        !isNetworkReliefSnapshotInflight(
          SPLITTER_MAP_STRAIGHT_RADIUS_METERS,
          STREET_RELIEF_MAX_ROUTE_METERS,
        )
      ) {
        scheduleNetworkReliefSnapshotCapture(
          SPLITTER_MAP_STRAIGHT_RADIUS_METERS,
          STREET_RELIEF_MAX_ROUTE_METERS,
        );
        logger.info(
          '[network-relief-snapshot] Snapshot 200 m ausente — captura em background iniciada (leitura da fila usa só a tabela).',
        );
      }
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

  const networkReliefSnapshotCronDisabled =
    String(process.env.NETWORK_RELIEF_SNAPSHOT_CRON_DISABLED ?? '').toLowerCase() === 'true';
  const networkReliefSnapshotCronExpr = (process.env.NETWORK_RELIEF_SNAPSHOT_CRON ?? '*/10 * * * *').trim();
  if (!massivaHistoryStore.configured) {
    logger.info('[network-relief-snapshot] Cron não registrado (MySQL não configurado).');
  } else if (!networkReliefSnapshotCronDisabled) {
    cron.schedule(
      networkReliefSnapshotCronExpr,
      async () => {
        try {
          const data = await captureNetworkReliefSnapshot({
            straightRadiusMeters: SPLITTER_MAP_STRAIGHT_RADIUS_METERS,
            maxRouteMeters: STREET_RELIEF_MAX_ROUTE_METERS,
          });
          logger.info(
            `[network-relief-snapshot] Snapshot agendado OK (${data.entryCount} casos sem alívio, ${data.scannedCount} avaliados).`,
          );
        } catch (error) {
          logger.error('[network-relief-snapshot] Falha na captura agendada:', { error });
        }
      },
      { timezone: 'America/Sao_Paulo' },
    );
    logger.info(
      `[network-relief-snapshot] Cron ativo: "${networkReliefSnapshotCronExpr}" America/Sao_Paulo (padrão a cada 10 min). Desative com NETWORK_RELIEF_SNAPSHOT_CRON_DISABLED=true.`,
    );
  } else {
    logger.info('[network-relief-snapshot] Cron desativado (NETWORK_RELIEF_SNAPSHOT_CRON_DISABLED=true).');
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







