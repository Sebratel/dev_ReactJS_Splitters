import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import defaultLogger from '../logger.js';

/**
 * Diagnóstico de runtime — existe para o caso em que o processo Node MORRE sem deixar
 * causa nos logs (ex.: estouro do heap do V8, que aborta o processo sem passar por
 * `uncaughtException`). Como o processo não consegue logar a própria morte, a estratégia é:
 *
 *  1. amostrar memória/event loop periodicamente (`process_memory`), alertando ANTES do limite;
 *  2. gravar um heartbeat em disco a cada amostra (última memória + requisições em voo);
 *  3. no próximo boot, ler o heartbeat e logar `previous_run_ended_abnormally` com o que
 *     estava acontecendo quando o processo parou de dar sinal de vida.
 *
 * Puramente observacional: nunca altera resposta, status ou fluxo das rotas.
 */

const MB = 1024 * 1024;

const toMb = (bytes) => Math.round((bytes / MB) * 10) / 10;

export function defaultHeartbeatPath() {
  return (
    process.env.DIAGNOSTICS_HEARTBEAT_FILE ||
    path.join(os.tmpdir(), 'splitters-bff-heartbeat.json')
  );
}

/** Snapshot barato e síncrono da memória do processo, já em MB e com % do limite do heap. */
export function getMemorySnapshot() {
  const usage = process.memoryUsage();
  const heapLimit = v8.getHeapStatistics().heap_size_limit;
  return {
    rssMb: toMb(usage.rss),
    heapUsedMb: toMb(usage.heapUsed),
    heapTotalMb: toMb(usage.heapTotal),
    heapLimitMb: toMb(heapLimit),
    heapUsedPct: Math.round((usage.heapUsed / heapLimit) * 1000) / 10,
    externalMb: toMb(usage.external),
    arrayBuffersMb: toMb(usage.arrayBuffers),
  };
}

/**
 * Registro das requisições HTTP em andamento. `begin()` devolve a função `end()` que deve
 * ser chamada no `close` da resposta (cobre finish e abort do cliente).
 */
export function createInFlightTracker(now = Date.now) {
  const active = new Map();
  let seq = 0;

  return {
    begin(meta) {
      seq += 1;
      const key = seq;
      active.set(key, { ...meta, startedAt: now() });
      return () => {
        active.delete(key);
      };
    },
    count: () => active.size,
    /** As N mais antigas — são as suspeitas quando o processo morre no meio delas. */
    list(limit = 10) {
      const t = now();
      return [...active.values()]
        .sort((a, b) => a.startedAt - b.startedAt)
        .slice(0, limit)
        .map((entry) => ({ ...entry, ageMs: t - entry.startedAt }));
    },
  };
}

function chunkBytes(chunk, encoding) {
  if (chunk == null) return 0;
  if (typeof chunk === 'string') {
    return Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : 'utf8');
  }
  return chunk.length ?? 0;
}

/** Conta os bytes escritos na resposta sem alterar o que é enviado. Devolve um getter. */
export function countResponseBytes(res) {
  let bytes = 0;
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function patchedWrite(chunk, encoding, ...rest) {
    bytes += chunkBytes(chunk, encoding);
    return originalWrite.call(this, chunk, encoding, ...rest);
  };
  res.end = function patchedEnd(chunk, encoding, ...rest) {
    if (typeof chunk !== 'function') bytes += chunkBytes(chunk, encoding);
    return originalEnd.call(this, chunk, encoding, ...rest);
  };

  return () => bytes;
}

function writeHeartbeat(file, payload) {
  try {
    fs.writeFileSync(file, JSON.stringify(payload));
  } catch {
    // Diagnóstico nunca pode derrubar a aplicação (disco cheio, somente leitura etc.).
  }
}

/**
 * Chamar UMA vez no boot, antes de `startRuntimeDiagnostics` (que sobrescreve o arquivo).
 * Só enxerga a execução anterior se o filesystem do container sobreviveu (restart do
 * Docker/restart policy — sim; recriação do container no redeploy — não).
 */
export function reportPreviousRun({
  file = defaultHeartbeatPath(),
  logger = defaultLogger,
} = {}) {
  let previous;
  try {
    previous = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!previous || typeof previous !== 'object') return null;

  if (previous.cleanShutdown) {
    logger.info('previous_run_ended_cleanly', {
      previousPid: previous.pid,
      signal: previous.signal ?? null,
      lastHeartbeatAt: previous.updatedAt,
    });
    return { abnormal: false, previous };
  }

  logger.error('previous_run_ended_abnormally', {
    hint:
      'O processo anterior parou sem shutdown limpo (sem SIGTERM/SIGINT). Causas típicas: ' +
      'heap OOM do V8 (abort sem uncaughtException), SIGKILL/OOM-killer do container ou process.exit.',
    previousPid: previous.pid,
    lastHeartbeatAt: previous.updatedAt,
    msSinceLastHeartbeat: previous.updatedAt
      ? Date.now() - new Date(previous.updatedAt).getTime()
      : null,
    lastMemory: previous.memory,
    lastEventLoop: previous.eventLoop,
    inFlightAtLastHeartbeat: previous.inFlight,
    inFlightCount: previous.inFlightCount,
    exitCode: previous.exitCode ?? null,
  });
  return { abnormal: true, previous };
}

