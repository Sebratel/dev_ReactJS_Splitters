/**
 * Consulta (SOMENTE LEITURA) de quais clientes já estão em outro evento aberto.
 *
 * Cruza assignment_clients (linhas que disparam o aviso ao cliente) com massiva_history: conta linha de GMUD
 * (existe só durante a janela) e linha de massiva cujo protocolo está realmente ABERTO na plataforma. Linha de
 * protocolo encerrado/cancelado não conta. Se a coluna `origin` ainda não existe no banco (SQL do gateway não
 * aplicado), só olha massivas, como antes. Pool próprio e pequeno. Sem DDL.
 */
import mysql from 'mysql2/promise';
import { groupConflictsByEvent, normalizeContractIds } from './lib/massivaClientConflicts.js';

const CHUNK = 500;

const text = (value) => String(value ?? '').trim();

export function createMassivaClientConflictsStore(config, { poolFactory = mysql.createPool } = {}) {
  const host = text(config?.host);
  const user = text(config?.user);
  const password = String(config?.password ?? '');
  const database = text(config?.database);
  const configured = host !== '' && user !== '' && password !== '' && database !== '';

  if (!configured) {
    return {
      configured: false,
      async findOpenEventConflicts() {
        return { events: [], contractIds: [] };
      },
    };
  }

  const pool = poolFactory({
    host,
    port: Number.parseInt(String(config?.port ?? ''), 10) || 3306,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    charset: 'utf8mb4',
  });

  let hasOrigin = null;
  async function originColumnExists() {
    if (hasOrigin === true) return true;
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignment_clients' AND COLUMN_NAME = 'origin'",
    );
    hasOrigin = Number(rows?.[0]?.n ?? 0) === 1;
    return hasOrigin;
  }

  return {
    configured: true,

    /**
     * `contractIds` → { events, contractIds } só com eventos abertos que já têm esses clientes.
     * `excludeProtocol`: ignora as linhas desse protocolo (o próprio evento que está sendo conferido).
     */
    async findOpenEventConflicts(contractIds, { excludeProtocol } = {}) {
      const ids = normalizeContractIds(contractIds);
      const withOrigin = await originColumnExists();
      const exclude = Number(excludeProtocol) > 0 ? Number(excludeProtocol) : null;
      const rows = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const params = [slice];
        let sql;
        if (withOrigin) {
          sql = `SELECT ac.contract_id, ac.user_pppoe, COALESCE(h.protocol, CAST(ac.protocol_id AS UNSIGNED)) AS protocol,
                        h.title, h.opened_at, ac.finish_date, ac.origin
                   FROM assignment_clients ac
                   LEFT JOIN massiva_history h ON h.protocol = CAST(ac.protocol_id AS UNSIGNED)
                  WHERE ac.contract_id IN (?) AND (ac.origin = 'GMUD' OR h.status = 'aberta')`;
        } else {
          sql = `SELECT ac.contract_id, ac.user_pppoe, h.protocol AS protocol, h.title, h.opened_at, ac.finish_date
                   FROM assignment_clients ac
                   JOIN massiva_history h ON h.protocol = COALESCE(ac.protocol, CAST(ac.protocol_id AS UNSIGNED))
                  WHERE ac.contract_id IN (?) AND h.status = 'aberta'`;
        }
        if (exclude !== null) {
          sql += ' AND CAST(ac.protocol_id AS UNSIGNED) <> ?';
          params.push(exclude);
        }
        const [part] = await pool.query(sql, params);
        rows.push(...part);
      }
      return groupConflictsByEvent(rows);
    },
  };
}
