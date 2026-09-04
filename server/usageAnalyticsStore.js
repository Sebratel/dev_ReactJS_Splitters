import mysql from 'mysql2/promise';
import { mysqlNaiveDateTimeToIso } from './mysqlBrazilDateTime.js';

/**
 * Analytics de uso da plataforma ("radar de uso" / Google Analytics interno).
 * Registra, por acesso, QUEM (uid/email/nome) abriu O QUE (módulo/rota) e QUANDO,
 * mais duração aproximada na tela anterior e o id de sessão do navegador.
 * Grava no MySQL do Hub Apps (mesmo banco gravável das sugestões e do histórico de massiva).
 */

const EVENTS_TABLE = 'usage_events';
const APP_ID = 'app-splitters-sebratel';

/** Módulos conhecidos (derivados da rota). 'outros' cobre qualquer rota não mapeada. */
const KNOWN_MODULES = new Set([
  'dashboard',
  'splitters',
  'splitter-detail',
  'cliente-detail',
  'massiva',
  'massiva-dashboard',
  'massiva-monitor',
  'intelligence',
  'redistribuicao',
  'sugestoes',
  'usuarios',
  'isa-config',
  'outros',
]);

const VALID_EVENT_TYPES = new Set(['pageview', 'action']);

let dataPool = null;
let readyPromise = null;

function toCleanString(value) {
  return String(value ?? '').trim();
}

function normalizePositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeNonNegativeInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** MySQL do Hub Apps — mesmo banco gravável usado por sugestões e histórico de massiva. */
function getMysqlConfig() {
  const database = toCleanString(process.env.HUB_APPS_MYSQL_DATABASE);
  if (database === '') {
    return { host: '', port: 3306, user: '', password: '', database: '' };
  }
  return {
    host: toCleanString(process.env.HUB_APPS_MYSQL_HOST) || toCleanString(process.env.MASSIVA_MYSQL_HOST),
    port:
      normalizePositiveInt(process.env.HUB_APPS_MYSQL_PORT) ??
      normalizePositiveInt(process.env.MASSIVA_MYSQL_PORT) ??
      3306,
    user: toCleanString(process.env.HUB_APPS_MYSQL_USER) || toCleanString(process.env.MASSIVA_MYSQL_USER),
    password: String(
      process.env.HUB_APPS_MYSQL_PASSWORD || process.env.MASSIVA_MYSQL_PASSWORD || '',
    ),
    database,
  };
}

export function isUsageAnalyticsConfigured() {
  const { host, user, password, database } = getMysqlConfig();
  return host !== '' && user !== '' && password !== '' && database !== '';
}

function isAutoCreateEnabled() {
  return (
    toCleanString(process.env.USAGE_ANALYTICS_MYSQL_AUTO_CREATE_TABLE).toLowerCase() === 'true'
  );
}

function buildError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isMissingTableError(error) {
  const code = String(error?.code ?? '').toUpperCase();
  const errno = Number(error?.errno ?? 0);
  return code === 'ER_NO_SUCH_TABLE' || errno === 1146;
}

function getMysqlPool() {
  if (dataPool) return dataPool;
  const { host, port, user, password, database } = getMysqlConfig();
  dataPool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 6,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
  return dataPool;
}

async function ensureUsageTable() {
  if (!isUsageAnalyticsConfigured()) return;
  if (!isAutoCreateEnabled()) return;
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    const pool = getMysqlPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        app_id VARCHAR(64) NOT NULL DEFAULT 'app-splitters-sebratel',
        user_uid VARCHAR(128) NOT NULL,
        user_email VARCHAR(191) NOT NULL,
        user_name VARCHAR(191) NOT NULL,
        module VARCHAR(64) NOT NULL,
        path VARCHAR(512) NOT NULL,
        event_type VARCHAR(24) NOT NULL DEFAULT 'pageview',
        action VARCHAR(120) NULL,
        session_id VARCHAR(64) NULL,
        duration_ms INT UNSIGNED NULL,
        referrer_path VARCHAR(512) NULL,
        occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_${EVENTS_TABLE}_app_occurred (app_id, occurred_at),
        INDEX idx_${EVENTS_TABLE}_module (app_id, module),
        INDEX idx_${EVENTS_TABLE}_user (app_id, user_email),
        INDEX idx_${EVENTS_TABLE}_session (session_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });

  return readyPromise;
}

