import mysql from 'mysql2/promise';
import {
  ISA_PROMPT_RESPONSE_FORMAT_NOTE,
  buildIsaPromptSectionsView,
  composeIsaPlanningPromptPreview,
  getDefaultIsaPromptSections,
  normalizeIsaPromptSections,
} from './isaPlanningTeamInstructions.js';

const ISA_PROMPT_SETTINGS_TABLE = 'isa_prompt_settings';
const ISA_PROMPT_CONFIG_KEY = 'isa_planning_prompt';
const ISA_PROMPT_CACHE_TTL_MS = 30_000;

let readyPromise = null;
let dataPool = null;
let cachedPromptConfig = null;
let cachedPromptConfigAt = 0;

function toCleanString(value) {
  return String(value ?? '').trim();
}

function normalizePositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isMissingTableError(error) {
  const code = String(error?.code ?? '').toUpperCase();
  const errno = Number(error?.errno ?? 0);
  return code === 'ER_NO_SUCH_TABLE' || errno === 1146;
}

function isIsaPromptAutoCreateEnabled() {
  return toCleanString(process.env.ISA_PROMPT_MYSQL_AUTO_CREATE_TABLE).toLowerCase() === 'true';
}

function getMysqlConfig() {
  const host = toCleanString(process.env.MASSIVA_MYSQL_HOST);
  const port = normalizePositiveInt(process.env.MASSIVA_MYSQL_PORT) ?? 3306;
  const user = toCleanString(process.env.MASSIVA_MYSQL_USER);
  const password = String(process.env.MASSIVA_MYSQL_PASSWORD ?? '');
  const database = toCleanString(process.env.MASSIVA_MYSQL_DATABASE);
  return { host, port, user, password, database };
}

function isMysqlConfigured() {
  const { host, user, password, database } = getMysqlConfig();
  return host !== '' && user !== '' && password !== '' && database !== '';
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
    connectionLimit: 4,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
  return dataPool;
}

function normalizePromptSectionsForStorage(sections) {
  return normalizeIsaPromptSections(sections);
}

function parseStoredSections(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = toCleanString(raw);
  if (text === '') return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildPromptConfigPayload({
  source,
  sections,
  version = null,
  updatedAt = null,
  updatedByUid = null,
  updatedByEmail = null,
}) {
  const normalizedSections = normalizePromptSectionsForStorage(sections);
  return {
    source,
    version:
      version == null || !Number.isFinite(Number(version)) ? null : Math.round(Number(version)),
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
    updatedByUid: toCleanString(updatedByUid) || null,
    updatedByEmail: toCleanString(updatedByEmail) || null,
    responseFormatNote: ISA_PROMPT_RESPONSE_FORMAT_NOTE,
    previewPrompt: composeIsaPlanningPromptPreview(normalizedSections),
    sections: buildIsaPromptSectionsView(normalizedSections),
  };
}

function readCachedPromptConfig() {
  if (
    cachedPromptConfig &&
    cachedPromptConfigAt > 0 &&
    Date.now() - cachedPromptConfigAt < ISA_PROMPT_CACHE_TTL_MS
  ) {
    return cachedPromptConfig;
  }
  return null;
}

function writePromptConfigCache(config) {
  cachedPromptConfig = config;
  cachedPromptConfigAt = Date.now();
  return config;
}

function clearPromptConfigCache() {
  cachedPromptConfig = null;
  cachedPromptConfigAt = 0;
}

export async function ensureIsaPromptSettingsTable() {
  if (!isMysqlConfigured()) return;
  if (!isIsaPromptAutoCreateEnabled()) return;
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    const pool = getMysqlPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${ISA_PROMPT_SETTINGS_TABLE} (
        config_key VARCHAR(64) NOT NULL PRIMARY KEY,
        sections_json LONGTEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        updated_by_uid VARCHAR(191) NULL,
        updated_by_email VARCHAR(191) NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });

  return readyPromise;
}

