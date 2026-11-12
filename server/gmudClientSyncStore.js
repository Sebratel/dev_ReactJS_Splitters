/**
 * MySQL do job de clientes da GMUD (tabelas em server/sql/gmud_clientes_afetados.sql).
 * Pool próprio (máx. 2). Sem DDL: se as tabelas não existirem, `isReady()` devolve false e o job só avisa.
 */
import mysql from 'mysql2/promise';
import { SYNC_STATUS } from './lib/gmudClientSync.js';

const text = (v) => String(v ?? '').trim();
const CHUNK = 500;

export function createGmudClientSyncStore(config, { poolFactory = mysql.createPool } = {}) {
  const host = text(config?.host);
  const user = text(config?.user);
  const password = String(config?.password ?? '');
  const database = text(config?.database);
  const configured = host !== '' && user !== '' && password !== '' && database !== '';

  if (!configured) {
    return {
      configured: false,
      async isReady() { return false; },
      async listStates() { return new Map(); },
      async markIncluded() {},
      async markRemoved() {},
      async markWindowEnd() {},
      async recordError() {},
      async counts() { return { incluidas: 0, clientesAtivos: 0 }; },
    };
  }

  const pool = poolFactory({
    host,
    port: Number.parseInt(String(config?.port ?? ''), 10) || 3306,
    user, password, database,
    waitForConnections: true, connectionLimit: 2, queueLimit: 0, charset: 'utf8mb4',
  });

  let readyCache = null;

  return {
    configured: true,

    /** As duas tabelas existem? (cache só do "sim") */
    async isReady() {
      if (readyCache === true) return true;
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('gmud_client_sync', 'gmud_affected_clients')",
      );
      readyCache = Number(rows?.[0]?.n ?? 0) === 2;
      return readyCache;
    },

    /** Protocolo -> { status, windowEnd }. */
    async listStates() {
      const [rows] = await pool.query('SELECT gmud_protocol, status, window_end FROM gmud_client_sync');
      return new Map(
        rows.map((r) => [
          Number(r.gmud_protocol),
          { status: r.status, windowEnd: r.window_end ? toNaive(r.window_end) : null },
        ]),
      );
    },

    /**
     * Registra a inclusão: estado da GMUD + 1 linha de histórico por cliente
     * ('incluido' ou 'ja_em_outro_evento' quando o gateway deixou o cliente de fora).
     */
    async markIncluded({ protocol, windowEnd, clients, skippedContractIds, nowNaive }) {
      const skipped = new Set(skippedContractIds ?? []);
      const sent = clients.filter((c) => !skipped.has(c.contractId)).length;
      await pool.query(
        `INSERT INTO gmud_client_sync
           (gmud_protocol, status, window_end, clients_total, clients_sent, clients_skipped, included_at, removed_at, removed_reason, last_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
         ON DUPLICATE KEY UPDATE status = VALUES(status), window_end = VALUES(window_end), clients_total = VALUES(clients_total),
           clients_sent = VALUES(clients_sent), clients_skipped = VALUES(clients_skipped), included_at = VALUES(included_at),
           removed_at = NULL, removed_reason = NULL, last_error = NULL`,
        [protocol, SYNC_STATUS.INCLUIDA, windowEnd, clients.length, sent, clients.length - sent, nowNaive],
      );
      for (let i = 0; i < clients.length; i += CHUNK) {
        const slice = clients.slice(i, i + CHUNK);
        await pool.query(
          'INSERT INTO gmud_affected_clients (gmud_protocol, contract_id, pppoe, corporate_client, status, included_at) VALUES ?',
          [slice.map((c) => [protocol, c.contractId, c.pppoe, c.corporate ? 1 : 0, skipped.has(c.contractId) ? 'ja_em_outro_evento' : 'incluido', nowNaive])],
        );
      }
    },

    /** Marca a saída: o estado vira 'removida' e o histórico ganha removed_at (nada é apagado). */
    async markRemoved({ protocol, reason, nowNaive }) {
      await pool.query(
        `UPDATE gmud_client_sync SET status = ?, removed_at = ?, removed_reason = ?, last_error = NULL WHERE gmud_protocol = ?`,
        [SYNC_STATUS.REMOVIDA, nowNaive, text(reason).slice(0, 40), protocol],
      );
      await pool.query(
        'UPDATE gmud_affected_clients SET removed_at = ? WHERE gmud_protocol = ? AND removed_at IS NULL',
        [nowNaive, protocol],
      );
    },

    async markWindowEnd({ protocol, windowEnd }) {
      await pool.query('UPDATE gmud_client_sync SET window_end = ? WHERE gmud_protocol = ?', [windowEnd, protocol]);
    },

    /** Guarda o último erro da GMUD (cria a linha se ainda não existir, sem marcar como incluída). */
    async recordError({ protocol, message }) {
      await pool.query(
        `INSERT INTO gmud_client_sync (gmud_protocol, status, last_error) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE last_error = VALUES(last_error)`,
        [protocol, SYNC_STATUS.REMOVIDA, text(message).slice(0, 500)],
      );
    },

    async counts() {
      const [rows] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM gmud_client_sync WHERE status = 'incluida') AS incluidas,
                (SELECT COUNT(*) FROM gmud_affected_clients WHERE removed_at IS NULL AND status = 'incluido') AS clientesAtivos`,
      );
      return { incluidas: Number(rows?.[0]?.incluidas ?? 0), clientesAtivos: Number(rows?.[0]?.clientesAtivos ?? 0) };
    },
  };
}

function toNaive(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n) => String(n).padStart(2, '0');
  // o driver devolve o DATETIME como se fosse local; formatamos de volta sem converter fuso
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
