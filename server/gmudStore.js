import mysql from 'mysql2/promise';
import { instrumentMysqlPool } from './lib/mysqlPoolObservability.js';
import {
  AREA_STATUS,
  computeAreasStatus,
  generateApprovalToken,
  hashApprovalToken,
  isValidApprovalTokenShape,
} from './lib/gmudAreaApproval.js';

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
/** Listas configuráveis pelo admin do módulo (setores, equipes, sistemas, etc.). */
const CONFIG_TABLE = 'gmud_config_lists';
/** Histórico (trilha) da GMUD: quem fez o quê e quando. Alimenta a linha do tempo e os indicadores. */
const EVENTS_TABLE = 'gmud_events';
/** Metadados de arquivos anexados a GMUDs (o binário fica no filesystem). */
const ATTACHMENTS_TABLE = 'gmud_attachments';
/** Fluxogramas Mermaid gerados por IA ou criados manualmente para uma GMUD. */
const FLOWCHARTS_TABLE = 'gmud_flowcharts';
/** Aprovadores de e-mail por equipe — recebem notificação N8N quando uma GMUD é aberta. */
const TEAM_APPROVERS_TABLE = 'gmud_team_approvers';
const AREA_APPROVALS_TABLE = 'gmud_area_approvals';
const AREA_TOKENS_TABLE = 'gmud_area_approval_tokens';

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
  'anexo_adicionado',
  'anexo_removido',
  'fluxograma_criado',
  'fluxograma_atualizado',
  'fluxograma_removido',
  'area_aprovada',
  'area_negada',
  'area_aprovada_comite',
  'cancelamento_elleven_falhou',
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

