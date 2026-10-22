import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import {
  countResponseBytes,
  createInFlightTracker,
  getMemorySnapshot,
  reportPreviousRun,
  startRuntimeDiagnostics,
} from './runtimeDiagnostics.js';
import { attachPgPoolErrorHandler } from './pgPoolErrors.js';

function tmpHeartbeat() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'diag-unit-')), 'hb.json');
}

function fakeLogger() {
  const calls = [];
  const make = (level) => (message, meta) => calls.push({ level, message, meta });
  return {
    calls,
    debug: make('debug'),
    info: make('info'),
    warn: make('warn'),
    error: make('error'),
  };
}

describe('getMemorySnapshot', () => {
  it('devolve MB e percentual do limite do heap', () => {
    const m = getMemorySnapshot();
    for (const key of ['rssMb', 'heapUsedMb', 'heapTotalMb', 'heapLimitMb', 'heapUsedPct']) {
      assert.equal(typeof m[key], 'number', key);
    }
    assert.ok(m.heapLimitMb > m.heapUsedMb);
    assert.ok(m.heapUsedPct > 0 && m.heapUsedPct < 100);
  });
});

describe('createInFlightTracker', () => {
  it('conta, lista as mais antigas primeiro e remove no end()', () => {
    let t = 1000;
    const tracker = createInFlightTracker(() => t);
    const endA = tracker.begin({ id: 'a', path: '/a' });
    t = 1500;
    const endB = tracker.begin({ id: 'b', path: '/b' });
    t = 2000;

    assert.equal(tracker.count(), 2);
    assert.deepEqual(
      tracker.list().map((e) => [e.id, e.ageMs]),
      [
        ['a', 1000],
        ['b', 500],
      ],
    );

    endA();
    assert.equal(tracker.count(), 1);
    endB();
    assert.equal(tracker.count(), 0);
  });

  it('respeita o limite de itens listados', () => {
    const tracker = createInFlightTracker();
    for (let i = 0; i < 5; i += 1) tracker.begin({ id: String(i) });
    assert.equal(tracker.list(2).length, 2);
  });
});

describe('countResponseBytes', () => {
  it('soma bytes de write/end (inclusive multibyte) sem alterar o que é enviado', () => {
    const sent = [];
    const res = {
      write(chunk) {
        sent.push(chunk);
        return true;
      },
      end(chunk) {
        if (typeof chunk !== 'function' && chunk != null) sent.push(chunk);
      },
    };
    const getBytes = countResponseBytes(res);

    res.write('abc');
    res.write(Buffer.from([1, 2, 3, 4]));
    res.end('ção'); // 5 bytes em UTF-8

    assert.equal(getBytes(), 3 + 4 + 5);
    assert.deepEqual(sent, ['abc', Buffer.from([1, 2, 3, 4]), 'ção']);
  });

  it('end() sem corpo e end(callback) não quebram a contagem', () => {
    const res = { write: () => true, end: () => {} };
    const getBytes = countResponseBytes(res);
    res.end();
    res.end(() => {});
    assert.equal(getBytes(), 0);
  });
});

describe('reportPreviousRun', () => {
  it('sem arquivo: não loga nada (primeiro boot)', () => {
    const logger = fakeLogger();
    assert.equal(reportPreviousRun({ file: tmpHeartbeat(), logger }), null);
    assert.equal(logger.calls.length, 0);
  });

  it('arquivo corrompido é ignorado', () => {
    const file = tmpHeartbeat();
    fs.writeFileSync(file, '{nao-e-json');
    const logger = fakeLogger();
    assert.equal(reportPreviousRun({ file, logger }), null);
    assert.equal(logger.calls.length, 0);
  });

  it('shutdown limpo (SIGTERM) loga info', () => {
    const file = tmpHeartbeat();
    fs.writeFileSync(
      file,
      JSON.stringify({ pid: 7, updatedAt: new Date().toISOString(), cleanShutdown: true, signal: 'SIGTERM' }),
    );
    const logger = fakeLogger();
    const out = reportPreviousRun({ file, logger });
    assert.equal(out.abnormal, false);
    assert.equal(logger.calls[0].level, 'info');
    assert.equal(logger.calls[0].message, 'previous_run_ended_cleanly');
  });

  it('sem shutdown limpo loga error com memória e requisições em voo', () => {
    const file = tmpHeartbeat();
    fs.writeFileSync(
      file,
      JSON.stringify({
        pid: 9,
        updatedAt: new Date(Date.now() - 4000).toISOString(),
        cleanShutdown: false,
        memory: { heapUsedPct: 91 },
        inFlightCount: 1,
        inFlight: [{ id: 'r1', path: '/api/massiva/connections', ageMs: 12000 }],
      }),
    );
    const logger = fakeLogger();
    const out = reportPreviousRun({ file, logger });

    assert.equal(out.abnormal, true);
    const call = logger.calls[0];
    assert.equal(call.level, 'error');
    assert.equal(call.message, 'previous_run_ended_abnormally');
    assert.equal(call.meta.lastMemory.heapUsedPct, 91);
    assert.equal(call.meta.inFlightAtLastHeartbeat[0].path, '/api/massiva/connections');
    assert.ok(call.meta.msSinceLastHeartbeat >= 4000);
  });
});

