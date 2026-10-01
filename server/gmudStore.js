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
        tipo VARCHAR(32) NULL,
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
        created_by_email VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_${TABLE}_protocol (voalle_protocol),
        INDEX idx_${TABLE}_status_comite (status_comite),
        INDEX idx_${TABLE}_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  })().catch((error) => {
    readyPromise = null;
    throw error;
  });
  return readyPromise;
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
    tipo: toCleanString(input.tipo) || null,
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
    .map((c) => `${c} = VALUES(${c})`)
    .join(', ');
  const sql = `INSERT INTO ${TABLE} (${cols.join(', ')}) VALUES (${placeholders})
               ${protocol ? `ON DUPLICATE KEY UPDATE ${updates}` : ''}`;
  const [result] = await pool.query(sql, cols.map((c) => row[c]));
  const insertedId = result.insertId || null;
  return { id: insertedId, voalleProtocol: protocol };
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
    `SELECT voalle_protocol, tipo, pop_site, impacto_parada, comunica_cliente,
            status_comite, status_exec, rnc, data_cab, ambiente_afetado
       FROM ${TABLE} WHERE voalle_protocol IN (${placeholders})`,
    ids,
  );
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.voalle_protocol), {
      tipo: r.tipo ?? null,
      popSite: r.pop_site ?? null,
      impactoParada: r.impacto_parada ?? null,
      comunicaCliente: r.comunica_cliente ?? null,
      statusComite: r.status_comite ?? null,
      statusExec: r.status_exec ?? null,
      rnc: r.rnc ?? null,
      dataCab: r.data_cab ? new Date(r.data_cab).toISOString().slice(0, 10) : null,
      ambienteAfetado: parseJsonColumn(r.ambiente_afetado),
    });
  }
  return map;
}
