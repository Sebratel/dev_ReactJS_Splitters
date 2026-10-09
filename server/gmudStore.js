import mysql from 'mysql2/promise';
import { instrumentMysqlPool } from './lib/mysqlPoolObservability.js';

/**
 * GMUD — Gestão de Mudança de Rede.
 * Guarda no MySQL do app (DB_Massives) os campos da requisição que NÃO existem no Voalle
 * (ambiente afetado, rollback, recursos administrativos, janela, etc.) + o fluxo de aprovação
 * do Comitê. O protocolo/datas/status do atendimento continuam vindo do Voalle (read-only);
 * o painel junta os dois pelo número do protocolo (`voalle_protocol`). Espelha a estratégia
 * do histórico local de massiva.
 */

const TABLE = 'gmud_requests';
const LINKS_TABLE = 'gmud_massiva_links';
/** Histórico (trilha) da GMUD: quem fez o quê e quando. Alimenta a linha do tempo e os indicadores. */
const EVENTS_TABLE = 'gmud_events';
export const GMUD_EVENT_TYPES = new Set([
  'criada',
  'comite_aprovada',
  'comite_negada',
  'comite_pendente',
  'execucao_em_execucao',
  'execucao_concluida',
  'execucao_pendente',
  'encerrada_elleven',
  'reagendada',
  'massiva_vinculada',
  'massiva_desvinculada',
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
function buildError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getMysqlConfig() {
  const database = toCleanString(process.env.MASSIVA_MYSQL_DATABASE);
  if (database === '') return { host: '', port: 3306, user: '', password: '', database: '' };
  return {
    host: toCleanString(process.env.MASSIVA_MYSQL_HOST),
    port: normalizePositiveInt(process.env.MASSIVA_MYSQL_PORT) ?? 3306,
    user: toCleanString(process.env.MASSIVA_MYSQL_USER),
    password: String(process.env.MASSIVA_MYSQL_PASSWORD || ''),
    database,
  };
}

export function isGmudStoreConfigured() {
  const { host, user, password, database } = getMysqlConfig();
  return host !== '' && user !== '' && password !== '' && database !== '';
}

function assertConfigured() {
  if (!isGmudStoreConfigured()) {
    throw buildError('GMUD indisponível: configure MASSIVA_MYSQL_* (banco do app Splitters).', 503);
  }
}

function getMysqlPool() {
  if (dataPool) return dataPool;
  const { host, port, user, password, database } = getMysqlConfig();
  dataPool = mysql.createPool({
    host, port, user, password, database,
    waitForConnections: true,
    connectionLimit: 6,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
  instrumentMysqlPool(dataPool, 'mysql_gmud');
  return dataPool;
}

async function ensureTable() {
  assertConfigured();
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const pool = getMysqlPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        voalle_protocol BIGINT UNSIGNED NULL,
        assignment_id BIGINT UNSIGNED NULL,
        tipo VARCHAR(32) NULL,
        assunto VARCHAR(80) NULL,
        titulo VARCHAR(512) NULL,
        descricao TEXT NULL,
        pop_site VARCHAR(191) NULL,
        solicitante_nome VARCHAR(191) NULL,
        solicitante_email VARCHAR(191) NULL,
        area_solicitante VARCHAR(64) NULL,
        risco_nao_implementacao TEXT NULL,
        ambiente_afetado JSON NULL,
        comunica_cliente VARCHAR(8) NULL,
        impacto_parada VARCHAR(8) NULL,
        plano_execucao TEXT NULL,
        risco_execucao TEXT NULL,
        recursos_administrativos JSON NULL,
        plano_rollback TEXT NULL,
        data_inicio DATE NULL,
        hora_inicio TIME NULL,
        data_fim DATE NULL,
        hora_fim TIME NULL,
        lista_clientes_cor VARCHAR(8) NULL,
        status_comite VARCHAR(16) NOT NULL DEFAULT 'pendente',
        aprovado_por VARCHAR(191) NULL,
        data_cab DATE NULL,
        rnc VARCHAR(255) NULL,
        status_exec VARCHAR(16) NOT NULL DEFAULT 'pendente',
        elleven_encerrado_em DATETIME NULL,
        elleven_encerrado_status VARCHAR(16) NULL,
        created_by_email VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_${TABLE}_protocol (voalle_protocol),
        INDEX idx_${TABLE}_status_comite (status_comite),
        INDEX idx_${TABLE}_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${LINKS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        gmud_protocol BIGINT UNSIGNED NOT NULL,
        massiva_protocol BIGINT UNSIGNED NOT NULL,
        created_by_email VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_${LINKS_TABLE} (gmud_protocol, massiva_protocol),
        INDEX idx_${LINKS_TABLE}_gmud (gmud_protocol),
        INDEX idx_${LINKS_TABLE}_massiva (massiva_protocol)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        voalle_protocol BIGINT UNSIGNED NOT NULL,
        event_type VARCHAR(32) NOT NULL,
        actor VARCHAR(191) NULL,
        payload JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_${EVENTS_TABLE}_protocol (voalle_protocol, created_at),
        INDEX idx_${EVENTS_TABLE}_type (event_type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migração idempotente: adiciona colunas novas em tabelas já existentes (o CREATE acima só
    // vale para instalações novas). MySQL não tem "ADD COLUMN IF NOT EXISTS", então checamos antes.
    await ensureColumn(pool, TABLE, 'assignment_id', 'BIGINT UNSIGNED NULL AFTER voalle_protocol');
    await ensureColumn(pool, TABLE, 'assunto', 'VARCHAR(80) NULL AFTER tipo');
    await ensureColumn(pool, TABLE, 'elleven_encerrado_em', 'DATETIME NULL');
    await ensureColumn(pool, TABLE, 'elleven_encerrado_status', 'VARCHAR(16) NULL');
    // Quando o Comitê decidiu (aprovada/negada) — base do "tempo até a decisão".
    await ensureColumn(pool, TABLE, 'decidido_em', 'DATETIME NULL AFTER aprovado_por');
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });
  return readyPromise;
}

/** Adiciona uma coluna à tabela se ela ainda não existir (migração idempotente). */
async function ensureColumn(pool, table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  if (Number(rows?.[0]?.c ?? 0) > 0) return;
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function jsonOrNull(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
function parseJsonColumn(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value; // mysql2 já devolve JSON parseado
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

/** Cria (ou atualiza, se o protocolo já existir) uma requisição de GMUD. */
export async function createGmudRequest(input) {
  await ensureTable();
  const pool = getMysqlPool();

  const protocol = normalizePositiveInt(input.voalleProtocol);
  const row = {
    voalle_protocol: protocol,
    assignment_id: normalizePositiveInt(input.assignmentId),
    tipo: toCleanString(input.tipo) || null,
    assunto: toCleanString(input.assunto) || null,
    titulo: toCleanString(input.titulo) || null,
    descricao: toCleanString(input.descricao) || null,
    pop_site: toCleanString(input.popSite) || null,
    solicitante_nome: toCleanString(input.solicitanteNome) || null,
    solicitante_email: toCleanString(input.solicitanteEmail) || null,
    area_solicitante: toCleanString(input.areaSolicitante) || null,
    risco_nao_implementacao: toCleanString(input.riscoNaoImplementacao) || null,
    ambiente_afetado: jsonOrNull(Array.isArray(input.ambienteAfetado) ? input.ambienteAfetado : null),
    comunica_cliente: toCleanString(input.comunicaCliente) || null,
    impacto_parada: toCleanString(input.impactoParada) || null,
    plano_execucao: toCleanString(input.planoExecucao) || null,
    risco_execucao: toCleanString(input.riscoExecucao) || null,
    recursos_administrativos: jsonOrNull(
      input.recursosAdministrativos && typeof input.recursosAdministrativos === 'object'
        ? input.recursosAdministrativos
        : null,
    ),
    plano_rollback: toCleanString(input.planoRollback) || null,
    data_inicio: toCleanString(input.dataInicio) || null,
    hora_inicio: toCleanString(input.horaInicio) || null,
    data_fim: toCleanString(input.dataFim) || null,
    hora_fim: toCleanString(input.horaFim) || null,
    lista_clientes_cor: toCleanString(input.listaClientesCor) || null,
    created_by_email: toCleanString(input.createdByEmail) || null,
  };

  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  // UPSERT pelo protocolo (reenvio do mesmo protocolo atualiza os campos, não duplica).
  const updates = cols
    .filter((c) => c !== 'voalle_protocol')
    // assignment_id: não sobrescreve um valor já existente com null (re-create sem o id).
    .map((c) => (c === 'assignment_id' ? `${c} = COALESCE(VALUES(${c}), ${c})` : `${c} = VALUES(${c})`))
    .join(', ');
  const sql = `INSERT INTO ${TABLE} (${cols.join(', ')}) VALUES (${placeholders})
               ${protocol ? `ON DUPLICATE KEY UPDATE ${updates}` : ''}`;
  const [result] = await pool.query(sql, cols.map((c) => row[c]));
  const insertedId = result.insertId || null;
  return { id: insertedId, voalleProtocol: protocol };
}

const STATUS_COMITE = new Set(['pendente', 'aprovada', 'negada']);
const STATUS_EXEC = new Set(['pendente', 'em_execucao', 'concluida']);
// Motivo do encerramento no Elleven: 'concluida' (GMUD concluída) ou 'negada' (reprovada pelo Comitê).
const STATUS_EXEC_OR_NEGADA = new Set(['concluida', 'negada']);

/**
 * Aplica a decisão do Comitê (e status de execução) a uma GMUD, por protocolo.
 * UPSERT: se a GMUD ainda não tem linha local (ex.: existia só no Voalle), cria uma
 * com os campos de aprovação. Só altera os campos informados.
 */
export async function setGmudApproval(input) {
  await ensureTable();
  const pool = getMysqlPool();

  const protocol = normalizePositiveInt(input.voalleProtocol);
  if (!protocol) throw buildError('Protocolo inválido para aprovação de GMUD.', 400);

  const statusComite = STATUS_COMITE.has(input.statusComite) ? input.statusComite : null;
  const statusExec = STATUS_EXEC.has(input.statusExec) ? input.statusExec : null;
  const aprovadoPor = toCleanString(input.aprovadoPor) || null;
  const dataCab = toCleanString(input.dataCab) || null;
  const rnc = toCleanString(input.rnc) || null;
  // Encerramento no Elleven já efetivado pelo frontend: marca data + status ('concluida'/'negada')
  // para o painel exibir e para evitar re-encerrar. Enviado como { status } em input.ellevenEncerrado.
  const ellevenStatus =
    input.ellevenEncerrado && STATUS_EXEC_OR_NEGADA.has(input.ellevenEncerrado.status)
      ? input.ellevenEncerrado.status
      : null;

  // Estado anterior: para registrar só o que mudou (trilha) e carimbar a data da decisão.
  const [prevRows] = await pool.query(
    `SELECT status_comite, status_exec, elleven_encerrado_em FROM ${TABLE} WHERE voalle_protocol = ? LIMIT 1`,
    [protocol],
  );
  const prev = prevRows?.[0] ?? null;
  const prevComite = prev?.status_comite ?? null;
  const prevExec = prev?.status_exec ?? null;
  const changes = [];
  if (statusComite !== null && statusComite !== prevComite) changes.push(`comite_${statusComite}`);
  if (statusExec !== null && statusExec !== prevExec) changes.push(`execucao_${statusExec}`);
  if (ellevenStatus !== null && !prev?.elleven_encerrado_em) changes.push('encerrada_elleven');
  const decidiu =
    statusComite !== null && statusComite !== prevComite && (statusComite === 'aprovada' || statusComite === 'negada');

  // Monta dinamicamente só os campos enviados (demais ficam intactos no UPDATE).
  const sets = [];
  const insertCols = ['voalle_protocol'];
  const insertVals = [protocol];
  const rawSets = []; // expressões de UPDATE (podem usar NOW())
  const pushField = (col, value) => {
    if (value === null) return;
    sets.push(`${col} = ?`);
    rawSets.push({ raw: false, value });
    insertCols.push(col);
    insertVals.push(value);
  };
  pushField('status_comite', statusComite);
  pushField('status_exec', statusExec);
  pushField('aprovado_por', aprovadoPor);
  pushField('data_cab', dataCab);
  pushField('rnc', rnc);
  if (ellevenStatus !== null) {
    // Timestamp via NOW() (não placeholder) + o status do encerramento.
    sets.push('elleven_encerrado_em = NOW()');
    rawSets.push({ raw: true });
    insertCols.push('elleven_encerrado_em');
    insertVals.push(new Date());
    pushField('elleven_encerrado_status', ellevenStatus);
  }
  if (decidiu) {
    sets.push('decidido_em = NOW()');
    rawSets.push({ raw: true });
    insertCols.push('decidido_em');
    insertVals.push(new Date());
  }

  if (sets.length === 0) return { voalleProtocol: protocol, changed: false, changes: [] };

  const placeholders = insertCols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${TABLE} (${insertCols.join(', ')}) VALUES (${placeholders})
               ON DUPLICATE KEY UPDATE ${sets.join(', ')}`;
  // Params: primeiro o INSERT (insertVals), depois o UPDATE (só os sets com placeholder, na ordem).
  const updateVals = rawSets.filter((s) => !s.raw).map((s) => s.value);
  await pool.query(sql, [...insertVals, ...updateVals]);
  return { voalleProtocol: protocol, changed: true, changes };
}

/**
 * Registra um evento na trilha da GMUD. Best-effort: falha aqui nunca derruba a ação principal
 * (a trilha é auditoria/indicador, não regra de negócio).
 */
export async function logGmudEvent(input) {
  try {
    await ensureTable();
    const protocol = normalizePositiveInt(input?.voalleProtocol);
    const type = toCleanString(input?.type);
    if (!protocol || !GMUD_EVENT_TYPES.has(type)) return;
    const pool = getMysqlPool();
    await pool.query(
      `INSERT INTO ${EVENTS_TABLE} (voalle_protocol, event_type, actor, payload) VALUES (?, ?, ?, ?)`,
      [protocol, type, toCleanString(input.actor) || null, jsonOrNull(input.payload ?? null)],
    );
  } catch (error) {
    console.warn('[gmud] falha ao registrar evento:', error?.message ?? error);
  }
}

/** Trilha completa de uma GMUD (mais antigo → mais recente). */
export async function getGmudEvents(protocol) {
  await ensureTable();
  const id = normalizePositiveInt(protocol);
  if (!id) return [];
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT event_type, actor, payload, created_at FROM ${EVENTS_TABLE}
      WHERE voalle_protocol = ? ORDER BY created_at, id LIMIT 500`,
    [id],
  );
  return rows.map((r) => ({
    type: r.event_type,
    actor: r.actor ?? null,
    payload: parseJsonColumn(r.payload),
    at: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));
}

/** Protocolos registrados na plataforma, opcionalmente filtrados por status do Comitê. */
export async function listRegisteredGmudProtocols(statusesComite = null) {
  await ensureTable();
  const pool = getMysqlPool();
  const statuses = Array.isArray(statusesComite) ? statusesComite.filter((s) => STATUS_COMITE.has(s)) : null;
  const [rows] = statuses && statuses.length > 0
    ? await pool.query(
        `SELECT voalle_protocol FROM ${TABLE} WHERE voalle_protocol IS NOT NULL AND status_comite IN (${statuses.map(() => '?').join(', ')})`,
        statuses,
      )
    : await pool.query(`SELECT voalle_protocol FROM ${TABLE} WHERE voalle_protocol IS NOT NULL`);
  return rows.map((r) => Number(r.voalle_protocol)).filter((n) => Number.isFinite(n) && n > 0);
}

/** GMUDs registradas na plataforma com created_at no período [from, to] (YYYY-MM-DD). */
export async function listGmudRequestsCreatedBetween(from, to) {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLE} WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) LIMIT 5000`,
    [from, to],
  );
  return rows.map(mapGmudRow);
}

/** Eventos da trilha no período (para contagens como reagendamentos). */
export async function listGmudEventsBetween(from, to) {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT voalle_protocol, event_type FROM ${EVENTS_TABLE}
      WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) LIMIT 20000`,
    [from, to],
  );
  return rows.map((r) => ({ voalleProtocol: Number(r.voalle_protocol), type: r.event_type }));
}

/**
 * Vínculos GMUD↔massiva com os clientes afetados de cada massiva (histórico local da massiva,
 * mesmo banco). Se a tabela de massivas não existir, devolve afetados = null.
 */
export async function getLinksWithAffected(gmudProtocols) {
  await ensureTable();
  const ids = [...new Set((gmudProtocols ?? []).map(normalizePositiveInt).filter(Boolean))];
  if (ids.length === 0) return [];
  const pool = getMysqlPool();
  const placeholders = ids.map(() => '?').join(', ');
  try {
    const [rows] = await pool.query(
      `SELECT l.gmud_protocol, l.massiva_protocol, l.created_at,
              (SELECT MAX(mh.affected_clients) FROM massiva_history mh WHERE mh.protocol = l.massiva_protocol) AS affected,
              (SELECT mh.title FROM massiva_history mh WHERE mh.protocol = l.massiva_protocol ORDER BY mh.id DESC LIMIT 1) AS title,
              (SELECT mh.status FROM massiva_history mh WHERE mh.protocol = l.massiva_protocol ORDER BY mh.id DESC LIMIT 1) AS status
         FROM ${LINKS_TABLE} l
        WHERE l.gmud_protocol IN (${placeholders})`,
      ids,
    );
    return rows.map((r) => ({
      gmudProtocol: Number(r.gmud_protocol),
      massivaProtocol: Number(r.massiva_protocol),
      affectedClients: r.affected != null ? Number(r.affected) : null,
      title: r.title ?? null,
      status: r.status ?? null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  } catch (error) {
    console.warn('[gmud] vínculos sem afetados (massiva_history indisponível):', error?.message ?? error);
    const [rows] = await pool.query(
      `SELECT gmud_protocol, massiva_protocol, created_at FROM ${LINKS_TABLE} WHERE gmud_protocol IN (${placeholders})`,
      ids,
    );
    return rows.map((r) => ({
      gmudProtocol: Number(r.gmud_protocol),
      massivaProtocol: Number(r.massiva_protocol),
      affectedClients: null,
      title: null,
      status: null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  }
}

/** Uma GMUD registrada na plataforma (escopo completo), ou null. */
export async function getGmudRequest(protocol) {
  await ensureTable();
  const id = normalizePositiveInt(protocol);
  if (!id) return null;
  const pool = getMysqlPool();
  const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE voalle_protocol = ? LIMIT 1`, [id]);
  return rows?.[0] ? mapGmudRow(rows[0]) : null;
}

function toDateStr(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}
function toTimeStr(value) {
  if (value == null) return null;
  return String(value).slice(0, 5); // HH:mm
}

/** Mapeia uma linha do gmud_requests para o formato do app (camelCase, JSON parseado). */
function mapGmudRow(r) {
  return {
    voalleProtocol: r.voalle_protocol != null ? Number(r.voalle_protocol) : null,
    assignmentId: r.assignment_id != null ? Number(r.assignment_id) : null,
    tipo: r.tipo ?? null,
    assunto: r.assunto ?? null,
    titulo: r.titulo ?? null,
    descricao: r.descricao ?? null,
    popSite: r.pop_site ?? null,
    solicitanteNome: r.solicitante_nome ?? null,
    solicitanteEmail: r.solicitante_email ?? null,
    areaSolicitante: r.area_solicitante ?? null,
    riscoNaoImplementacao: r.risco_nao_implementacao ?? null,
    ambienteAfetado: parseJsonColumn(r.ambiente_afetado),
    comunicaCliente: r.comunica_cliente ?? null,
    impactoParada: r.impacto_parada ?? null,
    planoExecucao: r.plano_execucao ?? null,
    riscoExecucao: r.risco_execucao ?? null,
    recursosAdministrativos: parseJsonColumn(r.recursos_administrativos),
    planoRollback: r.plano_rollback ?? null,
    dataInicio: toDateStr(r.data_inicio),
    horaInicio: toTimeStr(r.hora_inicio),
    dataFim: toDateStr(r.data_fim),
    horaFim: toTimeStr(r.hora_fim),
    listaClientesCor: r.lista_clientes_cor ?? null,
    statusComite: r.status_comite ?? null,
    aprovadoPor: r.aprovado_por ?? null,
    decididoEm: r.decidido_em ? new Date(r.decidido_em).toISOString() : null,
    dataCab: toDateStr(r.data_cab),
    rnc: r.rnc ?? null,
    statusExec: r.status_exec ?? null,
    ellevenEncerradoEm: r.elleven_encerrado_em ? new Date(r.elleven_encerrado_em).toISOString() : null,
    ellevenEncerradoStatus: r.elleven_encerrado_status ?? null,
    createdByEmail: r.created_by_email ?? null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  };
}

/** Lista as GMUDs aguardando decisão do Comitê (status_comite = 'pendente'), escopo completo. */
export async function listPendingGmuds() {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLE} WHERE status_comite = 'pendente' ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(mapGmudRow);
}

/** Quantidade de GMUDs pendentes de aprovação (para o badge do menu). */
export async function getPendingGmudCount() {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLE} WHERE status_comite = 'pendente'`,
  );
  return Number(rows?.[0]?.total ?? 0);
}

/**
 * Status do Comitê de uma GMUD (por protocolo), para o guard de "disponibilização".
 * Retorna null se a GMUD não tem linha local (nunca registrada/aprovada).
 */
export async function getGmudApprovalStatus(protocol) {
  await ensureTable();
  const pool = getMysqlPool();
  const id = normalizePositiveInt(protocol);
  if (!id) return null;
  const [rows] = await pool.query(
    `SELECT status_comite FROM ${TABLE} WHERE voalle_protocol = ? LIMIT 1`,
    [id],
  );
  return rows?.[0]?.status_comite ?? null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * Agenda: GMUDs **aprovadas** pelo Comitê cuja janela (data_inicio..data_fim) cruza o intervalo
 * [from, to] (datas YYYY-MM-DD). Pendente/negada não entra na agenda (regra de disponibilização).
 */
export async function listScheduledGmuds(input) {
  await ensureTable();
  const pool = getMysqlPool();
  const from = toCleanString(input?.from);
  const to = toCleanString(input?.to);
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw buildError('Intervalo de datas inválido.', 400);
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLE}
      WHERE status_comite = 'aprovada'
        AND data_inicio IS NOT NULL
        AND data_inicio <= ?
        AND COALESCE(data_fim, data_inicio) >= ?
      ORDER BY data_inicio, hora_inicio
      LIMIT 500`,
    [to, from],
  );
  return rows.map(mapGmudRow);
}

/**
 * Reagenda a janela de uma GMUD (só no nosso banco). Exige GMUD aprovada e não encerrada no
 * Elleven. Retorna a janela anterior e a nova — o frontend registra o relato no protocolo.
 */
export async function rescheduleGmud(input) {
  await ensureTable();
  const pool = getMysqlPool();
  const protocol = normalizePositiveInt(input?.voalleProtocol);
  if (!protocol) throw buildError('Protocolo inválido para reagendamento.', 400);

  const next = {
    dataInicio: toCleanString(input.dataInicio),
    horaInicio: toCleanString(input.horaInicio),
    dataFim: toCleanString(input.dataFim),
    horaFim: toCleanString(input.horaFim),
  };
  if (!DATE_RE.test(next.dataInicio) || !DATE_RE.test(next.dataFim)) {
    throw buildError('Datas da nova janela inválidas.', 400);
  }
  if (!TIME_RE.test(next.horaInicio) || !TIME_RE.test(next.horaFim)) {
    throw buildError('Horários da nova janela inválidos.', 400);
  }
  if (`${next.dataFim} ${next.horaFim}` <= `${next.dataInicio} ${next.horaInicio}`) {
    throw buildError('O fim da janela deve ser depois do início.', 400);
  }

  const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE voalle_protocol = ? LIMIT 1`, [protocol]);
  const current = rows?.[0];
  if (!current) throw buildError('GMUD não registrada na plataforma.', 404);
  if (current.status_comite !== 'aprovada') {
    throw buildError('Só GMUD aprovada pelo Comitê pode ser reagendada.', 409);
  }
  if (current.elleven_encerrado_em) throw buildError('GMUD já encerrada no Elleven.', 409);

  const previous = mapGmudRow(current);
  await pool.query(
    `UPDATE ${TABLE} SET data_inicio = ?, hora_inicio = ?, data_fim = ?, hora_fim = ?
      WHERE voalle_protocol = ?`,
    [next.dataInicio, next.horaInicio, next.dataFim, next.horaFim, protocol],
  );
  return {
    voalleProtocol: protocol,
    assignmentId: previous.assignmentId,
    previous: {
      dataInicio: previous.dataInicio,
      horaInicio: previous.horaInicio,
      dataFim: previous.dataFim,
      horaFim: previous.horaFim,
    },
    next,
  };
}

/** Vincula uma massiva (por protocolo) a uma GMUD. Idempotente (dedupe por par). */
export async function addMassivaLink(input) {
  await ensureTable();
  const pool = getMysqlPool();
  const gmud = normalizePositiveInt(input.gmudProtocol);
  const massiva = normalizePositiveInt(input.massivaProtocol);
  if (!gmud || !massiva) throw buildError('Protocolos inválidos para o vínculo.', 400);
  await pool.query(
    `INSERT IGNORE INTO ${LINKS_TABLE} (gmud_protocol, massiva_protocol, created_by_email) VALUES (?, ?, ?)`,
    [gmud, massiva, toCleanString(input.createdByEmail) || null],
  );
  return { gmudProtocol: gmud, massivaProtocol: massiva };
}

/** Remove um vínculo GMUD↔massiva. */
export async function removeMassivaLink(input) {
  await ensureTable();
  const pool = getMysqlPool();
  const gmud = normalizePositiveInt(input.gmudProtocol);
  const massiva = normalizePositiveInt(input.massivaProtocol);
  if (!gmud || !massiva) throw buildError('Protocolos inválidos para o vínculo.', 400);
  await pool.query(
    `DELETE FROM ${LINKS_TABLE} WHERE gmud_protocol = ? AND massiva_protocol = ?`,
    [gmud, massiva],
  );
  return { gmudProtocol: gmud, massivaProtocol: massiva };
}

/** Lista os protocolos de massiva vinculados a uma GMUD. */
export async function getMassivaLinks(gmudProtocol) {
  await ensureTable();
  const pool = getMysqlPool();
  const gmud = normalizePositiveInt(gmudProtocol);
  if (!gmud) return [];
  const [rows] = await pool.query(
    `SELECT massiva_protocol, created_at FROM ${LINKS_TABLE} WHERE gmud_protocol = ? ORDER BY created_at DESC`,
    [gmud],
  );
  return rows.map((r) => ({
    massivaProtocol: Number(r.massiva_protocol),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));
}

/** Contagem de massivas vinculadas por GMUD — para o painel. */
export async function getMassivaLinkCounts(gmudProtocols) {
  if (!Array.isArray(gmudProtocols) || gmudProtocols.length === 0) return new Map();
  await ensureTable();
  const pool = getMysqlPool();
  const ids = gmudProtocols.map((p) => normalizePositiveInt(p)).filter((p) => p != null);
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT gmud_protocol, COUNT(*) AS total FROM ${LINKS_TABLE} WHERE gmud_protocol IN (${placeholders}) GROUP BY gmud_protocol`,
    ids,
  );
  const map = new Map();
  for (const r of rows) map.set(Number(r.gmud_protocol), Number(r.total));
  return map;
}

/** Busca os campos extras (nosso banco) para um conjunto de protocolos — para enriquecer o painel. */
export async function getGmudExtrasByProtocols(protocols) {
  if (!Array.isArray(protocols) || protocols.length === 0) return new Map();
  await ensureTable();
  const pool = getMysqlPool();
  const ids = protocols.map((p) => normalizePositiveInt(p)).filter((p) => p != null);
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT voalle_protocol, assignment_id, tipo, assunto, pop_site, impacto_parada, comunica_cliente,
            status_comite, status_exec, rnc, data_cab, ambiente_afetado,
            elleven_encerrado_em, elleven_encerrado_status
       FROM ${TABLE} WHERE voalle_protocol IN (${placeholders})`,
    ids,
  );
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.voalle_protocol), {
      assignmentId: r.assignment_id != null ? Number(r.assignment_id) : null,
      tipo: r.tipo ?? null,
      assunto: r.assunto ?? null,
      popSite: r.pop_site ?? null,
      impactoParada: r.impacto_parada ?? null,
      comunicaCliente: r.comunica_cliente ?? null,
      statusComite: r.status_comite ?? null,
      statusExec: r.status_exec ?? null,
      rnc: r.rnc ?? null,
      dataCab: r.data_cab ? new Date(r.data_cab).toISOString().slice(0, 10) : null,
      ambienteAfetado: parseJsonColumn(r.ambiente_afetado),
      ellevenEncerradoEm: r.elleven_encerrado_em ? new Date(r.elleven_encerrado_em).toISOString() : null,
      ellevenEncerradoStatus: r.elleven_encerrado_status ?? null,
    });
  }
  return map;
}