function assertConfigured() {
  if (!isUsageAnalyticsConfigured()) {
    throw buildError(
      'Analytics indisponível: configure HUB_APPS_MYSQL_DATABASE (Hub Apps é o banco gravável).',
      503,
    );
  }
}

function assertTableAvailableError(error) {
  if (!isMissingTableError(error)) throw error;
  throw buildError(
    `Estrutura de analytics incompleta no Hub Apps (DB_Hub_Apps). Crie a tabela ${EVENTS_TABLE}, ou habilite USAGE_ANALYTICS_MYSQL_AUTO_CREATE_TABLE=true temporariamente.`,
    503,
  );
}

function normalizeModule(value) {
  const normalized = toCleanString(value).toLowerCase();
  return KNOWN_MODULES.has(normalized) ? normalized : 'outros';
}

function normalizeEventType(value) {
  const normalized = toCleanString(value).toLowerCase();
  return VALID_EVENT_TYPES.has(normalized) ? normalized : 'pageview';
}

const MAX_EVENTS_PER_CALL = 50;

/**
 * Registra 1..N eventos de uso (batch). Cada evento traz módulo/rota/tipo; o autor
 * vem do token autenticado (não do corpo), garantindo atribuição confiável.
 */
export async function recordUsageEvents(input) {
  assertConfigured();
  const actor = input?.actor ?? {};
  const userUid = toCleanString(actor.uid);
  const userEmail = toCleanString(actor.email).toLowerCase();
  const userName = toCleanString(actor.name) || userEmail;
  if (!userUid || !userEmail) {
    throw buildError('Usuário não identificado para registrar o acesso.', 400);
  }

  const rawEvents = Array.isArray(input?.events) ? input.events : [];
  const events = rawEvents.slice(0, MAX_EVENTS_PER_CALL);
  if (events.length === 0) return { inserted: 0 };

  const rows = events.map((ev) => [
    APP_ID,
    userUid.slice(0, 128),
    userEmail.slice(0, 191),
    userName.slice(0, 191),
    normalizeModule(ev?.module),
    toCleanString(ev?.path).slice(0, 512) || '/',
    normalizeEventType(ev?.eventType),
    toCleanString(ev?.action).slice(0, 120) || null,
    toCleanString(ev?.sessionId).slice(0, 64) || null,
    normalizeNonNegativeInt(ev?.durationMs),
    toCleanString(ev?.referrerPath).slice(0, 512) || null,
  ]);

  const pool = getMysqlPool();
  try {
    await ensureUsageTable();
    const [result] = await pool.query(
      `
        INSERT INTO ${EVENTS_TABLE}
          (app_id, user_uid, user_email, user_name, module, path, event_type, action, session_id, duration_ms, referrer_path)
        VALUES ?
      `,
      [rows],
    );
    return { inserted: Number(result?.affectedRows ?? rows.length) };
  } catch (error) {
    assertTableAvailableError(error);
  }
}

