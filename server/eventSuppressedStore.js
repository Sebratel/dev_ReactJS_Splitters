/**
 * MySQL de event_suppressed_clients (server/sql/event_suppressed_clients.sql): quem ficou de fora de um evento
 * por já estar em outro, e a fila de reinclusão. Pool próprio (máx. 2). Sem DDL: sem a tabela, isReady() é false.
 */
import mysql from 'mysql2/promise';

const text = (v) => String(v ?? '').trim();

function toNaive(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const mapRow = (r) => ({
  id: Number(r.id),
  eventType: r.event_type,
  eventProtocol: Number(r.event_protocol),
  assignmentId: r.assignment_id != null ? Number(r.assignment_id) : null,
  contractId: Number(r.contract_id),
  pppoe: r.pppoe ?? '',
  corporate: Number(r.corporate_client) === 1,
  blockedByProtocol: r.blocked_by_protocol != null ? Number(r.blocked_by_protocol) : null,
  blockedByType: r.blocked_by_type ?? null,
  reason: r.reason ?? null,
  finishDate: r.finish_date ? toNaive(r.finish_date) : null,
  createdAt: r.created_at ? toNaive(r.created_at) : null,
  reincludedAt: r.reincluded_at ? toNaive(r.reincluded_at) : null,
  resolvedAt: r.resolved_at ? toNaive(r.resolved_at) : null,
  resolvedReason: r.resolved_reason ?? null,
});

export function createEventSuppressedStore(config, { poolFactory = mysql.createPool } = {}) {
  const host = text(config?.host);
  const user = text(config?.user);
  const password = String(config?.password ?? '');
  const database = text(config?.database);
  const configured = host !== '' && user !== '' && password !== '' && database !== '';

  if (!configured) {
    return {
      configured: false,
      async isReady() { return false; },
      async add() { return { inserted: 0 }; },
      async listPending() { return []; },
      async listForEvent() { return []; },
      async markReincluded() {},
      async markResolved() {},
      async getMassivaEventInfo() { return new Map(); },
      async getAssignmentFinishDates() { return new Map(); },
    };
  }

  const pool = poolFactory({
    host, port: Number.parseInt(String(config?.port ?? ''), 10) || 3306, user, password, database,
    waitForConnections: true, connectionLimit: 2, queueLimit: 0, charset: 'utf8mb4',
  });

  let readyCache = null;

  return {
    configured: true,

    async isReady() {
      if (readyCache === true) return true;
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_suppressed_clients'",
      );
      readyCache = Number(rows?.[0]?.n ?? 0) === 1;
      return readyCache;
    },

    /**
     * Registra os clientes que ficaram de fora do evento. Repetir o mesmo (evento, contrato) não duplica e
     * não desfaz uma reinclusão já feita.
     */
    async add({ eventType, eventProtocol, assignmentId, reason, finishDateNaive, nowNaive, clients }) {
      const list = (Array.isArray(clients) ? clients : []).filter((c) => Number(c?.contractId) > 0);
      if (list.length === 0) return { inserted: 0 };
      const values = list.map((c) => [
        eventType, eventProtocol, assignmentId ?? null, Number(c.contractId), text(c.pppoe).slice(0, 100) || null,
        c.corporate ? 1 : 0, c.blockedByProtocol ?? null, c.blockedByType ?? null, reason ?? null, finishDateNaive ?? null, nowNaive,
      ]);
      const [result] = await pool.query(
        `INSERT INTO event_suppressed_clients
           (event_type, event_protocol, assignment_id, contract_id, pppoe, corporate_client, blocked_by_protocol, blocked_by_type, reason, finish_date, created_at)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           assignment_id = COALESCE(VALUES(assignment_id), assignment_id),
           blocked_by_protocol = COALESCE(VALUES(blocked_by_protocol), blocked_by_protocol),
           blocked_by_type = COALESCE(VALUES(blocked_by_type), blocked_by_type)`,
        [values],
      );
      return { inserted: Number(result?.affectedRows ?? 0) };
    },

    /** Linhas aguardando reinclusão (nem reincluídas nem resolvidas). */
    async listPending() {
      const [rows] = await pool.query(
        'SELECT * FROM event_suppressed_clients WHERE reincluded_at IS NULL AND resolved_at IS NULL ORDER BY event_type, event_protocol, id LIMIT 20000',
      );
      return rows.map(mapRow);
    },

    /** Histórico das exclusões de um evento (para mostrar "já estava em outro evento"). */
    async listForEvent(eventType, eventProtocol) {
      const [rows] = await pool.query(
        'SELECT * FROM event_suppressed_clients WHERE event_type = ? AND event_protocol = ? ORDER BY id',
        [eventType, eventProtocol],
      );
      return rows.map(mapRow);
    },

    async markReincluded(ids, nowNaive) {
      if (!ids?.length) return;
      await pool.query('UPDATE event_suppressed_clients SET reincluded_at = ? WHERE id IN (?) AND reincluded_at IS NULL', [nowNaive, ids]);
    },

    async markResolved(ids, reason, nowNaive) {
      if (!ids?.length) return;
      await pool.query(
        'UPDATE event_suppressed_clients SET resolved_at = ?, resolved_reason = ? WHERE id IN (?) AND resolved_at IS NULL AND reincluded_at IS NULL',
        [nowNaive, text(reason).slice(0, 40), ids],
      );
    },

    /** protocolo -> { open, assignmentId } a partir de massiva_history (open = status 'aberta'). */
    async getMassivaEventInfo(protocols) {
      const list = [...new Set((protocols ?? []).map(Number).filter((n) => n > 0))];
      const out = new Map();
      if (list.length === 0) return out;
      const [rows] = await pool.query('SELECT protocol, status, assignment_id FROM massiva_history WHERE protocol IN (?)', [list]);
      for (const r of rows) {
        out.set(Number(r.protocol), {
          open: text(r.status).toLowerCase() === 'aberta',
          assignmentId: r.assignment_id != null ? Number(r.assignment_id) : null,
        });
      }
      return out;
    },

    /** protocolo -> previsão de fim atual ('YYYY-MM-DD HH:mm:ss') das linhas que o evento já tem em assignment_clients. */
    async getAssignmentFinishDates(protocols) {
      const list = [...new Set((protocols ?? []).map(Number).filter((n) => n > 0))];
      const out = new Map();
      if (list.length === 0) return out;
      const [rows] = await pool.query(
        'SELECT CAST(protocol_id AS UNSIGNED) AS protocol, MAX(finish_date) AS finish_date FROM assignment_clients WHERE CAST(protocol_id AS UNSIGNED) IN (?) GROUP BY CAST(protocol_id AS UNSIGNED)',
        [list],
      );
      for (const r of rows) if (r.finish_date) out.set(Number(r.protocol), toNaive(r.finish_date));
      return out;
    },
  };
}