/** Insere valores padrão de uma lista se ela ainda não tiver nenhuma linha ativa. */
async function seedConfigList(pool, listKey, labels) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM ${CONFIG_TABLE} WHERE list_key = ?`, [listKey],
  );
  if (Number(rows?.[0]?.c ?? 0) > 0) return;
  const values = labels.map((label, i) => [listKey, label, i]);
  await pool.query(
    `INSERT INTO ${CONFIG_TABLE} (list_key, label, sort_order) VALUES ?`, [values],
  );
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${CONFIG_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        list_key VARCHAR(64) NOT NULL,
        label VARCHAR(191) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_${CONFIG_TABLE}_key (list_key, active, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${ATTACHMENTS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        voalle_protocol BIGINT UNSIGNED NOT NULL,
        filename_original VARCHAR(512) NOT NULL,
        filename_stored VARCHAR(256) NOT NULL,
        mimetype VARCHAR(127) NOT NULL,
        size_bytes INT UNSIGNED NOT NULL,
        description VARCHAR(512) NULL,
        uploaded_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        INDEX idx_${ATTACHMENTS_TABLE}_protocol (voalle_protocol, deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${TEAM_APPROVERS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        equipe_id BIGINT UNSIGNED NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_display_name VARCHAR(255) NULL,
        created_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_${TEAM_APPROVERS_TABLE}_equipe_email (equipe_id, user_email),
        INDEX idx_${TEAM_APPROVERS_TABLE}_equipe (equipe_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Aprovação por área: um pedido por (GMUD, área); basta uma pessoa da área decidir.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${AREA_APPROVALS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        voalle_protocol BIGINT UNSIGNED NOT NULL,
        area_id BIGINT UNSIGNED NOT NULL,
        area_label VARCHAR(191) NOT NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pendente',
        decided_by_email VARCHAR(255) NULL,
        decided_by_name VARCHAR(255) NULL,
        decided_at DATETIME NULL,
        motivo VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_${AREA_APPROVALS_TABLE}_protocol_area (voalle_protocol, area_id),
        INDEX idx_${AREA_APPROVALS_TABLE}_protocol (voalle_protocol)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Um código por pessoa/área. Só o hash SHA-256 é guardado; o código em claro vai só no link.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${AREA_TOKENS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        approval_id BIGINT UNSIGNED NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_display_name VARCHAR(255) NULL,
        token_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_${AREA_TOKENS_TABLE}_hash (token_hash),
        INDEX idx_${AREA_TOKENS_TABLE}_approval (approval_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${FLOWCHARTS_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        voalle_protocol BIGINT UNSIGNED NOT NULL,
        mermaid_source MEDIUMTEXT NOT NULL,
        version INT UNSIGNED NOT NULL DEFAULT 1,
        origin ENUM('ai', 'manual', 'imported') NOT NULL DEFAULT 'manual',
        review_status ENUM('draft', 'reviewed') NOT NULL DEFAULT 'draft',
        ai_model VARCHAR(64) NULL,
        ai_warnings JSON NULL,
        created_by VARCHAR(191) NULL,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        INDEX idx_${FLOWCHARTS_TABLE}_protocol (voalle_protocol, deleted_at),
        INDEX idx_${FLOWCHARTS_TABLE}_updated (voalle_protocol, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await seedConfigList(pool, 'areas', [
      'Oper/Infra', 'Oper/Reparo', 'T&TI/CGR', 'T&TI/COR', 'T&TI/Suporte',
      'T&TI/TI-Dev', 'T&TI/TI-Infra', 'Dir/Projetos', 'Atendimento', 'Comercial',
      'Financeiro', 'RH', 'Jurídico',
    ]);
    await seedConfigList(pool, 'equipes', [
      'TI', 'CGR', 'COR', 'NOC', 'Suporte Técnico', 'Infraestrutura',
      'Desenvolvimento', 'Comercial', 'Qualidade', 'Projetos',
    ]);
    await seedConfigList(pool, 'processos', [
      'Ativação de serviços', 'Cobrança e faturamento', 'Suporte ao cliente',
      'Atendimento presencial', 'Vendas e contratos', 'Planejamento de rede',
      'Monitoramento e NOC', 'Projetos e implantação',
    ]);
    await seedConfigList(pool, 'sistemas_internos', [
      'Sebratel Hub Apps', 'Monitoramento Splitters', 'CRM Comercial',
    ]);
    await seedConfigList(pool, 'sistemas_externos', [
      'Voalle/Elleven', 'GeoGrid', 'Native', 'Matrix',
    ]);

    // Migração idempotente: adiciona colunas novas em tabelas já existentes (o CREATE acima só
    // vale para instalações novas). MySQL não tem "ADD COLUMN IF NOT EXISTS", então checamos antes.
    await ensureColumn(pool, TABLE, 'assignment_id', 'BIGINT UNSIGNED NULL AFTER voalle_protocol');
    await ensureColumn(pool, TABLE, 'assunto', 'VARCHAR(80) NULL AFTER tipo');
    await ensureColumn(pool, TABLE, 'elleven_encerrado_em', 'DATETIME NULL');
    await ensureColumn(pool, TABLE, 'elleven_encerrado_status', 'VARCHAR(16) NULL');
    // Quando o Comitê decidiu (aprovada/negada) — base do "tempo até a decisão".
    await ensureColumn(pool, TABLE, 'decidido_em', 'DATETIME NULL AFTER aprovado_por');
    // Formulários dinâmicos (Massivas 3.4 fase 2): categoria da GMUD + dados específicos.
    await ensureColumn(pool, TABLE, 'categoria', "VARCHAR(32) NULL COMMENT 'rede_externa | sistemas_internos | sistemas_externos'");
    await ensureColumn(pool, TABLE, 'categoria_data', 'JSON NULL');
    // GMUDs anteriores à aprovação por área ficam 'nao_aplicavel' e seguem direto ao Comitê.
    await ensureColumn(pool, TABLE, 'status_areas', "VARCHAR(16) NOT NULL DEFAULT 'nao_aplicavel' COMMENT 'nao_aplicavel | pendente | aprovada | negada'");
    await ensureColumn(pool, TABLE, 'equipe_responsavel_id', 'BIGINT UNSIGNED NULL COMMENT \'ID da equipe responsável (gmud_config_lists) — usada no fluxo de aprovação por e-mail\'');
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
/**
 * GMUDs são apresentadas toda terça e só executam 7 dias depois da apresentação (próxima terça
 * estritamente depois de hoje, fuso de Brasília). Retorna `yyyy-MM-dd`. Espelha `minDataProgramada`
 * em src/features/gmud/model/gmudForm.ts.
 */
export function minDataProgramada(now = new Date()) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
  const [y, m, d] = hoje.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const diasAteTerca = ((2 - base.getUTCDay() + 7) % 7) || 7;
  base.setUTCDate(base.getUTCDate() + diasAteTerca + 7);
  return base.toISOString().slice(0, 10);
}

export async function createGmudRequest(input) {
  await ensureTable();
  const pool = getMysqlPool();

  const protocol = normalizePositiveInt(input.voalleProtocol);
  const row = {
    voalle_protocol: protocol,
    assignment_id: normalizePositiveInt(input.assignmentId),
    tipo: toCleanString(input.tipo) || null,
    assunto: toCleanString(input.assunto) || null,
    categoria: toCleanString(input.categoria) || null,
    categoria_data: jsonOrNull(input.categoriaData ?? null),
    equipe_responsavel_id: normalizePositiveInt(input.equipeResponsavelId ?? null),
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
// Motivo do encerramento no Elleven: 'concluida' (GMUD concluída), 'negada' (reprovada pelo Comitê)
// ou 'cancelada' (GMUD cancelada — mudança abortada, como o cancelamento de massiva).
const ELLEVEN_ENCERRADO_STATUS = new Set(['concluida', 'negada', 'cancelada']);

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
    input.ellevenEncerrado && ELLEVEN_ENCERRADO_STATUS.has(input.ellevenEncerrado.status)
      ? input.ellevenEncerrado.status
      : null;

  // Estado anterior: para registrar só o que mudou (trilha) e carimbar a data da decisão.
  const [prevRows] = await pool.query(
    `SELECT status_comite, status_exec, elleven_encerrado_em, status_areas FROM ${TABLE} WHERE voalle_protocol = ? LIMIT 1`,
    [protocol],
  );
  const prev = prevRows?.[0] ?? null;
  // O Comitê só aprova depois que todas as áreas aprovaram (ou o Comitê aprova em nome da área).
  if (statusComite === 'aprovada' && prev) {
    if (prev.status_areas === AREA_STATUS.PENDENTE) {
      const pendentes = await pendingAreaLabels(pool, protocol);
      throw buildError(
        `Aguardando aprovação das áreas: ${pendentes.join(', ') || 'áreas pendentes'}. O Comitê pode aprovar em nome da área no detalhe da GMUD.`,
        409,
      );
    }
    if (prev.status_areas === AREA_STATUS.NEGADA) {
      throw buildError('Esta GMUD foi negada por uma das áreas e não pode ser aprovada.', 409);
    }
  }
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
    statusAreas: r.status_areas ?? AREA_STATUS.NAO_APLICAVEL,
    voalleProtocol: r.voalle_protocol != null ? Number(r.voalle_protocol) : null,
    assignmentId: r.assignment_id != null ? Number(r.assignment_id) : null,
    tipo: r.tipo ?? null,
    assunto: r.assunto ?? null,
    categoria: r.categoria ?? null,
    categoriaData: parseJsonColumn(r.categoria_data),
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
    equipeResponsavelId: r.equipe_responsavel_id != null ? Number(r.equipe_responsavel_id) : null,
    createdByEmail: r.created_by_email ?? null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  };
}

/** Lista as GMUDs aguardando decisão do Comitê (status_comite = 'pendente'), escopo completo. */
export async function listPendingGmuds() {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLE} WHERE status_comite = 'pendente' AND status_areas IN ('nao_aplicavel', 'aprovada') ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(mapGmudRow);
}

/** Quantidade de GMUDs pendentes de aprovação (para o badge do menu). */
export async function getPendingGmudCount() {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLE} WHERE status_comite = 'pendente' AND status_areas IN ('nao_aplicavel', 'aprovada')`,
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
  if (current.tipo === 'Programada' && next.dataInicio !== previous.dataInicio) {
    const minimo = minDataProgramada();
    if (next.dataInicio < minimo) {
      throw buildError(
        `GMUD Programada só pode ser reagendada para a partir de ${minimo.split('-').reverse().join('/')} (apresentação na terça + 7 dias).`,
        400,
      );
    }
  }
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
    `SELECT voalle_protocol, assignment_id, tipo, assunto, categoria, pop_site, impacto_parada, comunica_cliente,
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
      categoria: r.categoria ?? null,
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

// ---------------------------------------------------------------------------
// Listas configuráveis do módulo GMUD
// ---------------------------------------------------------------------------

/**
 * Retorna todas as listas configuráveis como um mapa { [listKey]: string[] }.
 * Somente itens ativos, ordenados por sort_order, label.
 */
export async function getGmudConfigLists() {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT id, list_key, label FROM ${CONFIG_TABLE}
      WHERE active = 1 ORDER BY list_key, sort_order, label`,
  );
  const result = {};
  for (const r of rows) {
    if (!result[r.list_key]) result[r.list_key] = [];
    result[r.list_key].push({ id: Number(r.id), label: r.label });
  }
  return result;
}