function resolveRange(input) {
  const now = new Date();
  const end = input?.endDate instanceof Date ? input.endDate : now;
  let start = input?.startDate instanceof Date ? input.startDate : null;
  if (!start) {
    start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  const toMysql = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  return { startSql: toMysql(start), endSql: toMysql(end) };
}

/**
 * Sumário agregado para o radar de uso, no período informado:
 * totais, ranking por módulo, ranking por usuário, matriz usuário×módulo,
 * distribuição por hora do dia e série diária.
 */
export async function summarizeUsage(input = {}) {
  assertConfigured();
  const { startSql, endSql } = resolveRange(input);
  const pool = getMysqlPool();
  const userEmail = toCleanString(input?.userEmail).toLowerCase();
  let where = `WHERE app_id = ? AND occurred_at >= ? AND occurred_at <= ?`;
  const params = [APP_ID, startSql, endSql];
  if (userEmail !== '') {
    where += ' AND user_email = ?';
    params.push(userEmail);
  }

  try {
    await ensureUsageTable();

    const [totalsRows] = await pool.query(
      `SELECT COUNT(*) AS total_events, COUNT(DISTINCT user_email) AS active_users,
              COUNT(DISTINCT session_id) AS sessions
       FROM ${EVENTS_TABLE} ${where}`,
      params,
    );
    const totals = Array.isArray(totalsRows) && totalsRows[0] ? totalsRows[0] : {};

    const [moduleRows] = await pool.query(
      `SELECT module,
              COUNT(*) AS events,
              COUNT(DISTINCT user_email) AS users,
              COALESCE(AVG(NULLIF(duration_ms, 0)), 0) AS avg_duration_ms
       FROM ${EVENTS_TABLE} ${where} AND event_type = 'pageview'
       GROUP BY module
       ORDER BY events DESC`,
      params,
    );

    const [userRows] = await pool.query(
      `SELECT user_email, MAX(user_name) AS user_name,
              COUNT(*) AS events,
              COUNT(DISTINCT module) AS modules_used,
              MAX(occurred_at) AS last_seen
       FROM ${EVENTS_TABLE} ${where} AND event_type = 'pageview'
       GROUP BY user_email
       ORDER BY events DESC
       LIMIT 50`,
      params,
    );

    const [userModuleRows] = await pool.query(
      `SELECT user_email, MAX(user_name) AS user_name, module, COUNT(*) AS events
       FROM ${EVENTS_TABLE} ${where} AND event_type = 'pageview'
       GROUP BY user_email, module
       ORDER BY events DESC`,
      params,
    );

    const [hourRows] = await pool.query(
      `SELECT HOUR(occurred_at) AS hour, COUNT(*) AS events
       FROM ${EVENTS_TABLE} ${where} AND event_type = 'pageview'
       GROUP BY HOUR(occurred_at)
       ORDER BY hour ASC`,
      params,
    );

    const [dayRows] = await pool.query(
      `SELECT DATE(occurred_at) AS day, COUNT(*) AS events, COUNT(DISTINCT user_email) AS users
       FROM ${EVENTS_TABLE} ${where} AND event_type = 'pageview'
       GROUP BY DATE(occurred_at)
       ORDER BY day ASC`,
      params,
    );

    const [actionRows] = await pool.query(
      `SELECT module, action,
              COUNT(*) AS events,
              COUNT(DISTINCT user_email) AS users
       FROM ${EVENTS_TABLE} ${where} AND event_type = 'action' AND action IS NOT NULL
       GROUP BY module, action
       ORDER BY events DESC
       LIMIT 50`,
      params,
    );

    return {
      range: { start: startSql, end: endSql },
      totals: {
        events: Number(totals.total_events ?? 0),
        activeUsers: Number(totals.active_users ?? 0),
        sessions: Number(totals.sessions ?? 0),
      },
      byModule: (Array.isArray(moduleRows) ? moduleRows : []).map((r) => ({
        module: toCleanString(r.module) || 'outros',
        events: Number(r.events ?? 0),
        users: Number(r.users ?? 0),
        avgDurationMs: Math.round(Number(r.avg_duration_ms ?? 0)),
      })),
      byUser: (Array.isArray(userRows) ? userRows : []).map((r) => ({
        email: toCleanString(r.user_email).toLowerCase(),
        name: toCleanString(r.user_name),
        events: Number(r.events ?? 0),
        modulesUsed: Number(r.modules_used ?? 0),
        lastSeen: mysqlNaiveDateTimeToIso(r.last_seen),
      })),
      byUserModule: (Array.isArray(userModuleRows) ? userModuleRows : []).map((r) => ({
        email: toCleanString(r.user_email).toLowerCase(),
        name: toCleanString(r.user_name),
        module: toCleanString(r.module) || 'outros',
        events: Number(r.events ?? 0),
      })),
      byHour: (Array.isArray(hourRows) ? hourRows : []).map((r) => ({
        hour: Number(r.hour ?? 0),
        events: Number(r.events ?? 0),
      })),
      byDay: (Array.isArray(dayRows) ? dayRows : []).map((r) => ({
        day: typeof r.day === 'string' ? r.day : mysqlNaiveDateTimeToIso(r.day)?.slice(0, 10),
        events: Number(r.events ?? 0),
        users: Number(r.users ?? 0),
      })),
      byAction: (Array.isArray(actionRows) ? actionRows : []).map((r) => ({
        module: toCleanString(r.module) || 'outros',
        action: toCleanString(r.action),
        events: Number(r.events ?? 0),
        users: Number(r.users ?? 0),
      })),
    };
  } catch (error) {
    assertTableAvailableError(error);
  }
}

export function getUsageAnalyticsTable() {
  return EVENTS_TABLE;
}
