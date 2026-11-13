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
      async markReincluded() {},
      async recordError() {},
      async counts() { return { incluidas: 0, clientesAtivos: 0 }; },
      async listActiveClients() { return []; },
      async getClientSummary() { return null; },
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
          [slice.map((c) => [protocol, c.contractId, c.pppoe || null, c.corporate ? 1 : 0, skipped.has(c.contractId) ? 'ja_em_outro_evento' : 'incluido', nowNaive])],
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

    /** Clientes que estavam de fora ('ja_em_outro_evento') voltaram a ser sinalizados pela GMUD. */
    async markReincluded({ protocol, contractIds }) {
      const ids = (contractIds ?? []).map(Number).filter((n) => n > 0);
      if (ids.length === 0) return;
      await pool.query(
        "UPDATE gmud_affected_clients SET status = 'incluido' WHERE gmud_protocol = ? AND contract_id IN (?) AND status = 'ja_em_outro_evento' AND removed_at IS NULL",
        [protocol, ids],
      );
      await pool.query(
        'UPDATE gmud_client_sync SET clients_sent = clients_sent + ?, clients_skipped = GREATEST(clients_skipped - ?, 0) WHERE gmud_protocol = ?',
        [ids.length, ids.length, protocol],
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

    /** Clientes hoje sinalizados por GMUD (para identificar "GMUD" nas telas): [{ contractId, protocol, corporate, includedAt, windowEnd }]. */
    async listActiveClients() {
      const [rows] = await pool.query(
        `SELECT c.contract_id, c.corporate_client, c.included_at, s.gmud_protocol, s.window_end
           FROM gmud_affected_clients c
           JOIN gmud_client_sync s ON s.gmud_protocol = c.gmud_protocol
          WHERE c.removed_at IS NULL AND c.status = 'incluido' AND s.status = 'incluida'`,
      );
      return rows.map((r) => ({
        contractId: Number(r.contract_id),
        protocol: Number(r.gmud_protocol),
        corporate: Number(r.corporate_client) === 1,
        includedAt: r.included_at ? toNaive(r.included_at) : null,
        windowEnd: r.window_end ? toNaive(r.window_end) : null,
      }));
    },

    /** Resumo da última inclusão da GMUD, ou null se ela nunca foi incluída. */
    async getClientSummary(protocol) {
      const [syncRows] = await pool.query(
        `SELECT status, included_at, removed_at, removed_reason, window_end, clients_total, clients_sent, clients_skipped
           FROM gmud_client_sync WHERE gmud_protocol = ? AND included_at IS NOT NULL`,
        [protocol],
      );
      const s = syncRows?.[0];
      if (!s) return null;
      const [corp] = await pool.query(
        `SELECT COALESCE(SUM(corporate_client), 0) AS corporativos
           FROM gmud_affected_clients
          WHERE gmud_protocol = ? AND included_at = (SELECT MAX(included_at) FROM gmud_affected_clients WHERE gmud_protocol = ?)`,
        [protocol, protocol],
      );
      return {
        status: s.status,
        total: Number(s.clients_total),
        incluidos: Number(s.clients_sent),
        deForaPorOutroEvento: Number(s.clients_skipped),
        corporativos: Number(corp?.[0]?.corporativos ?? 0),
        includedAt: s.included_at ? toNaive(s.included_at) : null,
        removedAt: s.removed_at ? toNaive(s.removed_at) : null,
        removedReason: s.removed_reason ?? null,
        windowEnd: s.window_end ? toNaive(s.window_end) : null,
      };
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