/**
 * Adiciona um novo item a uma lista configurável.
 * @returns {{ id: number, label: string }}
 */
export async function addGmudConfigItem(listKey, label, createdBy) {
  await ensureTable();
  const pool = getMysqlPool();
  const key = toCleanString(listKey);
  const lbl = toCleanString(label);
  const VALID_KEYS = new Set(['areas', 'equipes', 'processos', 'sistemas_internos', 'sistemas_externos']);
  if (!VALID_KEYS.has(key)) throw buildError(`Lista inválida: ${key}`, 400);
  if (lbl === '') throw buildError('O nome do item não pode ser vazio.', 400);
  if (lbl.length > 191) throw buildError('Nome muito longo (máx. 191 caracteres).', 400);
  // Dedupe: não duplicar label ativa na mesma lista
  const [existing] = await pool.query(
    `SELECT id FROM ${CONFIG_TABLE} WHERE list_key = ? AND label = ? AND active = 1 LIMIT 1`,
    [key, lbl],
  );
  if (existing.length > 0) throw buildError(`"${lbl}" já existe na lista.`, 409);
  const [result] = await pool.query(
    `INSERT INTO ${CONFIG_TABLE} (list_key, label, sort_order, created_by) VALUES (?, ?, 999, ?)`,
    [key, lbl, toCleanString(createdBy) || null],
  );
  return { id: result.insertId, label: lbl };
}

/**
 * Desativa (soft-delete) um item da lista configurável.
 * Não remove registros históricos — apenas oculta da seleção em novos formulários.
 */
export async function deactivateGmudConfigItem(id) {
  await ensureTable();
  const pool = getMysqlPool();
  const itemId = normalizePositiveInt(id);
  if (!itemId) throw buildError('ID de item inválido.', 400);
  const [result] = await pool.query(
    `UPDATE ${CONFIG_TABLE} SET active = 0 WHERE id = ? AND active = 1`, [itemId],
  );
  if (result.affectedRows === 0) throw buildError('Item não encontrado ou já removido.', 404);
  return { id: itemId };
}

// ─── ANEXOS ──────────────────────────────────────────────────────────────────

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Grava os metadados de um arquivo recém-enviado.
 * O arquivo já deve estar salvo no filesystem antes desta chamada.
 */