export async function readIsaPromptConfig() {
  const fallbackSections = getDefaultIsaPromptSections();
  const cached = readCachedPromptConfig();
  if (cached) return cached;

  if (!isMysqlConfigured()) {
    return writePromptConfigCache(buildPromptConfigPayload({
      source: 'fallback',
      sections: fallbackSections,
    }));
  }

  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      `
        SELECT
          config_key,
          sections_json,
          version,
          updated_by_uid,
          updated_by_email,
          updated_at
        FROM ${ISA_PROMPT_SETTINGS_TABLE}
        WHERE config_key = ?
        LIMIT 1
      `,
      [ISA_PROMPT_CONFIG_KEY],
    );

    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return writePromptConfigCache(buildPromptConfigPayload({
        source: 'fallback',
        sections: fallbackSections,
      }));
    }

    return writePromptConfigCache(buildPromptConfigPayload({
      source: 'db',
      sections: parseStoredSections(row.sections_json),
      version: row.version,
      updatedAt: row.updated_at,
      updatedByUid: row.updated_by_uid,
      updatedByEmail: row.updated_by_email,
    }));
  } catch (error) {
    if (isMissingTableError(error)) {
      return writePromptConfigCache(buildPromptConfigPayload({
        source: 'fallback',
        sections: fallbackSections,
      }));
    }
    return writePromptConfigCache(buildPromptConfigPayload({
      source: 'fallback',
      sections: fallbackSections,
    }));
  }
}

export async function saveIsaPromptConfig(input) {
  if (!isMysqlConfigured()) {
    const error = new Error(
      'Nao foi possivel salvar a configuracao da ISA porque o MySQL DB_Massives nao esta configurado.',
    );
    error.statusCode = 503;
    throw error;
  }

  const sections = normalizePromptSectionsForStorage(input?.sections);
  const updatedByUid = toCleanString(input?.updatedByUid);
  const updatedByEmail = toCleanString(input?.updatedByEmail);
  const serializedSections = JSON.stringify(sections);
  const pool = getMysqlPool();
  clearPromptConfigCache();

  try {
    await pool.query(
      `
        INSERT INTO ${ISA_PROMPT_SETTINGS_TABLE} (
          config_key,
          sections_json,
          version,
          updated_by_uid,
          updated_by_email
        )
        VALUES (?, ?, 1, ?, ?)
        ON DUPLICATE KEY UPDATE
          sections_json = VALUES(sections_json),
          version = version + 1,
          updated_by_uid = VALUES(updated_by_uid),
          updated_by_email = VALUES(updated_by_email),
          updated_at = CURRENT_TIMESTAMP
      `,
      [ISA_PROMPT_CONFIG_KEY, serializedSections, updatedByUid || null, updatedByEmail || null],
    );
  } catch (error) {
    if (isMissingTableError(error) && isIsaPromptAutoCreateEnabled()) {
      await ensureIsaPromptSettingsTable();
      await pool.query(
        `
          INSERT INTO ${ISA_PROMPT_SETTINGS_TABLE} (
            config_key,
            sections_json,
            version,
            updated_by_uid,
            updated_by_email
          )
          VALUES (?, ?, 1, ?, ?)
          ON DUPLICATE KEY UPDATE
            sections_json = VALUES(sections_json),
            version = version + 1,
            updated_by_uid = VALUES(updated_by_uid),
            updated_by_email = VALUES(updated_by_email),
            updated_at = CURRENT_TIMESTAMP
        `,
        [ISA_PROMPT_CONFIG_KEY, serializedSections, updatedByUid || null, updatedByEmail || null],
      );
    } else if (isMissingTableError(error)) {
      const missingTableError = new Error(
        'Tabela isa_prompt_settings inexistente no DB_Massives. Crie-a manualmente ou habilite ISA_PROMPT_MYSQL_AUTO_CREATE_TABLE=true temporariamente.',
      );
      missingTableError.statusCode = 503;
      throw missingTableError;
    } else {
      throw error;
    }
  }

  return readIsaPromptConfig();
}

export async function resetIsaPromptConfig() {
  if (!isMysqlConfigured()) {
    const error = new Error(
      'Nao foi possivel restaurar a configuracao da ISA porque o MySQL DB_Massives nao esta configurado.',
    );
    error.statusCode = 503;
    throw error;
  }

  const pool = getMysqlPool();
  clearPromptConfigCache();
  try {
    await pool.query(`DELETE FROM ${ISA_PROMPT_SETTINGS_TABLE} WHERE config_key = ?`, [
      ISA_PROMPT_CONFIG_KEY,
    ]);
  } catch (error) {
    if (isMissingTableError(error) && isIsaPromptAutoCreateEnabled()) {
      await ensureIsaPromptSettingsTable();
    } else if (isMissingTableError(error)) {
      const missingTableError = new Error(
        'Tabela isa_prompt_settings inexistente no DB_Massives. Crie-a manualmente ou habilite ISA_PROMPT_MYSQL_AUTO_CREATE_TABLE=true temporariamente.',
      );
      missingTableError.statusCode = 503;
      throw missingTableError;
    } else {
      throw error;
    }
  }

  return readIsaPromptConfig();
}
