import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

/**
 * Reconstrução, em testes, dos dois mecanismos de queda do `react-backend-portainer`
 * (alerta "reiniciou 3 vezes em 4 horas", último log = query com rowCount 87397).
 *
 * Cada cenário roda num PROCESSO FILHO real, porque o que se quer provar é justamente como o
 * processo MORRE (e o que os logs mostram — ou não — quando isso acontece). Heap OOM do V8 não
 * é exceção JS: não passa por `uncaughtException`, não executa `process.on('exit')`.
 *
 * Limites DE PRODUÇÃO (docker-compose.portainer.yml, serviço backend):
 *   NODE_OPTIONS=--max-old-space-size=1200, mem_limit/memswap_limit 1.5g.
 * O teste aplica o `--max-old-space-size=1200`. O `mem_limit` não se aplica a processo filho,
 * mas não é necessário: o RSS fica abaixo de 1,5 GB quando o V8 aborta, então quem mata é o
 * V8 e não o kernel (no Docker: `OOMKilled=false`, exatamente como no alerta).
 *
 * Carga: GET /api/massiva/connections sem filtro devolve ~87k linhas x 59 colunas (`base.*`).
 *
 * ATENÇÃO À ESCALA: as linhas deste teste são SINTÉTICAS e mais pesadas que as do driver `pg`
 * (30 textos de ~15 chars, 10 numéricos, 19 nulos por linha), então aqui bastam 3 requisições
 * simultâneas para estourar o heap de 1200 MB. Medido depois, com a query real (SPLITTERS_BASE_QUERY)
 * num Postgres com o volume de produção (87.397 conexões, 416 mil portas) e o mesmo limite:
 *   1 requisição  = ~1,8 s, corpo de 150 MB, pico de heap ~131 MB
 *   5 simultâneas = pico de heap ~841 MB (RSS ~1,07 GB)
 *   8 simultâneas = pico de heap ~1198 MB (RSS ~1,40 GB, a 100 MB do mem_limit de 1,5 GB)
 *   10 simultâneas = `heap out of memory`, exit 134, sem passar por nenhum handler JS
 * 10 também é o tamanho padrão do pool `pg` (o backend não define `max`). Com dados reais mais
 * largos (endereços, nomes completos) o limiar cai; o mecanismo é o mesmo.
 */

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROWS = 87_397; // rowCount do log do alerta
const HEAP_MB = 1200; // NODE_OPTIONS de produção
const CONCURRENT_REQUESTS = 3; // 2 passa raspando; 3 já estoura

function runChild(script, { nodeArgs = [], env = {}, timeoutMs = 60_000 } = {}) {
  return spawnSync(
    process.execPath,
    [...nodeArgs, '--input-type=module', '-e', script],
    {
      cwd: SERVER_DIR,
      encoding: 'utf8',
      timeout: timeoutMs,
      env: { ...process.env, ...env },
    },
  );
}

/** Simula o que o handler faz: pg devolve `rows` (objetos JS) e `res.json` serializa tudo. */
const connectionsWorkload = (shape, concurrent = CONCURRENT_REQUESTS, viaCache = false) => `
  import { createSingleFlight } from './lib/singleFlight.js';
  const flight = createSingleFlight();
  let materializations = 0;
  process.on('uncaughtException', (e) => { console.log('MARK uncaught_exception_handler_ran'); process.exit(1); });
  process.on('unhandledRejection', () => { console.log('MARK unhandled_rejection_handler_ran'); });
  process.on('exit', (c) => console.log('MARK exit_handler_ran code=' + c));

  const ROWS = ${ROWS};
  const SHAPE = ${JSON.stringify(shape)};
  const CONCURRENT = ${concurrent};

  // Equivalente a result.rows do pg: um objeto por linha.
  // 'base': 59 colunas (30 texto, 10 numéricas, 19 nulas/flags). 'slim': 6 colunas.
  function materializeRows(seed) {
    const rows = new Array(ROWS);
    for (let i = 0; i < ROWS; i++) {
      const row = {};
      if (SHAPE === 'base') {
        for (let c = 0; c < 30; c++) row['TXT_' + c] = 'val' + seed + '-' + i + '-' + c + 'ab';
        for (let c = 0; c < 10; c++) row['NUM_' + c] = i * 7 + c;
        for (let c = 0; c < 19; c++) row['NUL_' + c] = c % 3 === 0 ? false : null;
      } else {
        row.user = 'user' + seed + '-' + i;
        row.ap = 'AP-' + (i % 400);
        row.apTitle = 'Ponto de acesso ' + (i % 400);
        row.slot = i % 16;
        row.port = i % 8;
        row.splitter = 'SPL-' + (i % 26000);
      }
      rows[i] = row;
    }
    return rows;
  }

  // Uma "requisição": materializa as linhas e serializa a resposta (res.json).
  async function produceBody(n) {
    materializations++;
    const rows = materializeRows(n);
    await new Promise((r) => setImmediate(r)); // cede o event loop como um await de I/O real
    const body = JSON.stringify({ success: true, count: rows.length, data: rows });
    await new Promise((r) => setImmediate(r));
    return Buffer.from(body); // mesmo formato guardado pelo cache do index.js (fora do heap)
  }

  async function handleRequest(n) {
    if (!${viaCache}) return (await produceBody(n)).length;
    const { value } = await flight.run('massiva-connections-full-base', () => produceBody(n));
    return value.length;
  }

  // Vários usuários abrindo a tela ao mesmo tempo: todas as requisições vivas ao mesmo tempo.
  const sizes = await Promise.all(Array.from({ length: CONCURRENT }, (_, n) => handleRequest(n)));
  console.log('MARK completed materializations=' + materializations + ' bytes=' + sizes.join(','));
`;

