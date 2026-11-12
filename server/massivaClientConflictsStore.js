/**
 * Consulta (SOMENTE LEITURA) de quais clientes já estão em outro evento aberto.
 *
 * Cruza assignment_clients (linhas que disparam o aviso ao cliente) com massiva_history, para só
 * contar evento cujo protocolo está realmente ABERTO na plataforma. Linha sem histórico aberto
 * (encerrada/cancelada) não conta. Pool próprio e pequeno, para não disputar conexões com as telas.
 * Sem DDL.
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

  return {
    configured: true,

    /** `contractIds` → { events, contractIds } só com eventos de massiva abertos que já têm esses clientes. */
    async findOpenEventConflicts(contractIds) {
      const ids = normalizeContractIds(contractIds);
      const rows = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const [part] = await pool.query(
          `SELECT ac.contract_id, ac.user_pppoe, h.protocol AS protocol, h.title, h.opened_at, ac.finish_date
             FROM assignment_clients ac
             JOIN massiva_history h
               ON h.protocol = COALESCE(ac.protocol, CAST(ac.protocol_id AS UNSIGNED))
            WHERE ac.contract_id IN (?) AND h.status = 'aberta'`,
          [slice],
        );
        rows.push(...part);
      }
      return groupConflictsByEvent(rows);
    },
  };
}
