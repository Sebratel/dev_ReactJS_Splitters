import mysql from 'mysql2/promise';
import { mysqlNaiveDateTimeToIso } from './mysqlBrazilDateTime.js';

const SUGGESTIONS_TABLE = 'platform_suggestions';
const VOTES_TABLE = 'platform_suggestion_votes';
const COMMENTS_TABLE = 'platform_suggestion_comments';

const VALID_SUGGESTION_STATUSES = new Set([
  'open',
  'planned',
  'in_progress',
  'done',
  'rejected',
]);

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

function normalizeOptionalUrl(value) {
  const normalized = toCleanString(value);
  return normalized !== '' ? normalized : null;
}

function normalizeSuggestionStatus(value) {
  const normalized = toCleanString(value).toLowerCase();
  return VALID_SUGGESTION_STATUSES.has(normalized) ? normalized : '';
}

function normalizeVoteType(value) {
  const raw = toCleanString(value).toLowerCase();
  if (raw === 'like') return 'like';
  if (raw === 'dislike') return 'dislike';
  if (raw === 'none') return 'none';
  return '';
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

function isSuggestionsAutoCreateEnabled() {
  return (
    toCleanString(process.env.PLATFORM_SUGGESTIONS_MYSQL_AUTO_CREATE_TABLE).toLowerCase() ===
    'true'
  );
}

function isMissingTableError(error) {
  const code = String(error?.code ?? '').toUpperCase();
  const errno = Number(error?.errno ?? 0);
  return code === 'ER_NO_SUCH_TABLE' || errno === 1146;
}

function buildError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

async function ensureColumnExists(pool, tableName, columnName, definitionSql) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (Array.isArray(rows) && rows.length > 0) return;
  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
}