describe('reprodução do incidente: estouro de heap por /api/massiva/connections sem filtro', () => {
  it(`com o limite de produção (${HEAP_MB} MB), ${CONCURRENT_REQUESTS} requisições concorrentes de ${ROWS} linhas x 59 colunas abortam o processo SEM passar por nenhum handler JS`, () => {
    const result = runChild(connectionsWorkload('base'), {
      nodeArgs: [`--max-old-space-size=${HEAP_MB}`],
    });

    // O V8 aborta: saída anormal (SIGABRT no Linux, código 134 em shells, outro código no Windows).
    assert.notEqual(result.status, 0, 'o processo deveria ter morrido');
    assert.match(
      result.stderr,
      /heap out of memory|Reached heap limit/i,
      `stderr deveria acusar o estouro de heap. Recebido:\n${result.stderr.slice(0, 600)}`,
    );

    // A parte que explica o alerta: nenhuma linha de log da própria aplicação registra a morte.
    assert.doesNotMatch(result.stdout, /uncaught_exception_handler_ran/);
    assert.doesNotMatch(result.stdout, /unhandled_rejection_handler_ran/);
    assert.doesNotMatch(result.stdout, /exit_handler_ran/);
    assert.doesNotMatch(result.stdout, /MARK completed/);
  });

  it('uma única requisição da mesma carga (um usuário só) cabe no limite e termina', () => {
    const result = runChild(connectionsWorkload('base', 1), {
      nodeArgs: [`--max-old-space-size=${HEAP_MB}`],
    });

    assert.equal(result.status, 0, `não deveria morrer. stderr:\n${result.stderr.slice(0, 600)}`);
    assert.match(result.stdout, /MARK completed/);
  });

  it('a MESMA concorrência (3) passando pelo single-flight: materializa UMA vez e o processo sobrevive', () => {
    const result = runChild(connectionsWorkload('base', CONCURRENT_REQUESTS, true), {
      nodeArgs: [`--max-old-space-size=${HEAP_MB}`],
    });

    assert.equal(result.status, 0, `não deveria morrer. stderr:\n${result.stderr.slice(0, 600)}`);
    assert.match(result.stdout, /MARK completed materializations=1 /);
  });

  it('a MESMA concorrência com projeção enxuta (6 colunas) cabe no mesmo heap e termina', () => {
    const result = runChild(connectionsWorkload('slim'), {
      nodeArgs: [`--max-old-space-size=${HEAP_MB}`],
    });

    assert.equal(result.status, 0, `não deveria morrer. stderr:\n${result.stderr.slice(0, 600)}`);
    assert.match(result.stdout, /MARK completed/);
  });
});

