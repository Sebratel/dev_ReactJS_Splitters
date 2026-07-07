import mysql from 'mysql2/promise';

export const SUGGESTIONS_TABLE = 'platform_suggestions';
export const VOTES_TABLE = 'platform_suggestion_votes';
export const COMMENTS_TABLE = 'platform_suggestion_comments';
export const SUGGESTIONS_TABLES = [SUGGESTIONS_TABLE, VOTES_TABLE, COMMENTS_TABLE];

export function toCleanString(value) {
  return String(value ?? '').trim();
}

/** Resolve credenciais MySQL por prefixo de env (ex.: HUB_APPS_MYSQL, MASSIVA_MYSQL). */
export function resolveMysqlConfig(prefix, fallbackPrefix = null) {
  const read = (key) => toCleanString(process.env[`${prefix}_${key}`]);
  const fallback = fallbackPrefix
    ? (key) => toCleanString(process.env[`${fallbackPrefix}_${key}`])
    : () => '';

  const host = read('HOST') || fallback('HOST');
  const port = Number.parseInt(read('PORT') || fallback('PORT') || '3306', 10);
  const user = read('USER') || fallback('USER');
  const password = String(
    process.env[`${prefix}_PASSWORD`] ?? (fallbackPrefix ? process.env[`${fallbackPrefix}_PASSWORD`] : '') ?? '',
  );
  const database = read('DATABASE') || fallback('DATABASE');

  return { host, port, user, password, database };
}

export function assertMysqlConfig(label, config) {
  if (!config.host || !config.user || config.password === '' || !config.database) {
    throw new Error(`${label}: host, user, password e database sao obrigatorios.`);
  }
}

export function createMysqlPool(config) {
  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 4,
    charset: 'utf8mb4',
  });
}

export async function countTableRows(pool, table) {
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM ${table}`);
  return Number(rows?.[0]?.total ?? 0);
}

async function fetchAllRows(pool, table) {
  const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY id ASC`);
  return Array.isArray(rows) ? rows : [];
}

export async function ensureSuggestionsSchema(pool) {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${SUGGESTIONS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        sector VARCHAR(120) NOT NULL,
        category VARCHAR(120) NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'open',
        author_uid VARCHAR(128) NOT NULL,
        author_email VARCHAR(191) NOT NULL,
        author_name VARCHAR(191) NOT NULL,
        author_photo_url VARCHAR(1024) NULL,
        likes_count INT NOT NULL DEFAULT 0,
        dislikes_count INT NOT NULL DEFAULT 0,
        comments_count INT NOT NULL DEFAULT 0,
        score INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_${SUGGESTIONS_TABLE}_status (status),
        INDEX idx_${SUGGESTIONS_TABLE}_sector (sector),
        INDEX idx_${SUGGESTIONS_TABLE}_score_created (score, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${VOTES_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        suggestion_id BIGINT UNSIGNED NOT NULL,
        user_uid VARCHAR(128) NOT NULL,
        user_email VARCHAR(191) NOT NULL,
        user_name VARCHAR(191) NOT NULL,
        user_photo_url VARCHAR(1024) NULL,
        vote_type VARCHAR(16) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_${VOTES_TABLE}_suggestion_user (suggestion_id, user_uid),
        INDEX idx_${VOTES_TABLE}_suggestion (suggestion_id),
        CONSTRAINT fk_${VOTES_TABLE}_suggestion
          FOREIGN KEY (suggestion_id) REFERENCES ${SUGGESTIONS_TABLE}(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${COMMENTS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        suggestion_id BIGINT UNSIGNED NOT NULL,
        author_uid VARCHAR(128) NOT NULL,
        author_email VARCHAR(191) NOT NULL,
        author_name VARCHAR(191) NOT NULL,
        author_photo_url VARCHAR(1024) NULL,
        message TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_${COMMENTS_TABLE}_suggestion_created (suggestion_id, created_at),
        CONSTRAINT fk_${COMMENTS_TABLE}_suggestion
          FOREIGN KEY (suggestion_id) REFERENCES ${SUGGESTIONS_TABLE}(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
  }
}

function buildInsertSql(table, row) {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((col) => col !== 'id')
    .map((col) => `${col} = VALUES(${col})`)
    .join(', ');
  return {
    sql: `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updates}
    `,
    values: columns.map((col) => row[col]),
  };
}

async function copyTable(sourcePool, targetPool, table, { dryRun = false } = {}) {
  const rows = await fetchAllRows(sourcePool, table);
  if (rows.length === 0) {
    return { copied: 0, source: 0, target: 0 };
  }
  if (dryRun) {
    return { copied: rows.length, source: rows.length, target: 0 };
  }

  const connection = await targetPool.getConnection();
  let copied = 0;
  try {
    await connection.beginTransaction();
    for (const row of rows) {
      const { sql, values } = buildInsertSql(table, row);
      await connection.query(sql, values);
      copied += 1;
    }
    const [autoRow] = await connection.query(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${table}`,
    );
    await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = ?`, [
      Number(autoRow?.[0]?.next_id ?? 1),
    ]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { copied, source: rows.length, target: await countTableRows(targetPool, table) };
}

/**
 * Replica sugestoes do Hub Apps (fonte) para um banco consumidor (ex.: Splitters/DB_Massives).
 * Preserva IDs para manter votos e comentarios consistentes entre apps.
 */
export async function replicatePlatformSuggestions({ sourcePool, targetPool, dryRun = false } = {}) {
  if (!dryRun) {
    await ensureSuggestionsSchema(targetPool);
  }

  const results = {};
  for (const table of SUGGESTIONS_TABLES) {
    results[table] = await copyTable(sourcePool, targetPool, table, { dryRun });
  }
  return results;
}