async function ensureSuggestionsTables() {
  if (!isMysqlConfigured()) return;
  if (!isSuggestionsAutoCreateEnabled()) return;
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    const pool = getMysqlPool();
    await pool.query(`
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
    await pool.query(`
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
    await pool.query(`
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

    await ensureColumnExists(pool, SUGGESTIONS_TABLE, 'author_photo_url', 'VARCHAR(1024) NULL');
    await ensureColumnExists(pool, SUGGESTIONS_TABLE, 'comments_count', 'INT NOT NULL DEFAULT 0');
    await ensureColumnExists(pool, VOTES_TABLE, 'user_photo_url', 'VARCHAR(1024) NULL');
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });

  return readyPromise;
}

function assertConfigured() {
  if (!isMysqlConfigured()) {
    throw buildError(
      'Sugestoes indisponiveis: MySQL DB_Massives nao configurado no backend.',
      503,
    );
  }
}

function assertTablesAvailableError(error) {
  if (!isMissingTableError(error)) throw error;
  throw buildError(
    `Estrutura de sugestoes incompleta no DB_Massives. Crie manualmente ${SUGGESTIONS_TABLE}, ${VOTES_TABLE} e ${COMMENTS_TABLE}, ou habilite PLATFORM_SUGGESTIONS_MYSQL_AUTO_CREATE_TABLE=true temporariamente.`,
    503,
  );
}

function mapPersonSummary(row, prefix) {
  return {
    uid: toCleanString(row?.[`${prefix}_uid`]),
    email: toCleanString(row?.[`${prefix}_email`]).toLowerCase(),
    name: toCleanString(row?.[`${prefix}_name`]),
    photoURL: normalizeOptionalUrl(row?.[`${prefix}_photo_url`]),
  };
}

function mapCommentRow(row) {
  return {
    id: Number(row.id),
    suggestionId: Number(row.suggestion_id),
    author: mapPersonSummary(row, 'author'),
    message: toCleanString(row.message),
    createdAt: mysqlNaiveDateTimeToIso(row.created_at),
    updatedAt: mysqlNaiveDateTimeToIso(row.updated_at),
  };
}

function mapSuggestionRow(row, extras = {}) {
  const comments = Array.isArray(extras.comments) ? extras.comments : [];
  const supporters = Array.isArray(extras.supporters) ? extras.supporters : [];
  const storedCommentsCount = Number(row.comments_count ?? 0);
  return {
    id: Number(row.id),
    title: toCleanString(row.title),
    description: toCleanString(row.description),
    sector: toCleanString(row.sector),
    category: toCleanString(row.category) || null,
    status: normalizeSuggestionStatus(row.status) || 'open',
    authorUid: toCleanString(row.author_uid),
    authorEmail: toCleanString(row.author_email).toLowerCase(),
    authorName: toCleanString(row.author_name),
    authorPhotoURL: normalizeOptionalUrl(row.author_photo_url),
    likesCount: Number(row.likes_count ?? 0),
    dislikesCount: Number(row.dislikes_count ?? 0),
    commentsCount: Math.max(storedCommentsCount, comments.length),
    score: Number(row.score ?? 0),
    viewerVote: toCleanString(row.viewer_vote) || null,
    supporters,
    comments,
    createdAt: mysqlNaiveDateTimeToIso(row.created_at),
    updatedAt: mysqlNaiveDateTimeToIso(row.updated_at),
  };
}

async function fetchSupportersBySuggestionIds(connectionOrPool, suggestionIds) {
  const bySuggestionId = new Map();
  if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) return bySuggestionId;

  const [rows] = await connectionOrPool.query(
    `
      SELECT
        suggestion_id,
        user_uid,
        user_email,
        user_name,
        user_photo_url,
        created_at
      FROM ${VOTES_TABLE}
      WHERE suggestion_id IN (?)
        AND vote_type = 'like'
      ORDER BY created_at ASC, id ASC
    `,
    [suggestionIds],
  );

  for (const row of Array.isArray(rows) ? rows : []) {
    const suggestionId = Number(row.suggestion_id);
    if (!bySuggestionId.has(suggestionId)) bySuggestionId.set(suggestionId, []);
    const current = bySuggestionId.get(suggestionId);
    current.push(mapPersonSummary(row, 'user'));
  }

  return bySuggestionId;
}

async function fetchCommentsBySuggestionIds(connectionOrPool, suggestionIds) {
  const bySuggestionId = new Map();
  if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) return bySuggestionId;

  const [rows] = await connectionOrPool.query(
    `
      SELECT
        id,
        suggestion_id,
        author_uid,
        author_email,
        author_name,
        author_photo_url,
        message,
        created_at,
        updated_at
      FROM ${COMMENTS_TABLE}
      WHERE suggestion_id IN (?)
      ORDER BY created_at ASC, id ASC
    `,
    [suggestionIds],
  );

  for (const row of Array.isArray(rows) ? rows : []) {
    const suggestionId = Number(row.suggestion_id);
    if (!bySuggestionId.has(suggestionId)) bySuggestionId.set(suggestionId, []);
    const current = bySuggestionId.get(suggestionId);
    current.push(mapCommentRow(row));
  }

  return bySuggestionId;
}

async function fetchSuggestionRowsByIds(connectionOrPool, suggestionIds, viewerUid = null) {
  const ids = Array.isArray(suggestionIds)
    ? suggestionIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  if (ids.length === 0) return [];

  const [rows] = await connectionOrPool.query(
    `
      SELECT
        s.id,
        s.title,
        s.description,
        s.sector,
        s.category,
        s.status,
        s.author_uid,
        s.author_email,
        s.author_name,
        s.author_photo_url,
        s.likes_count,
        s.dislikes_count,
        s.comments_count,
        s.score,
        s.created_at,
        s.updated_at,
        v.vote_type AS viewer_vote
      FROM ${SUGGESTIONS_TABLE} s
      LEFT JOIN ${VOTES_TABLE} v
        ON v.suggestion_id = s.id
       AND v.user_uid = ?
      WHERE s.id IN (?)
    `,
    [toCleanString(viewerUid), ids],
  );

  const rowList = Array.isArray(rows) ? rows : [];
  const supportersBySuggestionId = await fetchSupportersBySuggestionIds(connectionOrPool, ids);
  const commentsBySuggestionId = await fetchCommentsBySuggestionIds(connectionOrPool, ids);
  const rowById = new Map(
    rowList.map((row) => [
      Number(row.id),
      mapSuggestionRow(row, {
        supporters: supportersBySuggestionId.get(Number(row.id)) ?? [],
        comments: commentsBySuggestionId.get(Number(row.id)) ?? [],
      }),
    ]),
  );

  return ids.map((id) => rowById.get(id)).filter(Boolean);
}

async function fetchSuggestionById(connectionOrPool, suggestionId, viewerUid = null) {
  const rows = await fetchSuggestionRowsByIds(connectionOrPool, [suggestionId], viewerUid);
  return rows[0] ?? null;
}

async function ensureSuggestionExists(connection, suggestionId) {
  const [rows] = await connection.query(
    `SELECT id FROM ${SUGGESTIONS_TABLE} WHERE id = ? LIMIT 1 FOR UPDATE`,
    [suggestionId],
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw buildError('Sugestao nao encontrada.', 404);
  }
}

export async function listPlatformSuggestions(input = {}) {
  assertConfigured();
  const viewerUid = toCleanString(input.viewerUid);
  const limit = Math.min(Math.max(normalizePositiveInt(input.limit) ?? 100, 1), 300);
  const pool = getMysqlPool();

  try {
    await ensureSuggestionsTables();
    const [rows] = await pool.query(
      `
        SELECT
          s.id,
          s.title,
          s.description,
          s.sector,
          s.category,
          s.status,
          s.author_uid,
          s.author_email,
          s.author_name,
          s.author_photo_url,
          s.likes_count,
          s.dislikes_count,
          s.comments_count,
          s.score,
          s.created_at,
          s.updated_at,
          v.vote_type AS viewer_vote
        FROM ${SUGGESTIONS_TABLE} s
        LEFT JOIN ${VOTES_TABLE} v
          ON v.suggestion_id = s.id
         AND v.user_uid = ?
        ORDER BY s.score DESC, s.likes_count DESC, s.created_at DESC
        LIMIT ?
      `,
      [viewerUid, limit],
    );

    const rowList = Array.isArray(rows) ? rows : [];
    const ids = rowList.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
    const supportersBySuggestionId = await fetchSupportersBySuggestionIds(pool, ids);
    const commentsBySuggestionId = await fetchCommentsBySuggestionIds(pool, ids);

    return rowList.map((row) =>
      mapSuggestionRow(row, {
        supporters: supportersBySuggestionId.get(Number(row.id)) ?? [],
        comments: commentsBySuggestionId.get(Number(row.id)) ?? [],
      }),
    );
  } catch (error) {
    assertTablesAvailableError(error);
  }
}

export async function createPlatformSuggestion(input) {
  assertConfigured();
  const title = toCleanString(input?.title);
  const description = toCleanString(input?.description);
  const sector = toCleanString(input?.sector);
  const category = toCleanString(input?.category) || null;
  const authorUid = toCleanString(input?.authorUid);
  const authorEmail = toCleanString(input?.authorEmail).toLowerCase();
  const authorName = toCleanString(input?.authorName) || authorEmail;
  const authorPhotoURL = normalizeOptionalUrl(input?.authorPhotoURL);

  if (title.length < 5) {
    throw buildError('Titulo da sugestao deve ter pelo menos 5 caracteres.', 400);
  }
  if (description.length < 15) {
    throw buildError('Descricao da sugestao deve ter pelo menos 15 caracteres.', 400);
  }
  if (sector.length < 2) {
    throw buildError('Informe o setor ou area impactada.', 400);
  }
  if (!authorUid || !authorEmail) {
    throw buildError('Nao foi possivel identificar o autor da sugestao.', 400);
  }

  const pool = getMysqlPool();
  try {
    await ensureSuggestionsTables();
    const [result] = await pool.query(
      `
        INSERT INTO ${SUGGESTIONS_TABLE} (
          title,
          description,
          sector,
          category,
          status,
          author_uid,
          author_email,
          author_name,
          author_photo_url
        )
        VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
      `,
      [
        title.slice(0, 191),
        description.slice(0, 8000),
        sector.slice(0, 120),
        category ? category.slice(0, 120) : null,
        authorUid.slice(0, 128),
        authorEmail.slice(0, 191),
        authorName.slice(0, 191),
        authorPhotoURL ? authorPhotoURL.slice(0, 1024) : null,
      ],
    );
    return await fetchSuggestionById(pool, result.insertId, authorUid);
  } catch (error) {
    assertTablesAvailableError(error);
  }
}

async function recalcSuggestionVoteCounters(connection, suggestionId) {
  const [rows] = await connection.query(
    `
      SELECT
        COALESCE(SUM(vote_type = 'like'), 0) AS likes_count,
        COALESCE(SUM(vote_type = 'dislike'), 0) AS dislikes_count
      FROM ${VOTES_TABLE}
      WHERE suggestion_id = ?
    `,
    [suggestionId],
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  const likesCount = Number(row.likes_count ?? 0);
  const dislikesCount = Number(row.dislikes_count ?? 0);
  const score = likesCount - dislikesCount;

  await connection.query(
    `
      UPDATE ${SUGGESTIONS_TABLE}
      SET likes_count = ?, dislikes_count = ?, score = ?
      WHERE id = ?
    `,
    [likesCount, dislikesCount, score, suggestionId],
  );
}

export async function voteOnPlatformSuggestion(input) {
  assertConfigured();
  const suggestionId = normalizePositiveInt(input?.suggestionId);
  const userUid = toCleanString(input?.userUid);
  const userEmail = toCleanString(input?.userEmail).toLowerCase();
  const userName = toCleanString(input?.userName) || userEmail;
  const userPhotoURL = normalizeOptionalUrl(input?.userPhotoURL);
  const voteType = normalizeVoteType(input?.voteType);

  if (!suggestionId) throw buildError('Sugestao invalida.', 400);
  if (!userUid || !userEmail) throw buildError('Usuario nao identificado para votar.', 400);
  if (!voteType) throw buildError('Tipo de voto invalido.', 400);

  const pool = getMysqlPool();
  let connection = null;

  try {
    await ensureSuggestionsTables();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await ensureSuggestionExists(connection, suggestionId);

    const [voteRows] = await connection.query(
      `
        SELECT id, vote_type
        FROM ${VOTES_TABLE}
        WHERE suggestion_id = ? AND user_uid = ?
        LIMIT 1
        FOR UPDATE
      `,
      [suggestionId, userUid],
    );

    const existingVote = Array.isArray(voteRows) && voteRows.length > 0 ? voteRows[0] : null;
    if (voteType === 'none') {
      if (existingVote) {
        await connection.query(`DELETE FROM ${VOTES_TABLE} WHERE id = ?`, [existingVote.id]);
      }
    } else if (existingVote) {
      if (toCleanString(existingVote.vote_type) === voteType) {
        await connection.query(`DELETE FROM ${VOTES_TABLE} WHERE id = ?`, [existingVote.id]);
      } else {
        await connection.query(
          `
            UPDATE ${VOTES_TABLE}
            SET vote_type = ?, user_email = ?, user_name = ?, user_photo_url = ?
            WHERE id = ?
          `,
          [
            voteType,
            userEmail.slice(0, 191),
            userName.slice(0, 191),
            userPhotoURL ? userPhotoURL.slice(0, 1024) : null,
            existingVote.id,
          ],
        );
      }
    } else {
      await connection.query(
        `
          INSERT INTO ${VOTES_TABLE} (
            suggestion_id,
            user_uid,
            user_email,
            user_name,
            user_photo_url,
            vote_type
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          suggestionId,
          userUid.slice(0, 128),
          userEmail.slice(0, 191),
          userName.slice(0, 191),
          userPhotoURL ? userPhotoURL.slice(0, 1024) : null,
          voteType,
        ],
      );
    }

    await recalcSuggestionVoteCounters(connection, suggestionId);
    await connection.commit();
    connection.release();
    connection = null;

    return await fetchSuggestionById(pool, suggestionId, userUid);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
      connection.release();
    }
    if (error?.statusCode) throw error;
    assertTablesAvailableError(error);
  }
}