describe('startRuntimeDiagnostics', () => {
  function start(overrides) {
    const logger = fakeLogger();
    const heartbeatFile = tmpHeartbeat();
    const handle = startRuntimeDiagnostics({
      intervalMs: 60_000,
      heartbeatFile,
      logger,
      installProcessHooks: false,
      ...overrides,
    });
    return { handle, logger, heartbeatFile };
  }

  it('grava heartbeat a cada amostra, com requisições em voo e sem marcar shutdown limpo', () => {
    const { handle, heartbeatFile } = start({
      getInFlight: () => ({ count: 1, list: [{ id: 'x', path: '/rota' }] }),
      getMemory: () => ({ heapUsedPct: 10 }),
    });
    handle.stop();

    const hb = JSON.parse(fs.readFileSync(heartbeatFile, 'utf8'));
    assert.equal(hb.cleanShutdown, false);
    assert.equal(hb.inFlightCount, 1);
    assert.equal(hb.inFlight[0].path, '/rota');
    assert.equal(hb.memory.heapUsedPct, 10);
  });

  it('heap abaixo do alerta: info, sem detalhar requisições, e throttled', () => {
    const { handle, logger } = start({
      getInFlight: () => ({ count: 2, list: [{ id: 'x' }] }),
      getMemory: () => ({ heapUsedPct: 10 }),
    });
    handle.sample();
    handle.sample();
    handle.stop();

    const memLogs = logger.calls.filter((c) => c.message === 'process_memory');
    assert.equal(memLogs.length, 1, 'info é limitado por infoEveryMs');
    assert.equal(memLogs[0].level, 'info');
    assert.equal(memLogs[0].meta.inFlight, undefined);
  });

  it('heap >= warnPct: warn a CADA amostra, com a lista de requisições em voo', () => {
    const { handle, logger } = start({
      getInFlight: () => ({ count: 1, list: [{ id: 'x', path: '/api/massiva/connections' }] }),
      getMemory: () => ({ heapUsedPct: 75 }),
    });
    handle.sample();
    handle.stop();

    const memLogs = logger.calls.filter((c) => c.message === 'process_memory');
    assert.equal(memLogs.length, 2); // amostra inicial + sample()
    assert.ok(memLogs.every((c) => c.level === 'warn'));
    assert.equal(memLogs[0].meta.inFlight[0].path, '/api/massiva/connections');
  });

  it('heap >= errorPct: error', () => {
    const { handle, logger } = start({ getMemory: () => ({ heapUsedPct: 90 }) });
    handle.stop();
    assert.equal(logger.calls.find((c) => c.message === 'process_memory').level, 'error');
  });

  it('inclui o estado dos pools no log', () => {
    const { handle, logger } = start({
      getMemory: () => ({ heapUsedPct: 80 }),
      getPoolStats: () => ({ postgres_main: { total: 10, inUse: 10, idle: 0, waiting: 4 } }),
    });
    handle.stop();
    assert.equal(logger.calls[0].meta.poolStats.postgres_main.waiting, 4);
  });

  it('stop() é idempotente', () => {
    const { handle } = start({ getMemory: () => ({ heapUsedPct: 1 }) });
    handle.stop();
    assert.doesNotThrow(() => handle.stop());
  });
});

describe('attachPgPoolErrorHandler', () => {
  it('loga o erro com o estado do pool e NÃO deixa o evento "error" estourar', () => {
    const pool = new EventEmitter();
    const logger = fakeLogger();
    attachPgPoolErrorHandler(pool, 'postgres_main', {
      logger,
      getPoolStats: () => ({ total: 3, inUse: 1, idle: 2, waiting: 0 }),
    });

    const err = Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' });
    assert.doesNotThrow(() => pool.emit('error', err));

    assert.equal(logger.calls[0].level, 'error');
    assert.equal(logger.calls[0].message, 'pg_pool_idle_client_error');
    assert.equal(logger.calls[0].meta.pool, 'postgres_main');
    assert.equal(logger.calls[0].meta.error.code, 'ECONNRESET');
    assert.equal(logger.calls[0].meta.poolStats.total, 3);
  });

  it('controle: um EventEmitter SEM listener lança ao receber "error"', () => {
    const pool = new EventEmitter();
    assert.throws(() => pool.emit('error', new Error('boom')), /boom/);
  });

  it('ignora pool nulo (ex.: onuPool não configurado)', () => {
    assert.equal(attachPgPoolErrorHandler(null, 'x'), null);
  });
});
