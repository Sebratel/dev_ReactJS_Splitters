import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMassivaConferenciaStore } from './massivaConferenciaStore.js';

const CONFIG = { host: 'db.example', port: '3306', user: 'u', password: 'p', database: 'DB_Massives' };
const ALL_COLUMNS = [
  'id', 'protocol', 'assignment_id', 'access_point_code', 'title', 'operator_email', 'affected_clients', 'status',
  'opened_at', 'closed_at', 'auto_closed_without_clients', 'close_description', 'source', 'created_at', 'closed_by',
];

/** Pool falso: guarda as consultas e responde conforme o texto do SQL. */
function fakePool({ columns = ALL_COLUMNS, insertError = null, statusRows = [], countRow = { n: 3 } } = {}) {
  const queries = [];
  let ended = false;
  return {
    queries,
    get ended() { return ended; },
    pool: {
      async query(sql, params) {
        queries.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
        if (/information_schema\.COLUMNS/.test(sql)) return [columns.map((name) => ({ name }))];
        if (/^INSERT INTO massiva_history/i.test(String(sql).trim())) {
          if (insertError) throw insertError;
          return [{ insertId: 1 }];
        }
        if (/SELECT protocol, status/.test(sql)) return [statusRows];
        if (/COUNT\(\*\)/.test(sql)) return [[countRow]];
        return [[]];
      },
      async end() { ended = true; },
    },
  };
}

const ROW = {
  protocol: 1886910,
  assignmentId: 2322000,
  title: 'OLT 03 - SLEFT',
  status: 'aberta',
  openedAt: '2026-11-12 08:00:00',
  closedAt: null,
  closedBy: null,
  closeDescription: null,
  source: 'conferencia-elleven',
};

function make(opts) {
  const fp = fakePool(opts);
  const store = createMassivaConferenciaStore(CONFIG, { poolFactory: (cfg) => { fp.cfg = cfg; return fp.pool; } });
  return { store, fp };
}