export async function addPlatformSuggestionComment(input) {
  assertConfigured();
  const suggestionId = normalizePositiveInt(input?.suggestionId);
  const authorUid = toCleanString(input?.authorUid);
  const authorEmail = toCleanString(input?.authorEmail).toLowerCase();
  const authorName = toCleanString(input?.authorName) || authorEmail;
  const authorPhotoURL = normalizeOptionalUrl(input?.authorPhotoURL);
  const message = toCleanString(input?.message);
  const viewerUid = toCleanString(input?.viewerUid || authorUid);

  if (!suggestionId) throw buildError('Sugestao invalida.', 400);
  if (!authorUid || !authorEmail) throw buildError('Usuario nao identificado para comentar.', 400);
  if (message.length < 2) throw buildError('Comentario muito curto.', 400);

  const pool = getMysqlPool();
  let connection = null;

  try {
    await ensureSuggestionsTables();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await ensureSuggestionExists(connection, suggestionId);
    await connection.query(
      `
        INSERT INTO ${COMMENTS_TABLE} (
          suggestion_id,
          author_uid,
          author_email,
          author_name,
          author_photo_url,
          message
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        suggestionId,
        authorUid.slice(0, 128),
        authorEmail.slice(0, 191),
        authorName.slice(0, 191),
        authorPhotoURL ? authorPhotoURL.slice(0, 1024) : null,
        message.slice(0, 4000),
      ],
    );
    await connection.query(
      `
        UPDATE ${SUGGESTIONS_TABLE}
        SET comments_count = comments_count + 1
        WHERE id = ?
      `,
      [suggestionId],
    );

    await connection.commit();
    connection.release();
    connection = null;

    return await fetchSuggestionById(pool, suggestionId, viewerUid);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
      connection.release();
    }
    if (error?.statusCode) throw error;
    assertTablesAvailableError(error);
  }
}

export async function updatePlatformSuggestionStatus(input) {
  assertConfigured();
  const suggestionId = normalizePositiveInt(input?.suggestionId);
  const status = normalizeSuggestionStatus(input?.status);
  const viewerUid = toCleanString(input?.viewerUid);
  if (!suggestionId) throw buildError('Sugestao invalida.', 400);
  if (!status) throw buildError('Status de sugestao invalido.', 400);

  const pool = getMysqlPool();
  try {
    await ensureSuggestionsTables();
    const [result] = await pool.query(
      `
        UPDATE ${SUGGESTIONS_TABLE}
        SET status = ?
        WHERE id = ?
      `,
      [status, suggestionId],
    );
    if (Number(result?.affectedRows ?? 0) === 0) {
      throw buildError('Sugestao nao encontrada.', 404);
    }
    return await fetchSuggestionById(pool, suggestionId, viewerUid);
  } catch (error) {
    if (error?.statusCode) throw error;
    assertTablesAvailableError(error);
  }
}

export function getPlatformSuggestionsTables() {
  return {
    suggestionsTable: SUGGESTIONS_TABLE,
    votesTable: VOTES_TABLE,
    commentsTable: COMMENTS_TABLE,
  };
}
