import mysql from 'mysql2/promise';
import {
  mysqlNaiveDateTimeToIso,
  parseMysqlNaiveDateTimeParts,
} from './mysqlBrazilDateTime.js';
import { splitterLabelsMatchOptionalPonFilter } from './splitterTitleOltDerivation.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text === '' ? null : text;
}

function normalizePositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Status do histórico: 'encerrada' | 'cancelada' | (fallback) 'aberta'. */
function normalizeMassivaHistoryStatus(value) {
  const s = normalizeText(value).toLowerCase();
  if (s === 'encerrada') return 'encerrada';
  if (s === 'cancelada') return 'cancelada';
  return 'aberta';
}

function normalizeNonNegativeInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** DATETIME MySQL / `yyyy-MM-dd'T'HH:mm:ss` sem fuso — grava “de parede” de Brasília. */
function normalizeMysqlNaiveDateInput(value) {
  const parts = parseMysqlNaiveDateTimeParts(value);
  if (!parts) return null;
  const { y, mo, d, h, mi, s } = parts;
  const out = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(out.getTime()) ? null : out;
}

function serializeHistoryDate(value) {
  return mysqlNaiveDateTimeToIso(value);
}

/** @param {unknown} value */
function optionalPonQueryInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function uniqueSplitterEntries(entries) {
  const byCode = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const code = normalizeText(entry?.code);
    if (code === '') continue;
    const label = normalizeText(entry?.label) || code;
    if (!byCode.has(code)) byCode.set(code, { code, label });
  }
  return [...byCode.values()];
}