/**
 * Inicia a amostragem periódica. O timer é `unref`'d (não segura o processo vivo).
 * Loga `process_memory` a cada `infoEveryMs` em condições normais, e a CADA amostra quando o
 * heap passa de `warnPct` (warn) ou `errorPct` (error) — janela fina justamente quando o
 * processo está se aproximando do limite.
 */
export function startRuntimeDiagnostics({
  intervalMs = 5000,
  infoEveryMs = 60000,
  warnPct = 70,
  errorPct = 85,
  heartbeatFile = defaultHeartbeatPath(),
  logger = defaultLogger,
  getInFlight = () => ({ count: 0, list: [] }),
  getPoolStats = () => undefined,
  getMemory = getMemorySnapshot,
  installProcessHooks = true,
} = {}) {
  const bootAt = new Date().toISOString();
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();
  let lastInfoAt = 0;
  let stopped = false;

  const state = { signal: null, exitCode: null, cleanShutdown: false };

  function buildHeartbeat(memory, inFlight) {
    return {
      pid: process.pid,
      bootAt,
      updatedAt: new Date().toISOString(),
      uptimeS: Math.round(process.uptime()),
      memory,
      eventLoop: {
        p99Ms: Math.round((eventLoop.percentile(99) / 1e6) * 10) / 10,
        maxMs: Math.round((eventLoop.max / 1e6) * 10) / 10,
      },
      inFlightCount: inFlight.count,
      inFlight: inFlight.list,
      cleanShutdown: state.cleanShutdown,
      signal: state.signal,
      exitCode: state.exitCode,
    };
  }

  function sample() {
    const memory = getMemory();
    const inFlight = getInFlight();
    const heartbeat = buildHeartbeat(memory, inFlight);
    writeHeartbeat(heartbeatFile, heartbeat);

    const level =
      memory.heapUsedPct >= errorPct ? 'error' : memory.heapUsedPct >= warnPct ? 'warn' : 'info';
    const nowMs = Date.now();
    if (level === 'info' && nowMs - lastInfoAt < infoEveryMs) {
      eventLoop.reset();
      return heartbeat;
    }
    lastInfoAt = nowMs;

    logger[level]('process_memory', {
      ...memory,
      eventLoop: heartbeat.eventLoop,
      inFlightCount: inFlight.count,
      // Só detalha as requisições quando há risco — em operação normal é ruído.
      inFlight: level === 'info' ? undefined : inFlight.list,
      poolStats: getPoolStats(),
      uptimeS: heartbeat.uptimeS,
    });
    eventLoop.reset();
    return heartbeat;
  }

  const timer = setInterval(sample, intervalMs);
  timer.unref();

  function markStopped(extra) {
    Object.assign(state, extra);
    writeHeartbeat(heartbeatFile, buildHeartbeat(getMemory(), getInFlight()));
  }

  const hooks = {};
  if (installProcessHooks) {
    hooks.exit = (code) => {
      // `exit` NÃO dispara em abort do V8 (heap OOM) — por isso o heartbeat existe.
      // Dispara em process.exit()/fim natural; registra o código sem marcar como limpo.
      markStopped({ exitCode: code });
      logger.warn('process_exit', { code, memory: getMemory() });
    };
    hooks.signal = (signal) => {
      logger.warn('process_signal', { signal, memory: getMemory(), inFlight: getInFlight().list });
      markStopped({ signal, cleanShutdown: true });
      process.exit(0);
    };
    hooks.warning = (warning) => {
      logger.warn('process_warning', { name: warning?.name, message: warning?.message });
    };
    process.on('exit', hooks.exit);
    process.on('SIGTERM', hooks.signal);
    process.on('SIGINT', hooks.signal);
    process.on('warning', hooks.warning);
  }

  sample();

  return {
    sample,
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      eventLoop.disable();
      if (installProcessHooks) {
        process.off('exit', hooks.exit);
        process.off('SIGTERM', hooks.signal);
        process.off('SIGINT', hooks.signal);
        process.off('warning', hooks.warning);
      }
    },
  };
}