export async function addGmudAttachment({ voalleProtocol, filenameOriginal, filenameStored, mimetype, sizeBytes, description, uploadedBy }) {
  await ensureTable();
  const pool = getMysqlPool();
  const protocol = normalizePositiveInt(voalleProtocol);
  if (!protocol) throw buildError('Protocolo inválido.', 400);
  if (!ALLOWED_MIMETYPES.has(mimetype)) throw buildError(`Tipo de arquivo não permitido: ${mimetype}`, 400);
  if (sizeBytes > MAX_ATTACHMENT_BYTES) throw buildError('Arquivo excede o limite de 10 MB.', 400);

  const [result] = await pool.query(
    `INSERT INTO ${ATTACHMENTS_TABLE}
       (voalle_protocol, filename_original, filename_stored, mimetype, size_bytes, description, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [protocol, filenameOriginal, filenameStored, mimetype, sizeBytes, description ?? null, uploadedBy ?? null],
  );
  return {
    id: result.insertId,
    voalleProtocol: protocol,
    filenameOriginal,
    filenameStored,
    mimetype,
    sizeBytes,
    description: description ?? null,
    uploadedBy: uploadedBy ?? null,
  };
}

/**
 * Lista os metadados de anexos ativos de uma GMUD (excluindo soft-deleted).
 */
export async function listGmudAttachments(voalleProtocol) {
  await ensureTable();
  const pool = getMysqlPool();
  const protocol = normalizePositiveInt(voalleProtocol);
  if (!protocol) throw buildError('Protocolo inválido.', 400);

  const [rows] = await pool.query(
    `SELECT id, voalle_protocol, filename_original, filename_stored, mimetype, size_bytes, description, uploaded_by, created_at
     FROM ${ATTACHMENTS_TABLE}
     WHERE voalle_protocol = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [protocol],
  );
  return rows.map((r) => ({
    id: r.id,
    voalleProtocol: r.voalle_protocol,
    filenameOriginal: r.filename_original,
    filenameStored: r.filename_stored,
    mimetype: r.mimetype,
    sizeBytes: r.size_bytes,
    description: r.description,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  }));
}

/**
 * Retorna os metadados de um único anexo (para validação antes de servir o arquivo).
 * Lança 404 se não encontrado ou já excluído.
 */
export async function getGmudAttachment(attachmentId) {
  await ensureTable();
  const pool = getMysqlPool();
  const id = normalizePositiveInt(attachmentId);
  if (!id) throw buildError('ID de anexo inválido.', 400);

  const [rows] = await pool.query(
    `SELECT id, voalle_protocol, filename_original, filename_stored, mimetype, size_bytes, description, uploaded_by, created_at
     FROM ${ATTACHMENTS_TABLE}
     WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!rows || rows.length === 0) throw buildError('Anexo não encontrado.', 404);
  const r = rows[0];
  return {
    id: r.id,
    voalleProtocol: r.voalle_protocol,
    filenameOriginal: r.filename_original,
    filenameStored: r.filename_stored,
    mimetype: r.mimetype,
    sizeBytes: r.size_bytes,
    description: r.description,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

/**
 * Soft-delete de um anexo. Retorna o `filenameStored` para que o handler
 * possa excluir o arquivo do filesystem após confirmar o soft-delete.
 */
export async function softDeleteGmudAttachment(attachmentId) {
  await ensureTable();
  const pool = getMysqlPool();
  const id = normalizePositiveInt(attachmentId);
  if (!id) throw buildError('ID de anexo inválido.', 400);

  const [rows] = await pool.query(
    `SELECT id, voalle_protocol, filename_stored FROM ${ATTACHMENTS_TABLE} WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!rows || rows.length === 0) throw buildError('Anexo não encontrado.', 404);
  const { voalle_protocol: protocol, filename_stored: filenameStored } = rows[0];

  await pool.query(
    `UPDATE ${ATTACHMENTS_TABLE} SET deleted_at = NOW() WHERE id = ?`, [id],
  );
  return { id, voalleProtocol: protocol, filenameStored };
}

// ─── Aprovadores de e-mail por área ─────────────────────────────────────────
// Cada área (lista 'areas' de gmud_config_lists) tem pessoas a avisar por e-mail quando uma GMUD
// que a marcou em "Áreas impactadas/afetadas" é aprovada. A coluna `equipe_id` guarda o ID da
// ÁREA (nome mantido por compatibilidade com a tabela já criada).

/**
 * Retorna todos os aprovadores agrupados por área: { [areaId]: [{id, userEmail, userDisplayName}] }
 */
