/**
 * Acesso ao MySQL de massivas para a "Conferência com o Elleven" (ver lib/massivaConferenciaElleven.js).
 *
 * Arquivo próprio e pool próprio (máx. 2 conexões) de propósito: não mexe em massivaHistoryStore.js
 * (arquivo grande e compartilhado com outras branches) e não disputa conexões com as telas.
 *
 * Sem DDL. O banco já tem os índices únicos uq_massiva_history_protocol e uq_massiva_history_assignment,
 * então o INSERT é naturalmente idempotente: duplicidade (errno 1062) vira { duplicate } ou { conflict },
 * nunca erro. Só grava as colunas que o Elleven realmente informa; as demais ficam no default da tabela
 * (affected_clients = 0, operator_email = '', access_point_code = '').
 */
import mysql from 'mysql2/promise';

function text(value) {
  return String(value ?? '').trim();
}

const CHUNK = 500;
const REQUIRED_COLUMNS = ['protocol', 'assignment_id', 'title', 'status', 'source'];

export function createMassivaConferenciaStore(config, { poolFactory = mysql.createPool } = {}) {
  const host = text(config?.host);
  const port = Number.parseInt(String(config?.port ?? ''), 10) || 3306;
  const user = text(config?.user);
  const password = String(config?.password ?? '');
  const database = text(config?.database);
  const configured = host !== '' && user !== '' && password !== '' && database !== '';

  if (!configured) {
    return {
      configured: false,
      async getLocalStatusByProtocols() {
        return new Map();
      },
      async insertRecovered() {
        return { inserted: false, skipped: true };
      },
      async countRecovered() {
        return 0;
      },
      async end() {},
    };
  }

  const pool = poolFactory({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    charset: 'utf8mb4',
  });

  let columnsPromise = null;
  /** Colunas existentes em massiva_history (cache; refaz a consulta se falhar). */
  function loadColumns() {
    if (!columnsPromise) {
      columnsPromise = pool
        .query(
          "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'massiva_history'",
        )
        .then(([rows]) => new Set(rows.map((r) => String(r.name))))
        .catch((error) => {
          columnsPromise = null;
          throw error;
        });
    }
    return columnsPromise;
  }

  return {
    configured: true,

    /** protocolos -> Map<number, status>. Consulta em blocos, somente leitura. */
    async getLocalStatusByProtocols(protocols) {
      const unique = [...new Set((Array.isArray(protocols) ? protocols : []).map(Number).filter((n) => Number.isFinite(n) && n > 0))];
      const out = new Map();
      for (let i = 0; i < unique.length; i += CHUNK) {
        const slice = unique.slice(i, i + CHUNK);
        const [rows] = await pool.query('SELECT protocol, status FROM massiva_history WHERE protocol IN (?)', [slice]);
        for (const r of rows) out.set(Number(r.protocol), text(r.status).toLowerCase());
      }
      return out;
    },

    /**
     * Insere a linha recuperada. Retorna { inserted:true } | { duplicate:true } | { conflict:'...' }.
     * Qualquer outro erro é relançado (o serviço registra como falha e segue com as demais).
     */
    async insertRecovered(row) {
      const columns = await loadColumns();
      const missing = REQUIRED_COLUMNS.filter((c) => !columns.has(c));
      if (missing.length > 0) {
        throw new Error(`Esquema de massiva_history incompatível: faltam as colunas ${missing.join(', ')}.`);
      }
      const values = [
        ['protocol', row.protocol],
        ['assignment_id', row.assignmentId],
        ['title', row.title],
        ['status', row.status],
        ['opened_at', row.openedAt],
        ['closed_at', row.closedAt],
        ['close_description', row.closeDescription],
        ['closed_by', row.closedBy],
        ['source', row.source],
      ].filter(([name, value]) => columns.has(name) && value !== undefined && value !== null);
      const names = values.map(([n]) => n);
      try {
        await pool.query(
          `INSERT INTO massiva_history (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
          values.map(([, v]) => v),
        );
        return { inserted: true };
      } catch (error) {
        if (error?.errno === 1062 || error?.code === 'ER_DUP_ENTRY') {
          const msg = String(error?.sqlMessage ?? error?.message ?? '');
          if (/assignment/i.test(msg)) return { conflict: 'assignment_id já existe na plataforma com outro protocolo' };
          return { duplicate: true };
        }
        throw error;
      }
    },

    /** Quantas linhas foram recuperadas nos últimos N dias (somente leitura). */
    async countRecovered(days) {
      const n = Math.max(1, Math.min(365, Number.parseInt(String(days), 10) || 30));
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS n FROM massiva_history WHERE source = ? AND created_at >= (NOW() - INTERVAL ? DAY)',
        ['conferencia-elleven', n],
      );
      return Number(rows?.[0]?.n ?? 0);
    },

    async end() {
      await pool.end();
    },
  };
}