describe('createMassivaConferenciaStore', () => {
  it('sem configuração do MySQL: não conecta e responde vazio', async () => {
    const store = createMassivaConferenciaStore({}, { poolFactory: () => { throw new Error('não deveria criar pool'); } });
    assert.equal(store.configured, false);
    assert.equal((await store.getLocalStatusByProtocols([1])).size, 0);
    assert.equal((await store.insertRecovered(ROW)).inserted, false);
    assert.equal(await store.countRecovered(30), 0);
  });

  it('pool próprio e pequeno (máx. 2 conexões)', () => {
    const { fp } = make();
    assert.equal(fp.cfg.connectionLimit, 2);
    assert.equal(fp.cfg.database, 'DB_Massives');
  });

  it('insere só as colunas informadas (aberta: sem closed_at/closed_by/close_description)', async () => {
    const { store, fp } = make();
    const r = await store.insertRecovered(ROW);
    assert.deepEqual(r, { inserted: true });
    const ins = fp.queries.find((q) => /^INSERT/.test(q.sql));
    assert.equal(ins.sql, 'INSERT INTO massiva_history (protocol, assignment_id, title, status, opened_at, source) VALUES (?, ?, ?, ?, ?, ?)');
    assert.deepEqual(ins.params, [1886910, 2322000, 'OLT 03 - SLEFT', 'aberta', '2026-11-12 08:00:00', 'conferencia-elleven']);
    assert.equal(/operator_email|affected_clients|access_point_code/.test(ins.sql), false, 'campos que o Elleven não informa ficam no default');
  });

  it('encerrada: inclui closed_at, closed_by e descrição; ignora colunas que não existem', async () => {
    const colunasSemClosedBy = ALL_COLUMNS.filter((c) => c !== 'closed_by');
    const { store, fp } = make({ columns: colunasSemClosedBy });
    await store.insertRecovered({ ...ROW, status: 'encerrada', closedAt: '2026-11-12 09:00:00', closedBy: 'conferencia-elleven', closeDescription: 'Recuperada.' });
    const ins = fp.queries.find((q) => /^INSERT/.test(q.sql));
    assert.match(ins.sql, /closed_at, close_description, source\)/);
    assert.equal(/closed_by/.test(ins.sql), false);
  });

  it('consulta as colunas uma única vez (cache)', async () => {
    const { store, fp } = make();
    await store.insertRecovered(ROW);
    await store.insertRecovered({ ...ROW, protocol: 2 });
    assert.equal(fp.queries.filter((q) => /information_schema/.test(q.sql)).length, 1);
  });

  it('esquema incompatível: erro claro em vez de gravar errado', async () => {
    const { store } = make({ columns: ['id', 'protocol'] });
    await assert.rejects(() => store.insertRecovered(ROW), /Esquema de massiva_history incompatível.*assignment_id/);
  });

  it('duplicidade por protocolo vira { duplicate }, não erro', async () => {
    const err = Object.assign(new Error("Duplicate entry '1886910' for key 'uq_massiva_history_protocol'"), { errno: 1062, sqlMessage: "Duplicate entry '1886910' for key 'uq_massiva_history_protocol'" });
    const { store } = make({ insertError: err });
    assert.deepEqual(await store.insertRecovered(ROW), { duplicate: true });
  });

  it('duplicidade por assignment_id vira { conflict }', async () => {
    const err = Object.assign(new Error('dup'), { errno: 1062, sqlMessage: "Duplicate entry '2322000' for key 'uq_massiva_history_assignment'" });
    const { store } = make({ insertError: err });
    const r = await store.insertRecovered(ROW);
    assert.match(r.conflict, /assignment_id/);
  });

  it('outros erros de banco são relançados (o serviço registra como falha)', async () => {
    const { store } = make({ insertError: Object.assign(new Error('Lock wait timeout exceeded'), { errno: 1205 }) });
    await assert.rejects(() => store.insertRecovered(ROW), /Lock wait timeout/);
  });

  it('getLocalStatusByProtocols consulta em blocos de 500 e devolve Map protocolo -> status', async () => {
    const statusRows = [{ protocol: 1, status: 'Aberta' }, { protocol: '2', status: 'encerrada' }];
    const { store, fp } = make({ statusRows });
    const protocolos = Array.from({ length: 1200 }, (_, i) => i + 1);
    const map = await store.getLocalStatusByProtocols([...protocolos, 5, 'x', -3, 0]);
    const selects = fp.queries.filter((q) => /SELECT protocol, status/.test(q.sql));
    assert.equal(selects.length, 3, '1200 protocolos distintos = 3 blocos');
    assert.equal(selects[0].params[0].length, 500);
    assert.equal(selects[2].params[0].length, 200);
    assert.equal(map.get(1), 'aberta', 'status normalizado em minúsculas');
    assert.equal(map.get(2), 'encerrada');
  });

  it('getLocalStatusByProtocols sem protocolos não consulta nada', async () => {
    const { store, fp } = make();
    assert.equal((await store.getLocalStatusByProtocols([])).size, 0);
    assert.equal(fp.queries.length, 0);
  });

  it('countRecovered conta pela origem e pela janela (somente leitura)', async () => {
    const { store, fp } = make({ countRow: { n: '7' } });
    assert.equal(await store.countRecovered(30), 7);
    const q = fp.queries.find((x) => /COUNT/.test(x.sql));
    assert.match(q.sql, /^SELECT COUNT\(\*\) AS n FROM massiva_history WHERE source = \? AND created_at >= \(NOW\(\) - INTERVAL \? DAY\)$/);
    assert.deepEqual(q.params, ['conferencia-elleven', 30]);
    assert.equal(/INSERT|UPDATE|DELETE/i.test(q.sql), false);
  });

  it('end() fecha o pool', async () => {
    const { store, fp } = make();
    await store.end();
    assert.equal(fp.ended, true);
  });
});