export async function getAllTeamApprovers() {
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT id, equipe_id, user_email, user_display_name FROM ${TEAM_APPROVERS_TABLE} ORDER BY equipe_id, id`,
  );
  const result = {};
  for (const r of rows) {
    const key = Number(r.equipe_id);
    if (!result[key]) result[key] = [];
    result[key].push({
      id: Number(r.id),
      userEmail: r.user_email,
      userDisplayName: r.user_display_name ?? null,
    });
  }
  return result;
}

/**
 * Quem avisar numa GMUD: junta as pessoas cadastradas nas áreas marcadas (pelo nome da área),
 * sem repetir e-mail. Áreas sem cadastro simplesmente não contribuem.
 */
export async function getApproversForAreas(areaLabels) {
  await ensureTable();
  const labels = [...new Set((Array.isArray(areaLabels) ? areaLabels : []).map(toCleanString).filter((l) => l !== ''))];
  if (labels.length === 0) return [];
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT a.user_email, a.user_display_name
       FROM ${TEAM_APPROVERS_TABLE} a
       JOIN ${CONFIG_TABLE} c ON c.id = a.equipe_id
      WHERE c.list_key = 'areas' AND c.label IN (?)
      ORDER BY a.id`,
    [labels],
  );
  const seen = new Set();
  const result = [];
  for (const r of rows) {
    const key = String(r.user_email).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ userEmail: r.user_email, userDisplayName: r.user_display_name ?? null });
  }
  return result;
}

/**
 * Adiciona uma pessoa a uma área. Idempotente por (areaId, userEmail).
 */
export async function addTeamApprover({ areaId, userEmail, userDisplayName, createdBy }) {
  await ensureTable();
  const pool = getMysqlPool();
  const id = normalizePositiveInt(areaId);
  if (!id) throw buildError('ID de área inválido.', 400);
  const [areaRows] = await pool.query(
    `SELECT id FROM ${CONFIG_TABLE} WHERE id = ? AND list_key = 'areas' AND active = 1 LIMIT 1`,
    [id],
  );
  if (areaRows.length === 0) throw buildError('Área não encontrada.', 404);
  const email = toCleanString(userEmail);
  if (email === '' || !email.includes('@')) throw buildError('E-mail inválido.', 400);
  if (email.length > 255) throw buildError('E-mail muito longo.', 400);
  const displayName = toCleanString(userDisplayName) || null;
  const createdByClean = toCleanString(createdBy) || null;
  const [existing] = await pool.query(
    `SELECT id FROM ${TEAM_APPROVERS_TABLE} WHERE equipe_id = ? AND user_email = ? LIMIT 1`,
    [id, email],
  );
  if (existing.length > 0) throw buildError(`"${email}" já é avisado nesta área.`, 409);
  const [result] = await pool.query(
    `INSERT INTO ${TEAM_APPROVERS_TABLE} (equipe_id, user_email, user_display_name, created_by) VALUES (?, ?, ?, ?)`,
    [id, email, displayName, createdByClean],
  );
  return { id: result.insertId, areaId: id, userEmail: email, userDisplayName: displayName };
}

/** Remove um aprovador por ID. */
export async function removeTeamApprover(approverRowId) {
  await ensureTable();
  const pool = getMysqlPool();
  const id = normalizePositiveInt(approverRowId);
  if (!id) throw buildError('ID de aprovador inválido.', 400);
  const [result] = await pool.query(
    `DELETE FROM ${TEAM_APPROVERS_TABLE} WHERE id = ?`, [id],
  );
  if (result.affectedRows === 0) throw buildError('Aprovador não encontrado.', 404);
  return { id };
}

// ─── Aprovação por área ─────────────────────────────────────────────────────

async function pendingAreaLabels(pool, protocol) {
  const [rows] = await pool.query(
    `SELECT area_label FROM ${AREA_APPROVALS_TABLE} WHERE voalle_protocol = ? AND status = 'pendente' ORDER BY id`,
    [protocol],
  );
  return rows.map((r) => r.area_label);
}

/** Recalcula e grava a situação geral das áreas da GMUD. */
async function recomputeAreasStatus(pool, protocol) {
  const [rows] = await pool.query(
    `SELECT status FROM ${AREA_APPROVALS_TABLE} WHERE voalle_protocol = ?`,
    [protocol],
  );
  const status = computeAreasStatus(rows.map((r) => r.status));
  await pool.query(`UPDATE ${TABLE} SET status_areas = ? WHERE voalle_protocol = ?`, [status, protocol]);
  return status;
}

/**
 * Resolve nomes de área para o cadastro (lista 'areas') e as pessoas que aprovam por elas.
 * Área que não existe mais na lista volta com areaId nulo e sem pessoas.
 */
export async function resolveAreasWithApprovers(areaLabels) {
  await ensureTable();
  const labels = [...new Set((Array.isArray(areaLabels) ? areaLabels : []).map(toCleanString).filter((l) => l !== ''))];
  if (labels.length === 0) return [];
  const pool = getMysqlPool();
  const [areaRows] = await pool.query(
    `SELECT id, label FROM ${CONFIG_TABLE} WHERE list_key = 'areas' AND active = 1 AND label IN (?)`,
    [labels],
  );
  const idByLabel = new Map(areaRows.map((r) => [String(r.label).toLowerCase(), Number(r.id)]));
  const ids = [...idByLabel.values()];
  let people = [];
  if (ids.length > 0) {
    [people] = await pool.query(
      `SELECT equipe_id, user_email, user_display_name FROM ${TEAM_APPROVERS_TABLE} WHERE equipe_id IN (?) ORDER BY id`,
      [ids],
    );
  }
  return labels.map((label) => {
    const areaId = idByLabel.get(label.toLowerCase()) ?? null;
    return {
      label,
      areaId,
      people: areaId === null
        ? []
        : people
            .filter((p) => Number(p.equipe_id) === areaId)
            .map((p) => ({ email: p.user_email, name: p.user_display_name ?? p.user_email })),
    };
  });
}