describe('reprodução do incidente: pool Postgres sem listener de erro derruba o processo', () => {
  const poolScript = (withHandler) => `
    import pkg from 'pg';
    import { attachPgPoolErrorHandler } from './lib/pgPoolErrors.js';
    const { Pool } = pkg;

    // Mesmos handlers de processo do index.js
    process.on('uncaughtException', (error) => {
      console.log('MARK uncaught_exception message=' + error.message);
      process.exit(1);
    });

    const pool = new Pool({ host: '127.0.0.1', port: 1 });
    ${withHandler ? `attachPgPoolErrorHandler(pool, 'postgres_main', {
      logger: { error: (msg, meta) => console.log('MARK ' + msg + ' ' + meta.error.message) },
    });` : ''}

    // O pg faz exatamente isto quando um client ocioso do pool sofre erro de conexão.
    setTimeout(() => {
      pool.emit('error', new Error('Connection terminated unexpectedly'));
      setTimeout(() => { console.log('MARK still_alive'); process.exit(0); }, 100);
    }, 20);
  `;

  it('SEM pool.on("error"): o erro de um client ocioso vira uncaughtException e o processo sai com código 1', () => {
    const result = runChild(poolScript(false));

    assert.equal(result.status, 1);
    assert.match(result.stdout, /MARK uncaught_exception message=Connection terminated unexpectedly/);
    assert.doesNotMatch(result.stdout, /still_alive/);
  });

  it('COM attachPgPoolErrorHandler: o erro é logado e o processo continua vivo', () => {
    const result = runChild(poolScript(true));

    assert.equal(result.status, 0);
    assert.match(result.stdout, /MARK pg_pool_idle_client_error Connection terminated unexpectedly/);
    assert.match(result.stdout, /MARK still_alive/);
    assert.doesNotMatch(result.stdout, /uncaught_exception/);
  });
});

describe('os novos logs deixam evidência da morte por heap OOM', () => {
  it('process_memory alerta ANTES do abort e o próximo boot reporta previous_run_ended_abnormally com a rota em voo', () => {
    const heartbeatFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'diag-heartbeat-')),
      'heartbeat.json',
    );

    // Boot 1: serviço "saudável" que passa a vazar memória durante uma requisição em voo.
    const crashing = runChild(
      `
      import { startRuntimeDiagnostics, createInFlightTracker } from './lib/runtimeDiagnostics.js';
      const tracker = createInFlightTracker();
      tracker.begin({ id: 'req-1', method: 'GET', path: '/api/massiva/connections' });

      const logger = {
        info: (m, x) => console.log('LOG info ' + m),
        warn: (m, x) => console.log('LOG warn ' + m + ' pct=' + x.heapUsedPct + ' inFlight=' + (x.inFlight?.[0]?.path ?? '-')),
        error: (m, x) => console.log('LOG error ' + m + ' pct=' + x.heapUsedPct),
        debug: () => {},
      };
      startRuntimeDiagnostics({
        intervalMs: 25,
        heartbeatFile: ${JSON.stringify(heartbeatFile)},
        logger,
        warnPct: 30,
        errorPct: 60,
        getInFlight: () => ({ count: tracker.count(), list: tracker.list() }),
      });

      const hold = [];
      const leak = () => {
        for (let i = 0; i < 4000; i++) hold.push({ a: 'x'.repeat(40) + i, b: [i, i + 1, i + 2] });
        setTimeout(leak, 20);
      };
      leak();
      `,
      { nodeArgs: ['--max-old-space-size=96'], env: { DIAGNOSTICS_HEARTBEAT_FILE: heartbeatFile } },
    );

    assert.notEqual(crashing.status, 0, 'o processo deveria ter morrido por heap OOM');
    assert.match(crashing.stderr, /heap out of memory|Reached heap limit/i);
    // Alerta de aproximação do limite ANTES da morte, já apontando a rota suspeita.
    assert.match(crashing.stdout, /LOG (warn|error) process_memory pct=\d+/);
    assert.match(crashing.stdout, /inFlight=\/api\/massiva\/connections/);
    // E o abort não gerou nenhum log de saída (é a lacuna que o heartbeat cobre).
    assert.doesNotMatch(crashing.stdout, /process_exit/);

    const heartbeat = JSON.parse(fs.readFileSync(heartbeatFile, 'utf8'));
    assert.equal(heartbeat.cleanShutdown, false);
    assert.equal(heartbeat.inFlight[0].path, '/api/massiva/connections');

    // Boot 2: o novo processo lê o heartbeat e conta o que aconteceu.
    const nextBoot = runChild(
      `
      import { reportPreviousRun } from './lib/runtimeDiagnostics.js';
      const logger = {
        info: (m) => console.log('LOG info ' + m),
        error: (m, x) => console.log('LOG error ' + m + ' inFlight=' + x.inFlightAtLastHeartbeat?.[0]?.path + ' heapPct=' + x.lastMemory?.heapUsedPct),
      };
      reportPreviousRun({ file: ${JSON.stringify(heartbeatFile)}, logger });
      `,
    );

    assert.equal(nextBoot.status, 0);
    assert.match(nextBoot.stdout, /LOG error previous_run_ended_abnormally inFlight=\/api\/massiva\/connections heapPct=[\d.]+/);
  });
});