export function createMassivaHistoryStore(config) {
  const host = normalizeText(config.host);
  const port = normalizePositiveInt(config.port) ?? 3306;
  const user = normalizeText(config.user);
  const password = String(config.password ?? '');
  const database = normalizeText(config.database);

  const configured =
    host !== '' && user !== '' && password !== '' && database !== '';

  if (!configured) {
    return {
      configured: false,
      async ensureReady() {},
      async registerOpenBatch() {
        return { configured: false, insertedOrUpdated: 0 };
      },
      async registerClose() {
        return { configured: false, updated: 0 };
      },
      async registerCancel() {
        return { configured: false, updated: 0 };
      },
      async updateClassification() {
        return { configured: false, updated: 0 };
      },
      async registerAffectedClients() {
        return { configured: false, inserted: 0 };
      },
      async getAffectedClientsPppoeList() {
        return { configured: false, massivaHistoryId: null, pppoeList: [] };
      },
      async saveAffectedVerificationResult() {
        return { configured: false, updated: 0 };
      },
      async getRecentAffectedVerificationsWithProblems() {
        return [];
      },
      async updateExpectedClose() {
        return { configured: false, updated: 0 };
      },
      async markClosedByProtocols() {
        return { configured: false, updated: 0 };
      },
      async getSplitterStats() {
        return new Map();
      },
      async getMassivaPeriodRollup() {
        return {
          distinctMassivaCount: 0,
          affectedClientsDistinctSum: 0,
          openMassivasCount: 0,
          closedMassivasCount: 0,
        };
      },
      async getMassivaSplitterLinksInPeriod() {
        return [];
      },
      async getMassivaEventsWithSplitterInPeriod() {
        return [];
      },
      async getMassivaRecurrenceByDayShift() {
        return [];
      },
      async getSplitterCodesForProtocols() {
        return [];
      },
      async getOpenSplitterCodes() {
        return [];
      },
      async upsertSplitterSnapshots() {
        return { configured: false, insertedOrUpdated: 0 };
      },
      async getSplitterTrends() {
        return new Map();
      },
      async getRecentSplitterSnapshots() {
        return [];
      },
      async getRecentHistoryBySplitter() {
        return [];
      },
      async getOpenMassivaDashboardKpis() {
        return { openMassivas: 0, affectedClientsOpen: 0 };
      },
      async replaceNetworkReliefSnapshot() {
        return { configured: false, snapshotRunId: null, entryCount: 0 };
      },
      async hasCompletedNetworkReliefSnapshot() {
        return false;
      },
      async getLatestNetworkReliefSnapshotPage() {
        return null;
      },
      async getHistoryList() {
        return [];
      },
      async getMttdMttrMonthlyKpis() {
        return [];
      },
      async end() {},
    };
  }

  const dataPool = mysql.createPool({
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

  let readyPromise = null;

  /** Sem DDL: schema deve existir no MySQL (criação/migração manual no banco). */
  // Colunas opcionais detectadas/criadas no ensureReady sem quebrar nada.
  let hasClosedByColumn = false;
  let hasClassificationColumns = false;
  let hasEventStartColumn = false;
  let hasInfraProtocolColumns = false;
  let hasIdentifiedByColumn = false;
  let hasClassificationAuditColumns = false;
  let hasAffectedVerificationColumns = false;
  let hasAffectedClientsTable = false;

  /**
   * Adiciona uma coluna idempotentemente via ALTER TABLE.
   * errno 1060 = Duplicate column — esperado quando a coluna já existe.
   */
  async function addColumnIfMissing(columnDef) {
    try {
      await dataPool.query(`ALTER TABLE massiva_history ADD COLUMN ${columnDef}`);
    } catch (alterErr) {
      if (alterErr?.errno !== 1060) {
        console.warn(`[massiva-history] coluna não pôde ser criada (${columnDef.split(' ')[0]}):`, alterErr?.message ?? alterErr);
      }
    }
  }

  async function ensureReady() {
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
      await dataPool.query('SELECT 1');

      // Migração idempotente: closed_by
      await addColumnIfMissing('closed_by VARCHAR(255) NULL');
      try {
        const [cols] = await dataPool.query("SHOW COLUMNS FROM massiva_history LIKE 'closed_by'");
        hasClosedByColumn = Array.isArray(cols) && cols.length > 0;
      } catch {
        hasClosedByColumn = false;
      }

      // Migração idempotente: campos de classificação operacional
      await addColumnIfMissing('tipo_incidente VARCHAR(50) NULL');
      await addColumnIfMissing('impacto VARCHAR(50) NULL');
      await addColumnIfMissing('area VARCHAR(100) NULL');
      await addColumnIfMissing('tecnologia VARCHAR(50) NULL');
      await addColumnIfMissing('classificacao VARCHAR(150) NULL');
      await addColumnIfMissing('cnl VARCHAR(30) NULL');
      try {
        const [cols] = await dataPool.query("SHOW COLUMNS FROM massiva_history LIKE 'cnl'");
        hasClassificationColumns = Array.isArray(cols) && cols.length > 0;
      } catch {
        hasClassificationColumns = false;
      }

      // Migração idempotente: event_start_at (necessário para calcular MTTD)
      await addColumnIfMissing('event_start_at DATETIME NULL');
      try {
        const [cols] = await dataPool.query("SHOW COLUMNS FROM massiva_history LIKE 'event_start_at'");
        hasEventStartColumn = Array.isArray(cols) && cols.length > 0;
      } catch {
        hasEventStartColumn = false;
      }

      // Migração idempotente: protocolo de infraestrutura vinculado (opcional, 1 por evento)
      await addColumnIfMissing('infra_protocol BIGINT NULL');
      await addColumnIfMissing('infra_assignment_id BIGINT NULL');
      try {
        const [cols] = await dataPool.query("SHOW COLUMNS FROM massiva_history LIKE 'infra_protocol'");
        hasInfraProtocolColumns = Array.isArray(cols) && cols.length > 0;
      } catch {
        hasInfraProtocolColumns = false;
      }

      // Migração idempotente: quem identificou o evento (tecnico/zabbix/int6) — base de indicador futuro.
      await addColumnIfMissing('identified_by VARCHAR(20) NULL');
      try {
        const [cols] = await dataPool.query("SHOW COLUMNS FROM massiva_history LIKE 'identified_by'");
        hasIdentifiedByColumn = Array.isArray(cols) && cols.length > 0;
      } catch {
        hasIdentifiedByColumn = false;
      }

      // Migração idempotente: autor da última manutenção pós-encerramento na classificação
      // (edição feita DEPOIS do encerramento — nunca sobrescreve closed_by/closed_at/close_description).
      await addColumnIfMissing('classification_updated_by VARCHAR(255) NULL');
      await addColumnIfMissing('classification_updated_at DATETIME NULL');
      try {
        const [cols] = await dataPool.query("SHOW COLUMNS FROM massiva_history LIKE 'classification_updated_by'");
        hasClassificationAuditColumns = Array.isArray(cols) && cols.length > 0;
      } catch {
        hasClassificationAuditColumns = false;
      }

      // Migração idempotente: cache da última verificação "clientes ainda sem sinal"
      // (sob demanda — o botão "Verificar clientes" grava aqui; nada roda sozinho).
      await addColumnIfMissing('affected_verification_checked_at DATETIME NULL');
      await addColumnIfMissing('affected_verification_total INT NULL');
      await addColumnIfMissing('affected_verification_still_offline INT NULL');
      await addColumnIfMissing('affected_verification_still_degraded INT NULL');
      await addColumnIfMissing('affected_verification_by VARCHAR(255) NULL');
      try {
        const [cols] = await dataPool.query("SHOW COLUMNS FROM massiva_history LIKE 'affected_verification_checked_at'");
        hasAffectedVerificationColumns = Array.isArray(cols) && cols.length > 0;
      } catch {
        hasAffectedVerificationColumns = false;
      }

      // Migração idempotente: tabela de clientes afetados por massiva (log — 1 linha
      // por cliente por evento, gravada na abertura). Cópia nossa da mesma lista que
      // já mandamos ao gateway, para não depender do DELETE de limpeza dele.
      try {
        await dataPool.query(`
          CREATE TABLE IF NOT EXISTS massiva_affected_clients (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            massiva_history_id BIGINT NOT NULL,
            pppoe VARCHAR(255) NOT NULL,
            contract_id BIGINT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_massiva_affected_pppoe (pppoe),
            INDEX idx_massiva_affected_history (massiva_history_id)
          )
        `);
        hasAffectedClientsTable = true;
      } catch (createErr) {
        console.warn('[massiva-history] tabela massiva_affected_clients não pôde ser criada:', createErr?.message ?? createErr);
        hasAffectedClientsTable = false;
      }
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });

    return readyPromise;
  }

  async function findExistingHistoryId(protocol, assignmentId) {
    if (assignmentId !== null) {
      const [rows] = await dataPool.query(
        'SELECT id FROM massiva_history WHERE assignment_id = ? LIMIT 1',
        [assignmentId],
      );
      if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
    }

    if (protocol !== null) {
      const [rows] = await dataPool.query(
        'SELECT id FROM massiva_history WHERE protocol = ? LIMIT 1',
        [protocol],
      );
      if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
    }

    return null;
  }

  async function attachSplitters(historyId, splitterEntries) {
    for (const entry of splitterEntries) {
      await dataPool.query(
        `
          INSERT INTO massiva_history_splitters (
            massiva_history_id,
            splitter_code,
            splitter_label
          )
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE splitter_label = VALUES(splitter_label)
        `,
        [historyId, entry.code, entry.label],
      );
    }
  }

  async function registerOpenBatch(input) {
    await ensureReady();

    const splitterEntries = uniqueSplitterEntries(input?.splitterEntries);
    const results = Array.isArray(input?.results) ? input.results : [];
    const title = normalizeText(input?.title);
    const operatorEmail = normalizeText(input?.operatorEmail);
    const affectedClients = normalizeNonNegativeInt(input?.affectedClients, 0);
    const expectedCloseAt = normalizeMysqlNaiveDateInput(input?.expectedCloseAt);
    const eventIdentifiedAt = normalizeMysqlNaiveDateInput(input?.eventIdentifiedAt);
    const openedAt = normalizeMysqlNaiveDateInput(input?.openedAt) ?? new Date();
    const autoClosed = input?.autoClosedWithoutClients === true;
    const status = autoClosed ? 'encerrada' : 'aberta';
    const closeDescription =
      autoClosed
        ? normalizeNullableText(input?.closeDescription) ??
          'Encerrada automaticamente sem clientes mapeáveis.'
        : null;
    const closedAt = autoClosed ? normalizeDate(input?.closedAt) ?? new Date() : null;

    // Campos de classificação operacional (opcionais — presentes só se colunas existirem)
    const tipoIncidente = normalizeNullableText(input?.tipoIncidente);
    const impacto = normalizeNullableText(input?.impacto);
    const area = normalizeNullableText(input?.area);
    const tecnologia = normalizeNullableText(input?.tecnologia);
    const classificacao = normalizeNullableText(input?.classificacao);
    const cnl = normalizeNullableText(input?.cnl);

    // Início do evento — necessário para calcular MTTD (opcional, depende da migração).
    const eventStartAt = normalizeMysqlNaiveDateInput(input?.eventStartAt);

    // Protocolo de infraestrutura vinculado (1 por evento — mesmo valor em todas as linhas do lote).
    const infraProtocol = normalizePositiveInt(input?.infraProtocol);
    const infraAssignmentId = normalizePositiveInt(input?.infraAssignmentId);

    // Quem identificou o evento (tecnico/zabbix/int6) — mesmo valor em todas as linhas do lote.
    const identifiedBy = normalizeNullableText(input?.identifiedBy);

    let insertedOrUpdated = 0;

    for (const result of results) {
      const protocol = normalizePositiveInt(result?.protocol);
      const assignmentId = normalizePositiveInt(result?.assignmentId);
      const accessPointCode = normalizeText(result?.accessPointCode);
      const titleForResult = normalizeText(result?.title) || title;
      const affectedClientsForResult = normalizeNonNegativeInt(
        result?.affectedClients,
        affectedClients,
      );

      if (protocol === null && assignmentId === null) continue;

      const existingId = await findExistingHistoryId(protocol, assignmentId);

      if (existingId !== null) {
        // Colunas de classificação: adicionadas somente quando a migração já rodou.
        const classifSetClause = hasClassificationColumns
          ? `,
              tipo_incidente = COALESCE(?, tipo_incidente),
              impacto = COALESCE(?, impacto),
              area = COALESCE(?, area),
              tecnologia = COALESCE(?, tecnologia),
              classificacao = COALESCE(?, classificacao),
              cnl = COALESCE(?, cnl)`
          : '';
        const classifUpdateParams = hasClassificationColumns
          ? [tipoIncidente, impacto, area, tecnologia, classificacao, cnl]
          : [];

        // Início do evento: COALESCE para não sobrescrever dado existente.
        const eventStartSetClause = hasEventStartColumn
          ? ', event_start_at = COALESCE(?, event_start_at)'
          : '';
        const eventStartUpdateParam = hasEventStartColumn ? [eventStartAt] : [];

        // Protocolo de infra: COALESCE para não apagar um vínculo já gravado.
        const infraSetClause = hasInfraProtocolColumns
          ? `,
              infra_protocol = COALESCE(?, infra_protocol),
              infra_assignment_id = COALESCE(?, infra_assignment_id)`
          : '';
        const infraUpdateParams = hasInfraProtocolColumns ? [infraProtocol, infraAssignmentId] : [];

        // Quem identificou: COALESCE para não apagar um valor já gravado no lote.
        const identifiedBySetClause = hasIdentifiedByColumn
          ? ', identified_by = COALESCE(?, identified_by)'
          : '';
        const identifiedByUpdateParam = hasIdentifiedByColumn ? [identifiedBy] : [];

        await dataPool.query(
          `
            UPDATE massiva_history
            SET
              protocol = COALESCE(?, protocol),
              assignment_id = COALESCE(?, assignment_id),
              access_point_code = CASE WHEN ? <> '' THEN ? ELSE access_point_code END,
              title = CASE WHEN ? <> '' THEN ? ELSE title END,
              operator_email = CASE WHEN ? <> '' THEN ? ELSE operator_email END,
              affected_clients = GREATEST(affected_clients, ?),
              status = ?,
              opened_at = COALESCE(opened_at, ?),
              event_identified_at = COALESCE(?, event_identified_at),
              expected_close_at = COALESCE(?, expected_close_at),
              closed_at = ?,
              auto_closed_without_clients = ?,
              close_description = COALESCE(?, close_description),
              source = 'nexaview-local'${classifSetClause}${eventStartSetClause}${infraSetClause}${identifiedBySetClause}
            WHERE id = ?
          `,
          [
            protocol,
            assignmentId,
            accessPointCode,
            accessPointCode,
            titleForResult,
            titleForResult,
            operatorEmail,
            operatorEmail,
            affectedClientsForResult,
            status,
            openedAt,
            eventIdentifiedAt,
            expectedCloseAt,
            closedAt,
            autoClosed ? 1 : 0,
            closeDescription,
            ...classifUpdateParams,
            ...eventStartUpdateParam,
            ...infraUpdateParams,
            ...identifiedByUpdateParam,
            existingId,
          ],
        );
        await attachSplitters(existingId, splitterEntries);
      } else {
        // Colunas de classificação: incluídas no INSERT somente quando a migração já rodou.
        const classifInsertCols = hasClassificationColumns
          ? `,
              tipo_incidente,
              impacto,
              area,
              tecnologia,
              classificacao,
              cnl`
          : '';
        const classifInsertPlaceholders = hasClassificationColumns ? ', ?, ?, ?, ?, ?, ?' : '';
        const classifInsertValues = hasClassificationColumns
          ? [tipoIncidente, impacto, area, tecnologia, classificacao, cnl]
          : [];

        // Início do evento: incluído no INSERT somente quando a coluna existir.
        const eventStartInsertCol = hasEventStartColumn ? ', event_start_at' : '';
        const eventStartInsertPlaceholder = hasEventStartColumn ? ', ?' : '';
        const eventStartInsertValue = hasEventStartColumn ? [eventStartAt] : [];

        // Protocolo de infra: incluído no INSERT somente quando as colunas existirem.
        const infraInsertCols = hasInfraProtocolColumns ? ', infra_protocol, infra_assignment_id' : '';
        const infraInsertPlaceholders = hasInfraProtocolColumns ? ', ?, ?' : '';
        const infraInsertValues = hasInfraProtocolColumns ? [infraProtocol, infraAssignmentId] : [];

        // Quem identificou: incluído no INSERT somente quando a coluna existir.
        const identifiedByInsertCol = hasIdentifiedByColumn ? ', identified_by' : '';
        const identifiedByInsertPlaceholder = hasIdentifiedByColumn ? ', ?' : '';
        const identifiedByInsertValue = hasIdentifiedByColumn ? [identifiedBy] : [];

        const [insertResult] = await dataPool.query(
          `
            INSERT INTO massiva_history (
              protocol,
              assignment_id,
              access_point_code,
              title,
              operator_email,
              affected_clients,
              status,
              opened_at,
              event_identified_at,
              expected_close_at,
              closed_at,
              auto_closed_without_clients,
              close_description,
              source${classifInsertCols}${eventStartInsertCol}${infraInsertCols}${identifiedByInsertCol}
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nexaview-local'${classifInsertPlaceholders}${eventStartInsertPlaceholder}${infraInsertPlaceholders}${identifiedByInsertPlaceholder})
          `,
          [
            protocol,
            assignmentId,
            accessPointCode,
            titleForResult,
            operatorEmail,
            affectedClientsForResult,
            status,
            openedAt,
            eventIdentifiedAt,
            expectedCloseAt,
            closedAt,
            autoClosed ? 1 : 0,
            closeDescription,
            ...classifInsertValues,
            ...eventStartInsertValue,
            ...infraInsertValues,
            ...identifiedByInsertValue,
          ],
        );
        await attachSplitters(insertResult.insertId, splitterEntries);
      }

      insertedOrUpdated += 1;
    }

    return { configured: true, insertedOrUpdated };
  }

  async function registerClose(input) {
    await ensureReady();

    // Status alvo: 'encerrada' (padrão) ou 'cancelada'. Literal validado (não vem cru do usuário).
    const targetStatus = input?.targetStatus === 'cancelada' ? 'cancelada' : 'encerrada';

    const protocol = normalizePositiveInt(input?.protocol);
    const assignmentId = normalizePositiveInt(input?.assignmentId);
    const closeDescription = normalizeNullableText(input?.closeDescription);
    const closedBy = normalizeNullableText(input?.closedBy);
    const closedAt = normalizeDate(input?.closedAt) ?? new Date();

    // Classificação preenchida pelo operador no encerramento.
    const tipoIncidente = normalizeNullableText(input?.tipoIncidente);
    const impacto = normalizeNullableText(input?.impacto);
    const area = normalizeNullableText(input?.area);
    const tecnologia = normalizeNullableText(input?.tecnologia);
    const classificacao = normalizeNullableText(input?.classificacao);
    const cnl = normalizeNullableText(input?.cnl);

    const existingId = await findExistingHistoryId(protocol, assignmentId);
    if (existingId === null) {
      return { configured: true, updated: 0 };
    }

    const closedByClause = hasClosedByColumn ? ', closed_by = COALESCE(?, closed_by)' : '';
    const classifClause = hasClassificationColumns
      ? `,
          tipo_incidente = COALESCE(?, tipo_incidente),
          impacto = COALESCE(?, impacto),
          area = COALESCE(?, area),
          tecnologia = COALESCE(?, tecnologia),
          classificacao = COALESCE(?, classificacao),
          cnl = COALESCE(?, cnl)`
      : '';
    const closedByParams = hasClosedByColumn ? [closedBy] : [];
    const classifParams = hasClassificationColumns
      ? [tipoIncidente, impacto, area, tecnologia, classificacao, cnl]
      : [];
    const params = [closedAt, closeDescription, ...closedByParams, ...classifParams, existingId];
    const [result] = await dataPool.query(
      `
        UPDATE massiva_history
        SET
          status = '${targetStatus}',
          closed_at = ?,
          close_description = COALESCE(?, close_description)${closedByClause}${classifClause},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      params,
    );

    return {
      configured: true,
      updated: Number(result?.affectedRows ?? 0),
    };
  }

  /**
   * Cancelamento (incidentStatusId 8 na Voalle): mesma mecânica do encerramento, mas grava
   * `status = 'cancelada'`. Sem classificação de incidente (cancelamento é erro de abertura/duplicado).
   */
  async function registerCancel(input) {
    return registerClose({ ...input, targetStatus: 'cancelada' });
  }

  /**
   * Manutenção pós-encerramento: permite reclassificar (tipo/impacto/área/tecnologia/
   * classificação/CNL) uma massiva JÁ ENCERRADA, sem qualquer relação com a Voalle.
   *
   * Diferente de `registerClose`:
   *   - Só age sobre registros com `status = 'encerrada'` (rejeita abertos/cancelados —
   *     validação no servidor, não confia só na UI).
   *   - NUNCA toca em `closed_at`, `close_description` ou `closed_by` — o encerramento
   *     original permanece intacto.
   *   - Sobrescreve os campos de classificação (não usa COALESCE): o formulário de
   *     manutenção sempre reenvia os 6 valores atuais/editados, então limpar um campo
   *     para vazio deve realmente gravar `NULL`.
   *   - Guarda só o ÚLTIMO editor (`classification_updated_by`/`classification_updated_at`),
   *     sem histórico completo — decisão do time.
   */
  async function updateClassification(input) {
    await ensureReady();

    const protocol = normalizePositiveInt(input?.protocol);
    const assignmentId = normalizePositiveInt(input?.assignmentId);
    const updatedBy = normalizeNullableText(input?.updatedBy);
    const tipoIncidente = normalizeNullableText(input?.tipoIncidente);
    const impacto = normalizeNullableText(input?.impacto);
    const area = normalizeNullableText(input?.area);
    const tecnologia = normalizeNullableText(input?.tecnologia);
    const classificacao = normalizeNullableText(input?.classificacao);
    const cnl = normalizeNullableText(input?.cnl);

    const existingId = await findExistingHistoryId(protocol, assignmentId);
    if (existingId === null) {
      return { configured: true, updated: 0, reason: 'not-found' };
    }

    const [rows] = await dataPool.query(
      'SELECT status FROM massiva_history WHERE id = ? LIMIT 1',
      [existingId],
    );
    const currentStatus = normalizeMassivaHistoryStatus(rows?.[0]?.status);
    if (currentStatus !== 'encerrada') {
      return { configured: true, updated: 0, reason: 'not-closed' };
    }

    if (!hasClassificationColumns) {
      return { configured: true, updated: 0, reason: 'columns-missing' };
    }

    const auditClause = hasClassificationAuditColumns
      ? ', classification_updated_by = ?, classification_updated_at = CURRENT_TIMESTAMP'
      : '';
    const auditParams = hasClassificationAuditColumns ? [updatedBy] : [];

    const [result] = await dataPool.query(
      `
        UPDATE massiva_history
        SET
          tipo_incidente = ?,
          impacto = ?,
          area = ?,
          tecnologia = ?,
          classificacao = ?,
          cnl = ?${auditClause},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND status = 'encerrada'
      `,
      [tipoIncidente, impacto, area, tecnologia, classificacao, cnl, ...auditParams, existingId],
    );

    return {
      configured: true,
      updated: Number(result?.affectedRows ?? 0),
    };
  }

  /**
   * Grava a lista de clientes afetados (pppoe + contractId) de uma massiva — cópia nossa,
   * feita na abertura, da mesma lista que já mandamos ao gateway. Existe pra não depender
   * do DELETE de limpeza do gateway (que apaga a lista dele assim que a massiva fecha).
   * 1 linha por cliente por massiva — não é um contador; a recorrência/soma é sempre
   * uma consulta (COUNT/GROUP BY) sobre este log, nunca um valor mantido à mão.
   */
  async function registerAffectedClients(input) {
    await ensureReady();
    if (!hasAffectedClientsTable) {
      return { configured: true, inserted: 0, reason: 'table-missing' };
    }

    const protocol = normalizePositiveInt(input?.protocol);
    const assignmentId = normalizePositiveInt(input?.assignmentId);
    const clients = Array.isArray(input?.clients) ? input.clients : [];

    const existingId = await findExistingHistoryId(protocol, assignmentId);
    if (existingId === null || clients.length === 0) {
      return { configured: true, inserted: 0, reason: existingId === null ? 'not-found' : 'empty' };
    }

    const rows = clients
      .map((c) => ({
        pppoe: normalizeNullableText(c?.pppoe),
        contractId: normalizePositiveInt(c?.contractId),
      }))
      .filter((c) => c.pppoe !== null);
    if (rows.length === 0) {
      return { configured: true, inserted: 0, reason: 'empty' };
    }

    const placeholders = rows.map(() => '(?, ?, ?)').join(', ');
    const params = rows.flatMap((r) => [existingId, r.pppoe, r.contractId]);
    const [result] = await dataPool.query(
      `INSERT INTO massiva_affected_clients (massiva_history_id, pppoe, contract_id) VALUES ${placeholders}`,
      params,
    );

    return {
      configured: true,
      inserted: Number(result?.affectedRows ?? 0),
    };
  }

  /**
   * Lista de PPPoE únicos afetados por uma massiva (para a verificação de sinal).
   * Só funciona para massivas cuja lista foi gravada na abertura (registerAffectedClients) —
   * não há como recuperar retroativamente massivas anteriores a essa migração.
   */
  async function getAffectedClientsPppoeList(input) {
    await ensureReady();
    if (!hasAffectedClientsTable) {
      return { configured: true, massivaHistoryId: null, pppoeList: [] };
    }

    const protocol = normalizePositiveInt(input?.protocol);
    const assignmentId = normalizePositiveInt(input?.assignmentId);
    const existingId = await findExistingHistoryId(protocol, assignmentId);
    if (existingId === null) {
      return { configured: true, massivaHistoryId: null, pppoeList: [] };
    }

    const [rows] = await dataPool.query(
      'SELECT DISTINCT pppoe FROM massiva_affected_clients WHERE massiva_history_id = ?',
      [existingId],
    );
    return {
      configured: true,
      massivaHistoryId: existingId,
      pppoeList: (Array.isArray(rows) ? rows : []).map((r) => r.pppoe),
    };
  }

  /**
   * Grava o resultado da última verificação "clientes ainda sem sinal" — só a mais
   * recente (sem histórico completo), assim como a manutenção de classificação.
   * Chamado sob demanda, quando o atendente clica "Verificar clientes"; nada dispara isso
   * sozinho.
   */
  async function saveAffectedVerificationResult(input) {
    await ensureReady();
    if (!hasAffectedVerificationColumns) {
      return { configured: true, updated: 0, reason: 'columns-missing' };
    }

    const protocol = normalizePositiveInt(input?.protocol);
    const assignmentId = normalizePositiveInt(input?.assignmentId);
    const total = normalizeNonNegativeInt(input?.total, 0);
    const stillOffline = normalizeNonNegativeInt(input?.stillOffline, 0);
    const stillDegraded = normalizeNonNegativeInt(input?.stillDegraded, 0);
    const verifiedBy = normalizeNullableText(input?.verifiedBy);

    const existingId = await findExistingHistoryId(protocol, assignmentId);
    if (existingId === null) {
      return { configured: true, updated: 0, reason: 'not-found' };
    }

    const [result] = await dataPool.query(
      `
        UPDATE massiva_history
        SET
          affected_verification_checked_at = CURRENT_TIMESTAMP,
          affected_verification_total = ?,
          affected_verification_still_offline = ?,
          affected_verification_still_degraded = ?,
          affected_verification_by = ?
        WHERE id = ?
      `,
      [total, stillOffline, stillDegraded, verifiedBy, existingId],
    );

    return {
      configured: true,
      updated: Number(result?.affectedRows ?? 0),
    };
  }

  /**
   * Massivas encerradas com verificação já feita (sob demanda) e AINDA com clientes sem
   * sinal — fonte do painel de parede. Lê só resultados já persistidos; não roda
   * verificação nova, então não aparece nada até alguém clicar "Verificar clientes" em algo.
   */
  async function getRecentAffectedVerificationsWithProblems(input = {}) {
    await ensureReady();
    if (!hasAffectedVerificationColumns) return [];

    const limit = Math.min(100, Math.max(1, normalizePositiveInt(input?.limit) ?? 20));
    const [rows] = await dataPool.query(
      `
        SELECT
          protocol,
          assignment_id AS assignmentId,
          access_point_code AS accessPointCode,
          title,
          affected_verification_checked_at AS checkedAt,
          affected_verification_total AS total,
          affected_verification_still_offline AS stillOffline,
          affected_verification_still_degraded AS stillDegraded,
          affected_verification_by AS verifiedBy
        FROM massiva_history
        WHERE status = 'encerrada'
          AND affected_verification_checked_at IS NOT NULL
          AND (affected_verification_still_offline > 0 OR affected_verification_still_degraded > 0)
        ORDER BY affected_verification_checked_at DESC
        LIMIT ?
      `,
      [limit],
    );

    return (Array.isArray(rows) ? rows : []).map((row) => ({
      protocol: row.protocol == null ? null : Number(row.protocol),
      assignmentId: row.assignmentId == null ? null : Number(row.assignmentId),
      accessPointCode: normalizeText(row.accessPointCode),
      title: normalizeText(row.title),
      checkedAt: serializeHistoryDate(row.checkedAt),
      total: Number(row.total ?? 0),
      stillOffline: Number(row.stillOffline ?? 0),
      stillDegraded: Number(row.stillDegraded ?? 0),
      verifiedBy: normalizeNullableText(row.verifiedBy),
    }));
  }

  /**
   * Atualiza a previsão de encerramento (expected_close_at) de uma massiva já registrada.
   * Fonte de verdade da data exibida no painel para massivas abertas (o merge prioriza o
   * valor local sobre o Elleven), então a edição da previsão precisa gravar aqui.
   */
  async function updateExpectedClose(input) {
    await ensureReady();

    const protocol = normalizePositiveInt(input?.protocol);
    const assignmentId = normalizePositiveInt(input?.assignmentId);
    const expectedCloseAt = normalizeMysqlNaiveDateInput(input?.expectedCloseAt);

    if (expectedCloseAt === null) {
      return { configured: true, updated: 0 };
    }

    const existingId = await findExistingHistoryId(protocol, assignmentId);
    if (existingId === null) {
      return { configured: true, updated: 0 };
    }

    const [result] = await dataPool.query(
      `
        UPDATE massiva_history
        SET
          expected_close_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [expectedCloseAt, existingId],
    );

    return {
      configured: true,
      updated: Number(result?.affectedRows ?? 0),
    };
  }

  async function markClosedByProtocols(input) {
    await ensureReady();

    const protocols = (Array.isArray(input?.protocols) ? input.protocols : [])
      .map((value) => normalizePositiveInt(value))
      .filter((value) => value !== null);
    if (protocols.length === 0) {
      return { configured: true, updated: 0 };
    }

    const closeDescription = normalizeNullableText(input?.closeDescription);
    const closedAt = normalizeDate(input?.closedAt) ?? new Date();
    const placeholders = protocols.map(() => '?').join(', ');

    const [result] = await dataPool.query(
      `
        UPDATE massiva_history
        SET
          status = 'encerrada',
          closed_at = COALESCE(closed_at, ?),
          close_description = COALESCE(?, close_description),
          updated_at = CURRENT_TIMESTAMP
        WHERE protocol IN (${placeholders})
          AND status = 'aberta'
      `,
      [closedAt, closeDescription, ...protocols],
    );

    return {
      configured: true,
      updated: Number(result?.affectedRows ?? 0),
    };
  }

  /**
   * Estatísticas de massivas por splitter.
   * `totalTickets` = quantidade de ocorrências (massivas) distintas vinculadas ao splitter no período.
   * `affectedClientsTotal` fica em 0: o cadastro guarda afetados por ocorrência, não por equipamento —
   * use `getMassivaPeriodRollup` para o total de clientes (uma vez por massiva).
   * @param {{ openedAtFrom?: Date | null, openedAtTo?: Date | null }} [range] — filtro opcional por abertura da massiva.
   */
  async function getSplitterStats(splitterCodes, range) {
    await ensureReady();

    const normalizedCodes = [...new Set(
      (Array.isArray(splitterCodes) ? splitterCodes : [])
        .map((code) => normalizeText(code))
        .filter((code) => code !== ''),
    )];

    if (normalizedCodes.length === 0) return new Map();

    const placeholders = normalizedCodes.map(() => '?').join(', ');
    const openedAtFrom = range?.openedAtFrom instanceof Date && !Number.isNaN(range.openedAtFrom.getTime())
      ? range.openedAtFrom
      : null;
    const openedAtTo = range?.openedAtTo instanceof Date && !Number.isNaN(range.openedAtTo.getTime())
      ? range.openedAtTo
      : null;

    const whereExtra = [];
    const extraParams = [];
    if (openedAtFrom !== null) {
      whereExtra.push('h.opened_at >= ?');
      extraParams.push(openedAtFrom);
    }
    if (openedAtTo !== null) {
      whereExtra.push('h.opened_at <= ?');
      extraParams.push(openedAtTo);
    }
    const rangeSql = whereExtra.length > 0 ? ` AND ${whereExtra.join(' AND ')}` : '';

    const [rows] = await dataPool.query(
      `
        SELECT
          hs.splitter_code AS splitterCode,
          COUNT(DISTINCT h.id) AS totalTickets,
          SUM(CASE WHEN h.status = 'aberta' THEN 1 ELSE 0 END) AS openTickets,
          SUM(CASE WHEN h.status = 'encerrada' THEN 1 ELSE 0 END) AS closedTickets,
          0 AS affectedClientsTotal,
          MAX(h.opened_at) AS latestOpenedAt
        FROM massiva_history_splitters hs
        INNER JOIN massiva_history h
          ON h.id = hs.massiva_history_id
        WHERE hs.splitter_code IN (${placeholders})${rangeSql}
        GROUP BY hs.splitter_code
      `,
      [...normalizedCodes, ...extraParams],
    );

    const byCode = new Map();
    for (const row of rows) {
      byCode.set(String(row.splitterCode), {
        totalTickets: Number(row.totalTickets ?? 0),
        openTickets: Number(row.openTickets ?? 0),
        closedTickets: Number(row.closedTickets ?? 0),
        affectedClientsTotal: Math.round(Number(row.affectedClientsTotal ?? 0)),
        latestOpenedAt:
          row.latestOpenedAt instanceof Date
            ? row.latestOpenedAt.toISOString()
            : row.latestOpenedAt
              ? new Date(row.latestOpenedAt).toISOString()
              : null,
      });
    }

    return byCode;
  }

  function buildMassivaPeriodRollupRangeClause(range) {
    const openedAtFrom = range?.openedAtFrom instanceof Date && !Number.isNaN(range.openedAtFrom.getTime())
      ? range.openedAtFrom
      : null;
    const openedAtTo = range?.openedAtTo instanceof Date && !Number.isNaN(range.openedAtTo.getTime())
      ? range.openedAtTo
      : null;

    const whereExtra = [];
    const extraParams = [];
    if (openedAtFrom !== null) {
      whereExtra.push('h.opened_at >= ?');
      extraParams.push(openedAtFrom);
    }
    if (openedAtTo !== null) {
      whereExtra.push('h.opened_at <= ?');
      extraParams.push(openedAtTo);
    }
    const rangeSql = whereExtra.length > 0 ? ` AND ${whereExtra.join(' AND ')}` : '';
    return { rangeSql, extraParams };
  }

  function mapMassivaPeriodRollupRow(rows) {
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
    return {
      distinctMassivaCount: Number(row.distinctMassivaCount ?? 0),
      affectedClientsDistinctSum: Math.round(Number(row.affectedClientsDistinctSum ?? 0)),
      openMassivasCount: Number(row.openMassivasCount ?? 0),
      closedMassivasCount: Number(row.closedMassivasCount ?? 0),
    };
  }

  /**
   * Uma linha por massiva distinta ligada a splitter(s): soma `affected_clients` sem repetir por equipamento.
   * @param {string[]} splitterCodes
   * @param {{ openedAtFrom?: Date | null, openedAtTo?: Date | null }} [range]
   * @param {{ scope?: 'by_codes' | 'all_linked' }} [options]
   */
  async function getMassivaPeriodRollup(splitterCodes, range, options = {}) {
    await ensureReady();

    const scope = options?.scope === 'all_linked' ? 'all_linked' : 'by_codes';
    const { rangeSql, extraParams } = buildMassivaPeriodRollupRangeClause(range);

    if (scope === 'all_linked') {
      const [rows] = await dataPool.query(
        `
          SELECT
            COUNT(*) AS distinctMassivaCount,
            COALESCE(SUM(h.affected_clients), 0) AS affectedClientsDistinctSum,
            SUM(CASE WHEN h.status = 'aberta' THEN 1 ELSE 0 END) AS openMassivasCount,
            SUM(CASE WHEN h.status = 'encerrada' THEN 1 ELSE 0 END) AS closedMassivasCount
          FROM massiva_history h
          INNER JOIN (
            SELECT DISTINCT massiva_history_id
            FROM massiva_history_splitters
          ) hs ON hs.massiva_history_id = h.id
          WHERE 1 = 1${rangeSql}
        `,
        extraParams,
      );
      return mapMassivaPeriodRollupRow(rows);
    }

    const normalizedCodes = [...new Set(
      (Array.isArray(splitterCodes) ? splitterCodes : [])
        .map((code) => normalizeText(code))
        .filter((code) => code !== ''),
    )];

    if (normalizedCodes.length === 0) {
      return {
        distinctMassivaCount: 0,
        affectedClientsDistinctSum: 0,
        openMassivasCount: 0,
        closedMassivasCount: 0,
      };
    }

    const placeholders = normalizedCodes.map(() => '?').join(', ');

    const [rows] = await dataPool.query(
      `
        SELECT
          COUNT(*) AS distinctMassivaCount,
          COALESCE(SUM(h.affected_clients), 0) AS affectedClientsDistinctSum,
          SUM(CASE WHEN h.status = 'aberta' THEN 1 ELSE 0 END) AS openMassivasCount,
          SUM(CASE WHEN h.status = 'encerrada' THEN 1 ELSE 0 END) AS closedMassivasCount
        FROM massiva_history h
        INNER JOIN (
          SELECT DISTINCT massiva_history_id
          FROM massiva_history_splitters
          WHERE splitter_code IN (${placeholders})
        ) hs ON hs.massiva_history_id = h.id
        WHERE 1 = 1${rangeSql}
      `,
      [...normalizedCodes, ...extraParams],
    );

    return mapMassivaPeriodRollupRow(rows);
  }

  /**
   * Massivas do período com códigos de splitter vinculados (para agregar por faixa etária sem IN gigante).
   * @param {{ openedAtFrom?: Date | null, openedAtTo?: Date | null }} [range]
   */
  async function getMassivaSplitterLinksInPeriod(range) {
    await ensureReady();

    const { rangeSql, extraParams } = buildMassivaPeriodRollupRangeClause(range);

    const [rows] = await dataPool.query(
      `
        SELECT
          h.id AS massivaHistoryId,
          hs.splitter_code AS splitterCode
        FROM massiva_history h
        INNER JOIN massiva_history_splitters hs
          ON hs.massiva_history_id = h.id
        WHERE 1 = 1${rangeSql}
        ORDER BY h.id ASC, hs.splitter_code ASC
      `,
      extraParams,
    );

    const byMassiva = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const massivaHistoryId = Number(row.massivaHistoryId);
      if (!Number.isFinite(massivaHistoryId) || massivaHistoryId <= 0) continue;
      const splitterCode = normalizeText(row.splitterCode);
      if (splitterCode === '') continue;
      const current = byMassiva.get(massivaHistoryId) ?? [];
      if (!current.includes(splitterCode)) current.push(splitterCode);
      byMassiva.set(massivaHistoryId, current);
    }

    return [...byMassiva.entries()].map(([massivaHistoryId, splitterCodes]) => ({
      massivaHistoryId,
      splitterCodes,
    }));
  }

  /**
   * Eventos de massiva com o título/código do splitter e a data de abertura, para correlação
   * churn × massiva (uma linha por par massiva↔splitter). `access_point_code` da massiva incluído.
   * @param {{ openedAtFrom?: Date | null, openedAtTo?: Date | null }} [range]
   */
  async function getMassivaEventsWithSplitterInPeriod(range) {
    await ensureReady();

    const { rangeSql, extraParams } = buildMassivaPeriodRollupRangeClause(range);

    // Em massiva_history_splitters as colunas são splitter_code e splitter_label
    // (gravadas por attachSplitters); não há splitter_title aqui. O label é o título do splitter.
    const [rows] = await dataPool.query(
      `
        SELECT
          h.opened_at         AS openedAt,
          h.access_point_code AS accessPointCode,
          hs.splitter_code    AS splitterCode,
          hs.splitter_label   AS splitterTitle
        FROM massiva_history h
        INNER JOIN massiva_history_splitters hs
          ON hs.massiva_history_id = h.id
        WHERE h.opened_at IS NOT NULL${rangeSql}
        ORDER BY h.opened_at ASC
      `,
      extraParams,
    );

    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        openedAt: serializeHistoryDate(row.openedAt),
        accessPointCode: normalizeText(row.accessPointCode),
        splitterCode: normalizeText(row.splitterCode),
        splitterTitle: normalizeText(row.splitterTitle),
      }))
      .filter((row) => row.openedAt != null && (row.splitterTitle !== '' || row.splitterCode !== ''));
  }

  /**
   * Massivas distintas por dia da semana × turno (hora de abertura no fuso do servidor Node).
   * @param {{ openedAtFrom?: Date | null, openedAtTo?: Date | null }} [range]
   */
  async function getMassivaRecurrenceByDayShift(range) {
    await ensureReady();

    const { rangeSql, extraParams } = buildMassivaPeriodRollupRangeClause(range);
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

    const [rows] = await dataPool.query(
      `
        SELECT h.opened_at AS openedAt
        FROM massiva_history h
        WHERE h.opened_at IS NOT NULL${rangeSql}
      `,
      extraParams,
    );

    const counts = new Map();
    for (const weekday of weekdays) {
      for (const shift of ['Madrugada', 'Manha', 'Tarde', 'Noite']) {
        counts.set(`${weekday}-${shift}`, 0);
      }
    }

    for (const row of Array.isArray(rows) ? rows : []) {
      const openedAt = normalizeDate(row.openedAt);
      if (!openedAt) continue;
      const weekday = weekdays[openedAt.getDay()] ?? 'Dom';
      const hour = openedAt.getHours();
      const shift =
        hour < 6 ? 'Madrugada' : hour < 12 ? 'Manha' : hour < 18 ? 'Tarde' : 'Noite';
      const key = `${weekday}-${shift}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const out = [];
    for (const weekday of weekdays) {
      for (const shift of ['Madrugada', 'Manha', 'Tarde', 'Noite']) {
        out.push({
          weekday,
          shift,
          count: counts.get(`${weekday}-${shift}`) ?? 0,
        });
      }
    }
    return out;
  }

  async function getOpenSplitterCodes() {
    await ensureReady();

    const [rows] = await dataPool.query(
      `
        SELECT DISTINCT hs.splitter_code AS splitterCode
        FROM massiva_history_splitters hs
        INNER JOIN massiva_history h
          ON h.id = hs.massiva_history_id
        WHERE h.status = 'aberta'
        ORDER BY hs.splitter_code ASC
      `,
    );

    return rows
      .map((row) => String(row.splitterCode ?? '').trim())
      .filter((code) => code !== '');
  }

  /** Splitters vinculados no NexaView aos protocolos informados (abertura local). */
  async function getSplitterCodesForProtocols(protocols) {
    await ensureReady();

    const normalizedProtocols = (Array.isArray(protocols) ? protocols : [])
      .map((value) => Number.parseInt(String(value ?? ''), 10))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (normalizedProtocols.length === 0) return [];

    const placeholders = normalizedProtocols.map(() => '?').join(', ');
    const [rows] = await dataPool.query(
      `
        SELECT DISTINCT hs.splitter_code AS splitterCode
        FROM massiva_history_splitters hs
        INNER JOIN massiva_history h
          ON h.id = hs.massiva_history_id
        WHERE h.protocol IN (${placeholders})
        ORDER BY hs.splitter_code ASC
      `,
      normalizedProtocols,
    );

    return rows
      .map((row) => String(row.splitterCode ?? '').trim())
      .filter((code) => code !== '');
  }

  async function upsertSplitterSnapshots(snapshots) {
    await ensureReady();

    const clean = (Array.isArray(snapshots) ? snapshots : [])
      .map((snapshot) => {
        const splitterCode = normalizeText(snapshot?.splitterCode);
        if (splitterCode === '') return null;

        const capturedAt = normalizeDate(snapshot?.capturedAt) ?? new Date();
        const capturedDay = capturedAt.toISOString().slice(0, 10);
        const outPorts = normalizeNonNegativeInt(snapshot?.outPorts, 0);
        const busyCount = normalizeNonNegativeInt(snapshot?.busyCount, 0);
        const usagePercentRaw =
          snapshot?.usagePercent ??
          (outPorts > 0 ? (busyCount / outPorts) * 100 : 0);
        const usagePercent = Number(
          Math.max(0, Math.min(1000, Number(usagePercentRaw ?? 0))).toFixed(2),
        );

        return {
          splitterCode,
          splitterTitle: normalizeText(snapshot?.splitterTitle),
          accessPointCode: normalizeText(snapshot?.accessPointCode),
          capturedDay,
          capturedAt,
          active: snapshot?.active === true ? 1 : 0,
          outPorts,
          busyCount,
          usagePercent,
          city: normalizeNullableText(snapshot?.city),
          street: normalizeNullableText(snapshot?.street),
          tipoLocal: normalizeNullableText(snapshot?.tipoLocal),
          nomeCondominio: normalizeNullableText(snapshot?.nomeCondominio),
          massivaOpenCount: normalizeNonNegativeInt(snapshot?.massivaOpenCount, 0),
          massivaTotalCount: normalizeNonNegativeInt(snapshot?.massivaTotalCount, 0),
        };
      })
      .filter(Boolean);

    if (clean.length === 0) {
      return { configured: true, insertedOrUpdated: 0, skippedUnchanged: 0 };
    }

    const placeholders = clean.map(() => '?').join(', ');
    const [latestRows] = await dataPool.query(
      `
        SELECT
          s.splitter_code AS splitterCode,
          s.active AS active,
          s.out_ports AS outPorts,
          s.busy_count AS busyCount,
          s.usage_percent AS usagePercent,
          s.access_point_code AS accessPointCode,
          s.city AS city,
          s.street AS street,
          s.tipo_local AS tipoLocal,
          s.nome_condominio AS nomeCondominio,
          s.massiva_open_count AS massivaOpenCount,
          s.massiva_total_count AS massivaTotalCount
        FROM splitter_snapshots s
        INNER JOIN (
          SELECT splitter_code, MAX(captured_at) AS maxCapturedAt
          FROM splitter_snapshots
          WHERE splitter_code IN (${placeholders})
          GROUP BY splitter_code
        ) latest
          ON latest.splitter_code = s.splitter_code
         AND latest.maxCapturedAt = s.captured_at
      `,
      clean.map((row) => row.splitterCode),
    );

    const latestByCode = new Map();
    for (const latestRow of latestRows) {
      latestByCode.set(String(latestRow.splitterCode), {
        active: Number(latestRow.active ?? 0),
        outPorts: Number(latestRow.outPorts ?? 0),
        busyCount: Number(latestRow.busyCount ?? 0),
        usagePercent: Number(latestRow.usagePercent ?? 0),
        accessPointCode: normalizeText(latestRow.accessPointCode),
        city: normalizeNullableText(latestRow.city),
        street: normalizeNullableText(latestRow.street),
        tipoLocal: normalizeNullableText(latestRow.tipoLocal),
        nomeCondominio: normalizeNullableText(latestRow.nomeCondominio),
        massivaOpenCount: Number(latestRow.massivaOpenCount ?? 0),
        massivaTotalCount: Number(latestRow.massivaTotalCount ?? 0),
      });
    }

    let insertedOrUpdated = 0;
    let skippedUnchanged = 0;

    for (const row of clean) {
      const previous = latestByCode.get(row.splitterCode);
      const unchanged =
        previous != null &&
        previous.active === row.active &&
        previous.outPorts === row.outPorts &&
        previous.busyCount === row.busyCount &&
        Number(previous.usagePercent.toFixed(2)) === Number(row.usagePercent.toFixed(2)) &&
        previous.accessPointCode === row.accessPointCode &&
        previous.city === row.city &&
        previous.street === row.street &&
        previous.tipoLocal === row.tipoLocal &&
        previous.nomeCondominio === row.nomeCondominio &&
        previous.massivaOpenCount === row.massivaOpenCount &&
        previous.massivaTotalCount === row.massivaTotalCount;

      if (unchanged) {
        skippedUnchanged += 1;
        continue;
      }

      await dataPool.query(
        `
          INSERT INTO splitter_snapshots (
            splitter_code,
            splitter_title,
            access_point_code,
            captured_day,
            captured_at,
            active,
            out_ports,
            busy_count,
            usage_percent,
            city,
            street,
            tipo_local,
            nome_condominio,
            massiva_open_count,
            massiva_total_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            splitter_title = VALUES(splitter_title),
            access_point_code = VALUES(access_point_code),
            captured_at = VALUES(captured_at),
            active = VALUES(active),
            out_ports = VALUES(out_ports),
            busy_count = VALUES(busy_count),
            usage_percent = VALUES(usage_percent),
            city = VALUES(city),
            street = VALUES(street),
            tipo_local = VALUES(tipo_local),
            nome_condominio = VALUES(nome_condominio),
            massiva_open_count = VALUES(massiva_open_count),
            massiva_total_count = VALUES(massiva_total_count)
        `,
        [
          row.splitterCode,
          row.splitterTitle,
          row.accessPointCode,
          row.capturedDay,
          row.capturedAt,
          row.active,
          row.outPorts,
          row.busyCount,
          row.usagePercent,
          row.city,
          row.street,
          row.tipoLocal,
          row.nomeCondominio,
          row.massivaOpenCount,
          row.massivaTotalCount,
        ],
      );
      insertedOrUpdated += 1;
    }

    return { configured: true, insertedOrUpdated, skippedUnchanged };
  }

  function buildTrendLabel(currentUsagePercent, delta7d, delta30d) {
    if (currentUsagePercent >= 85 && delta30d >= 5) return 'Quase saturando';
    if (delta30d >= 5 || delta7d >= 3) return 'Em crescimento';
    if (delta30d <= -5 || delta7d <= -3) return 'Em queda';
    return 'Estavel';
  }

  async function getSplitterTrends(splitterCodes) {
    await ensureReady();

    const normalizedCodes = [...new Set(
      (Array.isArray(splitterCodes) ? splitterCodes : [])
        .map((code) => normalizeText(code))
        .filter((code) => code !== ''),
    )];

    if (normalizedCodes.length === 0) return new Map();

    const placeholders = normalizedCodes.map(() => '?').join(', ');
    const [rows] = await dataPool.query(
      `
        SELECT
          splitter_code AS splitterCode,
          captured_day AS capturedDay,
          captured_at AS capturedAt,
          busy_count AS busyCount,
          out_ports AS outPorts,
          usage_percent AS usagePercent
        FROM splitter_snapshots
        WHERE splitter_code IN (${placeholders})
        ORDER BY splitter_code ASC, captured_at DESC
      `,
      normalizedCodes,
    );

    const grouped = new Map();
    for (const row of rows) {
      const code = String(row.splitterCode ?? '').trim();
      if (code === '') continue;
      if (!grouped.has(code)) grouped.set(code, []);
      grouped.get(code).push({
        capturedAt: row.capturedAt instanceof Date ? row.capturedAt : new Date(row.capturedAt),
        busyCount: Number(row.busyCount ?? 0),
        outPorts: Number(row.outPorts ?? 0),
        usagePercent: Number(row.usagePercent ?? 0),
      });
    }

    const now = new Date();
    const cutoff7d = new Date(now);
    cutoff7d.setDate(cutoff7d.getDate() - 7);
    const cutoff30d = new Date(now);
    cutoff30d.setDate(cutoff30d.getDate() - 30);

    const trends = new Map();
    for (const code of normalizedCodes) {
      const snapshots = grouped.get(code) ?? [];
      const current = snapshots[0] ?? null;
      const baseline7d =
        snapshots.find((snapshot) => snapshot.capturedAt <= cutoff7d) ??
        snapshots[snapshots.length - 1] ??
        null;
      const baseline30d =
        snapshots.find((snapshot) => snapshot.capturedAt <= cutoff30d) ??
        snapshots[snapshots.length - 1] ??
        null;

      const currentUsagePercent = current?.usagePercent ?? 0;
      const delta7d = current && baseline7d
        ? Number((currentUsagePercent - baseline7d.usagePercent).toFixed(2))
        : 0;
      const delta30d = current && baseline30d
        ? Number((currentUsagePercent - baseline30d.usagePercent).toFixed(2))
        : 0;

      trends.set(code, {
        label: buildTrendLabel(currentUsagePercent, delta7d, delta30d),
        currentUsagePercent,
        delta7d,
        delta30d,
        capturedAt: current?.capturedAt ? current.capturedAt.toISOString() : null,
      });
    }

    return trends;
  }


  async function getRecentSplitterSnapshots(splitterCode, limit = 6) {
    await ensureReady();

    const normalizedCode = normalizeText(splitterCode);
    if (normalizedCode === '') return [];

    const cappedLimit = Math.min(24, Math.max(1, normalizePositiveInt(limit) ?? 6));
    const [rows] = await dataPool.query(
      `
        SELECT
          splitter_code AS splitterCode,
          splitter_title AS splitterTitle,
          access_point_code AS accessPointCode,
          captured_day AS capturedDay,
          captured_at AS capturedAt,
          active AS active,
          out_ports AS outPorts,
          busy_count AS busyCount,
          usage_percent AS usagePercent,
          massiva_open_count AS massivaOpenCount,
          massiva_total_count AS massivaTotalCount
        FROM splitter_snapshots
        WHERE splitter_code = ?
        ORDER BY captured_at DESC
        LIMIT ?
      `,
      [normalizedCode, cappedLimit],
    );

    return rows.map((row) => ({
      splitterCode: normalizeText(row.splitterCode),
      splitterTitle: normalizeText(row.splitterTitle),
      accessPointCode: normalizeText(row.accessPointCode),
      capturedDay: normalizeText(row.capturedDay),
      capturedAt:
        row.capturedAt instanceof Date
          ? row.capturedAt.toISOString()
          : normalizeDate(row.capturedAt)?.toISOString() ?? null,
      active: Number(row.active ?? 0) === 1,
      outPorts: Number(row.outPorts ?? 0),
      busyCount: Number(row.busyCount ?? 0),
      usagePercent: Number(row.usagePercent ?? 0),
      massivaOpenCount: Number(row.massivaOpenCount ?? 0),
      massivaTotalCount: Number(row.massivaTotalCount ?? 0),
    }));
  }

  async function getRecentHistoryBySplitter(splitterCode, limit = 5) {
    await ensureReady();

    const normalizedCode = normalizeText(splitterCode);
    if (normalizedCode === '') return [];

    const cappedLimit = Math.min(20, Math.max(1, normalizePositiveInt(limit) ?? 5));
    const [rows] = await dataPool.query(
      `
        SELECT
          h.id AS id,
          h.protocol AS protocol,
          h.assignment_id AS assignmentId,
          h.access_point_code AS accessPointCode,
          h.title AS title,
          h.affected_clients AS affectedClients,
          h.status AS status,
          h.opened_at AS openedAt,
          h.closed_at AS closedAt
        FROM massiva_history h
        INNER JOIN massiva_history_splitters hs
          ON hs.massiva_history_id = h.id
        WHERE hs.splitter_code = ?
        ORDER BY h.opened_at DESC, h.id DESC
        LIMIT ?
      `,
      [normalizedCode, cappedLimit],
    );

    return rows.map((row) => ({
      id: Number(row.id ?? 0),
      protocol: row.protocol == null ? null : Number(row.protocol),
      assignmentId: row.assignmentId == null ? null : Number(row.assignmentId),
      accessPointCode: normalizeText(row.accessPointCode),
      title: normalizeText(row.title),
      affectedClients: Number(row.affectedClients ?? 0),
      status: normalizeMassivaHistoryStatus(row.status),
      openedAt:
        row.openedAt instanceof Date
          ? row.openedAt.toISOString()
          : normalizeDate(row.openedAt)?.toISOString() ?? null,
      closedAt:
        row.closedAt instanceof Date
          ? row.closedAt.toISOString()
          : normalizeDate(row.closedAt)?.toISOString() ?? null,
    }));
  }
  /** Agregado de massivas abertas (mesma fonte do snapshot diário do dashboard). */
  async function getOpenMassivaDashboardKpis() {
    await ensureReady();
    const [rows] = await dataPool.query(
      `SELECT COUNT(*) AS open_count, COALESCE(SUM(affected_clients), 0) AS affected_sum
       FROM massiva_history
       WHERE status = 'aberta'`,
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    return {
      openMassivas: row ? Number(row.open_count ?? 0) : 0,
      affectedClientsOpen: row ? Number(row.affected_sum ?? 0) : 0,
    };
  }

  async function replaceNetworkReliefSnapshot(input = {}) {
    await ensureReady();

    const straightRadiusMeters = normalizeNonNegativeInt(input?.straightRadiusMeters, 200);
    const maxRouteMeters = normalizeNonNegativeInt(input?.maxRouteMeters, 200);
    const scannedCount = normalizeNonNegativeInt(input?.scannedCount, 0);
    const cleanEntries = (Array.isArray(input?.entries) ? input.entries : [])
      .map((entry, index) => {
        const splitterCode = normalizeText(entry?.splitter?.code);
        if (splitterCode === '') return null;

        return {
          position: index + 1,
          splitterCode,
          splitterTitle: normalizeText(entry?.splitter?.title) || splitterCode,
          outPorts: normalizeNonNegativeInt(entry?.splitter?.outPorts, 0),
          busyCount: normalizeNonNegativeInt(entry?.splitter?.busyCount, 0),
          straightNeighborsSampled: normalizeNonNegativeInt(entry?.straightNeighborsSampled, 0),
          neighborStraightRadiusScanned: normalizeNonNegativeInt(
            entry?.neighborStraightRadiusScanned,
            straightRadiusMeters,
          ),
          maxRouteMeters: normalizeNonNegativeInt(entry?.maxRouteMeters, maxRouteMeters),
          ruleType:
            normalizeText(entry?.ruleType).toUpperCase() === 'CONDOMINIUM'
              ? 'CONDOMINIUM'
              : 'STREET',
        };
      })
      .filter(Boolean);

    const connection = await dataPool.getConnection();
    try {
      await connection.beginTransaction();

      const [runResult] = await connection.query(
        `
          INSERT INTO splitter_network_relief_snapshot_runs (
            status,
            straight_radius_meters,
            max_route_meters,
            scanned_count,
            entry_count,
            started_at,
            finished_at,
            error_message
          )
          VALUES ('running', ?, ?, 0, 0, NOW(), NULL, NULL)
        `,
        [straightRadiusMeters, maxRouteMeters],
      );

      const snapshotRunId = Number(runResult?.insertId ?? 0);

      if (cleanEntries.length > 0) {
        const values = cleanEntries.map((entry) => [
          snapshotRunId,
          entry.position,
          entry.splitterCode,
          entry.splitterTitle,
          entry.outPorts,
          entry.busyCount,
          entry.straightNeighborsSampled,
          entry.neighborStraightRadiusScanned,
          entry.maxRouteMeters,
          entry.ruleType,
        ]);

        await connection.query(
          `
            INSERT INTO splitter_network_relief_snapshot_entries (
              snapshot_run_id,
              position,
              splitter_code,
              splitter_title,
              out_ports,
              busy_count,
              straight_neighbors_sampled,
              neighbor_straight_radius_scanned,
              max_route_meters,
              rule_type
            )
            VALUES ?
          `,
          [values],
        );
      }

      await connection.query(
        `
          UPDATE splitter_network_relief_snapshot_runs
          SET
            status = 'completed',
            scanned_count = ?,
            entry_count = ?,
            finished_at = NOW(),
            error_message = NULL
          WHERE id = ?
        `,
        [scannedCount, cleanEntries.length, snapshotRunId],
      );

      await connection.query(
        `
          DELETE old_runs
          FROM splitter_network_relief_snapshot_runs old_runs
          INNER JOIN splitter_network_relief_snapshot_runs completed
            ON completed.id = old_runs.id
          LEFT JOIN (
            SELECT id
            FROM (
              SELECT id
              FROM splitter_network_relief_snapshot_runs
              WHERE status = 'completed'
                AND straight_radius_meters = ?
                AND max_route_meters = ?
              ORDER BY finished_at DESC, id DESC
              LIMIT 12
            ) keep_rows
          ) keep
            ON keep.id = old_runs.id
          WHERE completed.status = 'completed'
            AND completed.straight_radius_meters = ?
            AND completed.max_route_meters = ?
            AND keep.id IS NULL
        `,
        [straightRadiusMeters, maxRouteMeters, straightRadiusMeters, maxRouteMeters],
      );

      await connection.commit();
      return {
        configured: true,
        snapshotRunId,
        entryCount: cleanEntries.length,
        scannedCount,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function hasCompletedNetworkReliefSnapshot(straightRadiusMeters, maxRouteMeters) {
    await ensureReady();

    const straight = normalizeNonNegativeInt(straightRadiusMeters, 200);
    const maxRoute = normalizeNonNegativeInt(maxRouteMeters, 200);

    const [rows] = await dataPool.query(
      `
        SELECT 1 AS ok
        FROM splitter_network_relief_snapshot_runs
        WHERE status = 'completed'
          AND straight_radius_meters = ?
          AND max_route_meters = ?
        LIMIT 1
      `,
      [straight, maxRoute],
    );

    return Array.isArray(rows) && rows.length > 0;
  }

  async function getLatestNetworkReliefSnapshotPage(input = {}) {
    await ensureReady();

    const straightRadiusMeters = normalizeNonNegativeInt(input?.straightRadiusMeters, 200);
    const maxRouteMeters = normalizeNonNegativeInt(input?.maxRouteMeters, 200);
    const limit = Math.min(200, Math.max(1, normalizeNonNegativeInt(input?.limit, 20)));
    const cursor = Math.max(0, normalizeNonNegativeInt(input?.cursor, 0));

    const ponSlotFilter = optionalPonQueryInt(input?.oltSlot);
    const ponPortFilter = optionalPonQueryInt(input?.oltPort);
    const usePonFilter = ponSlotFilter !== null || ponPortFilter !== null;

    const [runRows] = await dataPool.query(
      `
        SELECT
          id,
          straight_radius_meters AS straightRadiusMeters,
          max_route_meters AS maxRouteMeters,
          scanned_count AS scannedCount,
          entry_count AS entryCount,
          finished_at AS finishedAt
        FROM splitter_network_relief_snapshot_runs
        WHERE status = 'completed'
          AND straight_radius_meters = ?
          AND max_route_meters = ?
        ORDER BY finished_at DESC, id DESC
        LIMIT 1
      `,
      [straightRadiusMeters, maxRouteMeters],
    );

    const run = Array.isArray(runRows) && runRows.length > 0 ? runRows[0] : null;
    if (!run) return null;

    const snapshotRunId = Number(run.id ?? 0);
    const totalEntries = Number(run.entryCount ?? 0);

    const generatedAtIso =
      run.finishedAt instanceof Date
        ? run.finishedAt.toISOString()
        : normalizeDate(run.finishedAt)?.toISOString() ?? null;

    const scannedCount = Number(run.scannedCount ?? 0);

    /** @param {Record<string, unknown>} row */
    function mapNetworkReliefEntryRow(row) {
      return {
        splitter: {
          code: normalizeText(row.splitterCode),
          title: normalizeText(row.splitterTitle),
          outPorts: Number(row.outPorts ?? 0),
          busyCount: Number(row.busyCount ?? 0),
        },
        neighborStraightRadiusScanned: Number(
          row.neighborStraightRadiusScanned ?? straightRadiusMeters,
        ),
        maxRouteMeters: Number(row.maxRouteMeters ?? maxRouteMeters),
        straightNeighborsSampled: Number(row.straightNeighborsSampled ?? 0),
        ruleType:
          normalizeText(row.ruleType).toUpperCase() === 'CONDOMINIUM'
            ? 'CONDOMINIUM'
            : 'STREET',
      };
    }

    if (!usePonFilter) {
      const [entryRows] = await dataPool.query(
        `
        SELECT
          splitter_code AS splitterCode,
          splitter_title AS splitterTitle,
          out_ports AS outPorts,
          busy_count AS busyCount,
          straight_neighbors_sampled AS straightNeighborsSampled,
          neighbor_straight_radius_scanned AS neighborStraightRadiusScanned,
          max_route_meters AS maxRouteMeters,
          rule_type AS ruleType
        FROM splitter_network_relief_snapshot_entries
        WHERE snapshot_run_id = ?
        ORDER BY position ASC
        LIMIT ?
        OFFSET ?
      `,
        [snapshotRunId, limit, cursor],
      );

      return {
        snapshotRunId,
        generatedAt: generatedAtIso,
        scannedCount,
        totalEntries,
        entries: Array.isArray(entryRows) ? entryRows.map((row) => mapNetworkReliefEntryRow(row)) : [],
        ponFilterActive: false,
        ponFilterResumePosition: null,
        ponFilterHasMore: false,
      };
    }

    let lastScanned = cursor;
    const collected = [];
    const chunk = Math.min(150, Math.max(limit * 5, 50));

    while (collected.length < limit) {
      const [entryRows] = await dataPool.query(
        `
        SELECT
          position,
          splitter_code AS splitterCode,
          splitter_title AS splitterTitle,
          out_ports AS outPorts,
          busy_count AS busyCount,
          straight_neighbors_sampled AS straightNeighborsSampled,
          neighbor_straight_radius_scanned AS neighborStraightRadiusScanned,
          max_route_meters AS maxRouteMeters,
          rule_type AS ruleType
        FROM splitter_network_relief_snapshot_entries
        WHERE snapshot_run_id = ?
          AND position > ?
        ORDER BY position ASC
        LIMIT ?
      `,
        [snapshotRunId, lastScanned, chunk],
      );

      const rows = Array.isArray(entryRows) ? entryRows : [];

      if (rows.length === 0) {
        return {
          snapshotRunId,
          generatedAt: generatedAtIso,
          scannedCount,
          totalEntries,
          entries: collected,
          ponFilterActive: true,
          ponFilterResumePosition: lastScanned,
          ponFilterHasMore: false,
        };
      }

      for (const row of rows) {
        const pos = Number(row.position ?? 0);
        lastScanned = pos;

        if (
          splitterLabelsMatchOptionalPonFilter(
            row.splitterTitle,
            row.splitterCode,
            ponSlotFilter,
            ponPortFilter,
          )
        ) {
          collected.push(mapNetworkReliefEntryRow(row));
          if (collected.length >= limit) {
            break;
          }
        }
      }

      if (collected.length >= limit) {
        const [moreProbe] = await dataPool.query(
          `
          SELECT 1 AS ok
          FROM splitter_network_relief_snapshot_entries
          WHERE snapshot_run_id = ?
            AND position > ?
          LIMIT 1
        `,
          [snapshotRunId, lastScanned],
        );
        const moreRows = Array.isArray(moreProbe) ? moreProbe : [];
        const hasMore = moreRows.length > 0;
        return {
          snapshotRunId,
          generatedAt: generatedAtIso,
          scannedCount,
          totalEntries,
          entries: collected,
          ponFilterActive: true,
          ponFilterResumePosition: lastScanned,
          ponFilterHasMore: hasMore,
        };
      }

      if (rows.length < chunk) {
        return {
          snapshotRunId,
          generatedAt: generatedAtIso,
          scannedCount,
          totalEntries,
          entries: collected,
          ponFilterActive: true,
          ponFilterResumePosition: lastScanned,
          ponFilterHasMore: false,
        };
      }
    }

    return {
      snapshotRunId,
      generatedAt: generatedAtIso,
      scannedCount,
      totalEntries,
      entries: collected,
      ponFilterActive: true,
      ponFilterResumePosition: lastScanned,
      ponFilterHasMore: false,
    };
  }

  async function getHistoryList(input = {}) {
    await ensureReady();

    const statusRaw = normalizeText(input?.status).toLowerCase();
    const status =
      statusRaw === 'aberta' || statusRaw === 'encerrada' || statusRaw === 'cancelada'
        ? statusRaw
        : null;
    const startDate = normalizeDate(input?.startDate);
    const endDate = normalizeDate(input?.endDate);
    const limit = Math.min(10000, Math.max(1, normalizePositiveInt(input?.limit) ?? 3000));

    const where = [];
    const values = [];
    if (status !== null) {
      where.push('h.status = ?');
      values.push(status);
    }
    if (startDate !== null) {
      where.push('h.opened_at >= ?');
      values.push(startDate);
    }
    if (endDate !== null) {
      where.push('h.opened_at <= ?');
      values.push(endDate);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await dataPool.query(
      `
        SELECT
          h.id AS id,
          h.protocol AS protocol,
          h.assignment_id AS assignmentId,
          h.access_point_code AS accessPointCode,
          h.title AS title,
          h.operator_email AS operatorEmail,
          h.affected_clients AS affectedClients,
          h.status AS status,
          h.opened_at AS openedAt,
          h.event_identified_at AS eventIdentifiedAt,
          h.expected_close_at AS expectedCloseAt,
          h.closed_at AS closedAt,
          h.close_description AS closeDescription,
          ${hasClosedByColumn ? 'h.closed_by AS closedBy,' : ''}
          ${hasClassificationColumns ? `h.tipo_incidente AS tipoIncidente,
          h.impacto AS impacto,
          h.area AS area,
          h.tecnologia AS tecnologia,
          h.classificacao AS classificacao,
          h.cnl AS cnl,` : ''}
          ${hasEventStartColumn ? 'h.event_start_at AS eventStartAt,' : ''}
          ${hasInfraProtocolColumns ? 'h.infra_protocol AS infraProtocol, h.infra_assignment_id AS infraAssignmentId,' : ''}
          ${hasIdentifiedByColumn ? 'h.identified_by AS identifiedBy,' : ''}
          ${hasClassificationAuditColumns ? 'h.classification_updated_by AS classificationUpdatedBy, h.classification_updated_at AS classificationUpdatedAt,' : ''}
          ${hasAffectedVerificationColumns ? `h.affected_verification_checked_at AS affectedVerificationCheckedAt,
          h.affected_verification_total AS affectedVerificationTotal,
          h.affected_verification_still_offline AS affectedVerificationStillOffline,
          h.affected_verification_still_degraded AS affectedVerificationStillDegraded,
          h.affected_verification_by AS affectedVerificationBy,` : ''}
          CASE
            WHEN h.event_identified_at IS NOT NULL
              AND h.closed_at IS NOT NULL
              AND h.closed_at > h.event_identified_at
            THEN TIMESTAMPDIFF(MINUTE, h.event_identified_at, h.closed_at)
          END AS mttrMinutes,
          ${hasEventStartColumn ? `CASE
            WHEN h.event_start_at IS NOT NULL
              AND h.event_identified_at IS NOT NULL
              AND h.event_identified_at >= h.event_start_at
            THEN TIMESTAMPDIFF(MINUTE, h.event_start_at, h.event_identified_at)
          END AS mttdMinutes,` : 'NULL AS mttdMinutes,'}
          h.updated_at AS updatedAt
        FROM massiva_history h
        ${whereSql}
        ORDER BY h.opened_at DESC, h.id DESC
        LIMIT ?
      `,
      [...values, limit],
    );

    return rows.map((row) => ({
      id: Number(row.id ?? 0),
      protocol: row.protocol == null ? null : Number(row.protocol),
      assignmentId: row.assignmentId == null ? null : Number(row.assignmentId),
      accessPointCode: normalizeText(row.accessPointCode),
      title: normalizeText(row.title),
      operatorEmail: normalizeText(row.operatorEmail),
      affectedClients: Number(row.affectedClients ?? 0),
      status: normalizeMassivaHistoryStatus(row.status),
      openedAt: serializeHistoryDate(row.openedAt),
      eventIdentifiedAt: serializeHistoryDate(row.eventIdentifiedAt),
      expectedCloseAt: serializeHistoryDate(row.expectedCloseAt),
      closedAt: serializeHistoryDate(row.closedAt),
      closeDescription: normalizeNullableText(row.closeDescription),
      closedBy: normalizeNullableText(row.closedBy),
      tipoIncidente: normalizeNullableText(row.tipoIncidente),
      impacto: normalizeNullableText(row.impacto),
      area: normalizeNullableText(row.area),
      tecnologia: normalizeNullableText(row.tecnologia),
      classificacao: normalizeNullableText(row.classificacao),
      cnl: normalizeNullableText(row.cnl),
      eventStartAt: serializeHistoryDate(row.eventStartAt),
      infraProtocol: row.infraProtocol == null ? null : Number(row.infraProtocol),
      infraAssignmentId: row.infraAssignmentId == null ? null : Number(row.infraAssignmentId),
      identifiedBy: normalizeNullableText(row.identifiedBy),
      classificationUpdatedBy: normalizeNullableText(row.classificationUpdatedBy),
      classificationUpdatedAt: serializeHistoryDate(row.classificationUpdatedAt),
      affectedVerificationCheckedAt: serializeHistoryDate(row.affectedVerificationCheckedAt),
      affectedVerificationTotal: row.affectedVerificationTotal != null ? Number(row.affectedVerificationTotal) : null,
      affectedVerificationStillOffline: row.affectedVerificationStillOffline != null ? Number(row.affectedVerificationStillOffline) : null,
      affectedVerificationStillDegraded: row.affectedVerificationStillDegraded != null ? Number(row.affectedVerificationStillDegraded) : null,
      affectedVerificationBy: normalizeNullableText(row.affectedVerificationBy),
      mttdMinutes: row.mttdMinutes != null ? Number(row.mttdMinutes) : null,
      mttrMinutes: row.mttrMinutes != null ? Number(row.mttrMinutes) : null,
      updatedAt: serializeHistoryDate(row.updatedAt),
    }));
  }

  /**
   * Retorna médias mensais de MTTD e MTTR para os últimos `months` meses.
   * MTTR é sempre calculável (event_identified_at → closed_at).
   * MTTD requer a coluna event_start_at (migração idempotente no ensureReady).
   * Apenas registros encerrados e com timestamps válidos contribuem para cada média.
   */
  async function getMttdMttrMonthlyKpis(input = {}) {
    await ensureReady();

    const months = Math.min(24, Math.max(1, normalizePositiveInt(input?.months) ?? 6));

    const mttdExpr = hasEventStartColumn
      ? `AVG(CASE
            WHEN h.event_start_at IS NOT NULL
              AND h.event_identified_at IS NOT NULL
              AND h.event_identified_at >= h.event_start_at
            THEN TIMESTAMPDIFF(MINUTE, h.event_start_at, h.event_identified_at)
          END)`
      : 'NULL';

    const [rows] = await dataPool.query(
      `
        SELECT
          DATE_FORMAT(h.opened_at, '%Y-%m') AS month,
          COUNT(*) AS total,
          ${mttdExpr} AS avgMttdMinutes,
          AVG(CASE
            WHEN h.event_identified_at IS NOT NULL
              AND h.closed_at IS NOT NULL
              AND h.closed_at > h.event_identified_at
            THEN TIMESTAMPDIFF(MINUTE, h.event_identified_at, h.closed_at)
          END) AS avgMttrMinutes,
          SUM(CASE
            WHEN h.event_identified_at IS NOT NULL AND h.closed_at IS NOT NULL
              AND h.closed_at > h.event_identified_at
            THEN 1 ELSE 0 END) AS mttrCount,
          SUM(CASE
            WHEN ${hasEventStartColumn ? 'h.event_start_at IS NOT NULL AND ' : '1 = 0 AND '}
              h.event_identified_at IS NOT NULL
              AND h.event_identified_at >= ${hasEventStartColumn ? 'h.event_start_at' : 'h.event_start_at'}
            THEN 1 ELSE 0 END) AS mttdCount
        FROM massiva_history h
        WHERE
          h.status = 'encerrada'
          AND h.opened_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(h.opened_at, '%Y-%m')
        ORDER BY month ASC
      `,
      [months],
    );

    return (Array.isArray(rows) ? rows : []).map((row) => ({
      month: String(row.month ?? ''),
      total: Number(row.total ?? 0),
      avgMttdMinutes: row.avgMttdMinutes != null ? Number(row.avgMttdMinutes) : null,
      avgMttrMinutes: row.avgMttrMinutes != null ? Number(row.avgMttrMinutes) : null,
      mttrCount: Number(row.mttrCount ?? 0),
      mttdCount: Number(row.mttdCount ?? 0),
    }));
  }

  async function end() {
    await dataPool.end();
  }

  return {
    configured: true,
    ensureReady,
    registerOpenBatch,
    registerClose,
    registerCancel,
    updateClassification,
    registerAffectedClients,
    getAffectedClientsPppoeList,
    saveAffectedVerificationResult,
    getRecentAffectedVerificationsWithProblems,
    updateExpectedClose,
    markClosedByProtocols,
    getSplitterStats,
    getMassivaPeriodRollup,
    getMassivaSplitterLinksInPeriod,
    getMassivaEventsWithSplitterInPeriod,
    getMassivaRecurrenceByDayShift,
    getOpenSplitterCodes,
    getSplitterCodesForProtocols,
    upsertSplitterSnapshots,
    getSplitterTrends,
    getRecentSplitterSnapshots,
    getRecentHistoryBySplitter,
    getOpenMassivaDashboardKpis,
    replaceNetworkReliefSnapshot,
    hasCompletedNetworkReliefSnapshot,
    getLatestNetworkReliefSnapshotPage,
    getHistoryList,
    getMttdMttrMonthlyKpis,
    end,
  };
}