/**
 * Cria o pedido de aprovação de cada área e um código por pessoa. Devolve os códigos em claro
 * (só existem aqui, para montar os links do e-mail; no banco fica apenas o hash).
 * A GMUD já nasce bloqueada ('pendente') — se algo falhar no meio, ela não segue ao Comitê.
 */
export async function createAreaApprovals({ protocol, areas, ttlDays = 30 }) {
  await ensureTable();
  const pool = getMysqlPool();
  const proto = normalizePositiveInt(protocol);
  if (!proto) throw buildError('Protocolo inválido.', 400);
  if (!Array.isArray(areas) || areas.length === 0) return [];

  await pool.query(`UPDATE ${TABLE} SET status_areas = 'pendente' WHERE voalle_protocol = ?`, [proto]);
  const expiresAt = new Date(Date.now() + Math.max(1, Number(ttlDays) || 30) * 86_400_000);
  const result = [];
  for (const area of areas) {
    await pool.query(
      `INSERT INTO ${AREA_APPROVALS_TABLE} (voalle_protocol, area_id, area_label) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE area_label = VALUES(area_label)`,
      [proto, area.areaId, area.label],
    );
    const [idRows] = await pool.query(
      `SELECT id FROM ${AREA_APPROVALS_TABLE} WHERE voalle_protocol = ? AND area_id = ? LIMIT 1`,
      [proto, area.areaId],
    );
    const approvalId = Number(idRows[0].id);
    const pessoas = [];
    for (const person of area.people) {
      const { token, hash } = generateApprovalToken();
      await pool.query(
        `INSERT INTO ${AREA_TOKENS_TABLE} (approval_id, user_email, user_display_name, token_hash, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [approvalId, person.email, person.name ?? null, hash, expiresAt],
      );
      pessoas.push({ email: person.email, nome: person.name ?? person.email, token });
    }
    result.push({ areaId: area.areaId, areaLabel: area.label, pessoas });
  }
  return result;
}

/** Situação das áreas de uma GMUD, para o detalhe (sem códigos). */
export async function getAreaApprovals(protocol) {
  await ensureTable();
  const pool = getMysqlPool();
  const proto = normalizePositiveInt(protocol);
  if (!proto) return [];
  const [rows] = await pool.query(
    `SELECT id, area_id, area_label, status, decided_by_email, decided_by_name, decided_at, motivo
       FROM ${AREA_APPROVALS_TABLE} WHERE voalle_protocol = ? ORDER BY id`,
    [proto],
  );
  if (rows.length === 0) return [];
  const [people] = await pool.query(
    `SELECT approval_id, user_email, user_display_name FROM ${AREA_TOKENS_TABLE} WHERE approval_id IN (?) ORDER BY id`,
    [rows.map((r) => Number(r.id))],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    areaId: Number(r.area_id),
    areaLabel: r.area_label,
    status: r.status,
    decidedByEmail: r.decided_by_email ?? null,
    decidedByName: r.decided_by_name ?? null,
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    motivo: r.motivo ?? null,
    pessoas: people
      .filter((p) => Number(p.approval_id) === Number(r.id))
      .map((p) => ({ email: p.user_email, nome: p.user_display_name ?? p.user_email })),
  }));
}

const TRUNC = (value, max) => {
  const text = toCleanString(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/**
 * Consulta um código de aprovação. state: invalid | pending | decided | expired | closed.
 * Não expõe nada além do resumo mínimo da GMUD para quem tem o link.
 */
export async function lookupApprovalToken(token) {
  if (!isValidApprovalTokenShape(token)) return { state: 'invalid' };
  await ensureTable();
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT t.id AS token_id, t.approval_id, t.user_email, t.user_display_name, t.expires_at,
            a.voalle_protocol, a.area_label, a.status, a.decided_by_name, a.decided_at, a.motivo,
            g.titulo, g.tipo, g.categoria, g.descricao, g.pop_site, g.solicitante_nome,
            g.data_inicio, g.hora_inicio, g.data_fim, g.hora_fim, g.status_comite, g.status_areas, g.assignment_id
       FROM ${AREA_TOKENS_TABLE} t
       JOIN ${AREA_APPROVALS_TABLE} a ON a.id = t.approval_id
       LEFT JOIN ${TABLE} g ON g.voalle_protocol = a.voalle_protocol
      WHERE t.token_hash = ? LIMIT 1`,
    [hashApprovalToken(token)],
  );
  const r = rows?.[0];
  if (!r) return { state: 'invalid' };

  const base = {
    tokenId: Number(r.token_id),
    approvalId: Number(r.approval_id),
    protocol: Number(r.voalle_protocol),
    areaLabel: r.area_label,
    approverEmail: r.user_email,
    approverName: r.user_display_name ?? r.user_email,
    assignmentId: r.assignment_id != null ? Number(r.assignment_id) : null,
    gmud: {
      protocolo: Number(r.voalle_protocol),
      titulo: r.titulo ?? '',
      tipo: r.tipo ?? '',
      categoria: r.categoria ?? '',
      descricao: TRUNC(r.descricao, 1500),
      popSite: r.pop_site ?? '',
      solicitante: r.solicitante_nome ?? '',
      dataInicio: toDateStr(r.data_inicio) ?? '',
      horaInicio: toTimeStr(r.hora_inicio) ?? '',
      dataFim: toDateStr(r.data_fim) ?? '',
      horaFim: toTimeStr(r.hora_fim) ?? '',
    },
  };
  if (r.status !== AREA_STATUS.PENDENTE) {
    return {
      ...base,
      state: 'decided',
      decision: r.status,
      decidedByName: r.decided_by_name ?? null,
      decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    };
  }
  if (r.status_areas === AREA_STATUS.NEGADA || r.status_comite === 'negada') return { ...base, state: 'closed' };
  if (new Date(r.expires_at).getTime() < Date.now()) return { ...base, state: 'expired' };
  return { ...base, state: 'pending' };
}

/**
 * Registra a decisão de uma área por código. A primeira decisão vence (UPDATE condicional):
 * dois cliques simultâneos não decidem duas vezes.
 */
export async function decideAreaApproval({ token, decision, motivo }) {
  const info = await lookupApprovalToken(token);
  if (info.state === 'invalid') throw buildError('Link inválido ou expirado.', 404);
  if (info.state === 'decided') {
    throw buildError(`Esta área já foi decidida${info.decidedByName ? ` por ${info.decidedByName}` : ''}.`, 409);
  }
  if (info.state === 'closed') throw buildError('Esta GMUD já foi negada por outra área.', 409);
  if (info.state === 'expired') throw buildError('Link inválido ou expirado.', 410);

  if (decision !== AREA_STATUS.APROVADA && decision !== AREA_STATUS.NEGADA) {
    throw buildError('Decisão inválida.', 400);
  }
  const reason = TRUNC(motivo, 500);
  if (decision === AREA_STATUS.NEGADA && reason.length < 3) {
    throw buildError('Informe o motivo da negativa.', 400);
  }

  const pool = getMysqlPool();
  const [upd] = await pool.query(
    `UPDATE ${AREA_APPROVALS_TABLE}
        SET status = ?, decided_by_email = ?, decided_by_name = ?, decided_at = NOW(), motivo = ?
      WHERE id = ? AND status = 'pendente'`,
    [decision, info.approverEmail, info.approverName, reason || null, info.approvalId],
  );
  if (upd.affectedRows !== 1) throw buildError('Esta área já foi decidida.', 409);
  await pool.query(`UPDATE ${AREA_TOKENS_TABLE} SET used_at = NOW() WHERE id = ?`, [info.tokenId]);
  const areasStatus = await recomputeAreasStatus(pool, info.protocol);

  return {
    protocol: info.protocol,
    areaLabel: info.areaLabel,
    decision,
    motivo: reason || null,
    areasStatus,
    decidedByName: info.approverName,
    decidedByEmail: info.approverEmail,
    assignmentId: info.assignmentId,
    titulo: info.gmud.titulo,
  };
}

/** O Comitê aprova em nome de uma área que não respondeu, para a GMUD não ficar parada. */
export async function overrideAreaApproval({ protocol, areaId, byName, byEmail }) {
  await ensureTable();
  const pool = getMysqlPool();
  const proto = normalizePositiveInt(protocol);
  const area = normalizePositiveInt(areaId);
  if (!proto || !area) throw buildError('Protocolo ou área inválidos.', 400);
  const [rows] = await pool.query(
    `SELECT id, area_label, status FROM ${AREA_APPROVALS_TABLE} WHERE voalle_protocol = ? AND area_id = ? LIMIT 1`,
    [proto, area],
  );
  const row = rows?.[0];
  if (!row) throw buildError('Aprovação da área não encontrada.', 404);
  const [upd] = await pool.query(
    `UPDATE ${AREA_APPROVALS_TABLE}
        SET status = 'aprovada', decided_by_email = ?, decided_by_name = ?, decided_at = NOW(),
            motivo = 'Aprovada pelo Comitê em nome da área'
      WHERE id = ? AND status = 'pendente'`,
    [toCleanString(byEmail) || null, toCleanString(byName) || null, row.id],
  );
  if (upd.affectedRows !== 1) throw buildError('Esta área já foi decidida.', 409);
  const areasStatus = await recomputeAreasStatus(pool, proto);
  return { protocol: proto, areaLabel: row.area_label, areasStatus };
}

// ─── Fluxogramas GMUD ───────────────────────────────────────────────────────

function mapFlowchartRow(row) {
  return {
    id: Number(row.id),
    voalleProtocol: Number(row.voalle_protocol),
    mermaidSource: row.mermaid_source,
    version: Number(row.version),
    origin: row.origin,
    reviewStatus: row.review_status,
    aiModel: row.ai_model ?? null,
    aiWarnings: Array.isArray(row.ai_warnings) ? row.ai_warnings : (row.ai_warnings ? JSON.parse(row.ai_warnings) : []),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
  };
}

/** Retorna o fluxograma ativo mais recente de uma GMUD, ou null se não existir. */
export async function getGmudFlowchart(voalleProtocol) {
  await ensureTable();
  const pool = getMysqlPool();
  const protocol = normalizePositiveInt(voalleProtocol);
  if (!protocol) throw buildError('Protocolo inválido.', 400);

  const [rows] = await pool.query(
    `SELECT * FROM ${FLOWCHARTS_TABLE}
      WHERE voalle_protocol = ? AND deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 1`,
    [protocol],
  );
  return rows && rows.length > 0 ? mapFlowchartRow(rows[0]) : null;
}

/**
 * Cria ou atualiza o fluxograma de uma GMUD (upsert por protocolo — uma GMUD tem no máximo um
 * fluxograma ativo; salvar novamente incrementa a versão).
 */
export async function saveGmudFlowchart(input) {
  await ensureTable();
  const pool = getMysqlPool();
  const protocol = normalizePositiveInt(input?.voalleProtocol);
  if (!protocol) throw buildError('Protocolo inválido.', 400);

  const source = toCleanString(input?.mermaidSource);
  if (!source) throw buildError('Fonte Mermaid não pode ser vazia.', 400);
  if (source.length > 200000) throw buildError('Fluxograma excede o limite de tamanho.', 413);

  const VALID_ORIGINS = new Set(['ai', 'manual', 'imported']);
  const origin = VALID_ORIGINS.has(input?.origin) ? input.origin : 'manual';
  const reviewStatus = input?.reviewStatus === 'reviewed' ? 'reviewed' : 'draft';
  const createdBy = toCleanString(input?.createdBy) || null;
  const aiModel = toCleanString(input?.aiModel) || null;
  const aiWarnings = Array.isArray(input?.aiWarnings) ? JSON.stringify(input.aiWarnings) : null;

  // Verificar se já existe fluxograma ativo para incrementar versão
  const [existing] = await pool.query(
    `SELECT id, version FROM ${FLOWCHARTS_TABLE} WHERE voalle_protocol = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [protocol],
  );

  if (existing && existing.length > 0) {
    const row = existing[0];
    const newVersion = Number(row.version) + 1;
    await pool.query(
      `UPDATE ${FLOWCHARTS_TABLE}
        SET mermaid_source = ?, version = ?, origin = ?, review_status = ?,
            ai_model = ?, ai_warnings = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ?`,
      [source, newVersion, origin, reviewStatus, aiModel, aiWarnings, createdBy, row.id],
    );
    return await getGmudFlowchart(protocol);
  }

  await pool.query(
    `INSERT INTO ${FLOWCHARTS_TABLE}
      (voalle_protocol, mermaid_source, version, origin, review_status, ai_model, ai_warnings, created_by, updated_by)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [protocol, source, origin, reviewStatus, aiModel, aiWarnings, createdBy, createdBy],
  );
  return await getGmudFlowchart(protocol);
}

/**
 * Retorna GMUDs aprovadas cuja data_inicio cai exatamente daysAhead dias a frente.
 * Usado pelo endpoint /api/gmud/corporate-hsm-preview (N8N cron D-7).
 */
export async function listGmudUpcomingForHsm(daysAhead = 7) {
  await ensureTable();
  const pool = getMysqlPool();
  const days = Math.max(1, Math.min(30, Number(daysAhead) || 7));
  const [rows] = await pool.query(
    `SELECT voalle_protocol, titulo, tipo, categoria, pop_site,
            data_inicio, hora_inicio, data_fim, hora_fim
     FROM ${TABLE}
     WHERE status_comite = 'aprovada'
       AND pop_site IS NOT NULL
       AND TRIM(pop_site) != ''
       AND DATE(data_inicio) = DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
    [days],
  );
  return rows.map((r) => ({
    voalleProtocol: Number(r.voalle_protocol),
    titulo: r.titulo ?? '',
    tipo: r.tipo ?? '',
    categoria: r.categoria ?? '',
    popSite: (r.pop_site ?? '').trim(),
    dataInicio: r.data_inicio ? String(r.data_inicio).slice(0, 10) : '',
    horaInicio: r.hora_inicio ?? '',
    dataFim: r.data_fim ? String(r.data_fim).slice(0, 10) : '',
    horaFim: r.hora_fim ?? '',
  }));
}

/** Marca o fluxograma como deletado (soft delete). */
export async function deleteGmudFlowchart(voalleProtocol) {
  await ensureTable();
  const pool = getMysqlPool();
  const protocol = normalizePositiveInt(voalleProtocol);
  if (!protocol) throw buildError('Protocolo inválido.', 400);

  const [rows] = await pool.query(
    `SELECT id FROM ${FLOWCHARTS_TABLE} WHERE voalle_protocol = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [protocol],
  );
  if (!rows || rows.length === 0) throw buildError('Fluxograma não encontrado.', 404);
  await pool.query(`UPDATE ${FLOWCHARTS_TABLE} SET deleted_at = NOW() WHERE id = ?`, [rows[0].id]);
  return { voalleProtocol: protocol };
}
