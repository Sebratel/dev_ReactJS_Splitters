import crypto from 'node:crypto';
import logger from '../logger.js';

/**
 * Observabilidade aditiva e reutilizável para pools mysql2/promise.
 *
 * Este backend tem HOJE vários pools MySQL independentes apontando para o
 * mesmo servidor físico (massivaHistoryStore.js, usageAnalyticsStore.js,
 * platformSuggestionsStore.js, isaPromptConfigStore.js,
 * lib/platformSuggestionsSync.js) — cada um com seu próprio
 * `connectionLimit`, sem visibilidade um do outro. `instrumentMysqlPool`
 * aplica, num único ponto por pool, o mesmo padrão já usado em
 * massivaHistoryStore.js: log de início/fim/erro por query (com id de
 * correlação, gerado ANTES do await, para que uma query travada apareça nos
 * logs como um 'query_start' sem 'query_finish'/'query_error'
 * correspondente) e um snapshot periódico (`pool_stats`) do estado do pool.
 *
 * Puramente observacional: nunca muda o valor retornado, nunca engole erro
 * (sempre relança), nunca altera `connectionLimit`/`queueLimit`/timeouts.
 */

function previewSql(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * Lê `_allConnections`/`_freeConnections`/`_connectionQueue` do pool "core"
 * do mysql2 (`pool.pool`, ver mysql2/lib/promise/pool.js e
 * mysql2/lib/base/pool.js) — mesma introspecção já usada e documentada em
 * massivaHistoryStore.js. Defensivo: nunca lança, mesmo se a versão instalada
 * mudar esses nomes internos (fallback para zeros).
 */
export function getMysqlPoolStats(dataPool) {
  const corePool = dataPool?.pool;
  const total = corePool?._allConnections?.length ?? 0;
  const idle = corePool?._freeConnections?.length ?? 0;
  const waiting = corePool?._connectionQueue?.length ?? 0;
  return { total, inUse: Math.max(0, total - idle), idle, waiting };
}

/**
 * Envolve `dataPool.query` com log e inicia o snapshot periódico
 * (~7s, timer unref'd — não mantém o processo vivo nem atrapalha testes).
 * Retorna o próprio `dataPool` (encadeável: `dataPool = instrumentMysqlPool(mysql.createPool(...), 'nome')`).
 */
export function instrumentMysqlPool(dataPool, poolName) {
  if (!dataPool || typeof dataPool.query !== 'function') return dataPool;

  const originalQuery = dataPool.query.bind(dataPool);

  dataPool.query = (...args) => {
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const text = typeof args[0] === 'string' ? args[0] : args[0]?.sql;

    logger.debug('query_start', {
      id,
      pool: poolName,
      sql: previewSql(text),
      timestamp: new Date(startedAt).toISOString(),
      poolStats: getMysqlPoolStats(dataPool),
      paramCount: args[1]?.length ?? 0,
    });

    return originalQuery(...args).then(
      (value) => {
        const resultShape = {};
        if (Array.isArray(value?.[0])) {
          resultShape.rowCount = value[0].length;
        } else if (value?.[0]?.affectedRows !== undefined) {
          resultShape.affectedRows = value[0].affectedRows;
          if (value[0].insertId !== undefined) resultShape.insertId = value[0].insertId;
        }
        logger.debug('query_finish', {
          id,
          pool: poolName,
          sql: previewSql(text),
          durationMs: Date.now() - startedAt,
          ok: true,
          poolStats: getMysqlPoolStats(dataPool),
          ...resultShape,
        });
        return value;
      },
      (error) => {
        logger.error('query_error', {
          id,
          pool: poolName,
          sql: previewSql(text),
          durationMs: Date.now() - startedAt,
          ok: false,
          error: error instanceof Error ? { name: error.name, message: error.message } : error,
        });
        throw error;
      },
    );
  };

  const intervalHandle = setInterval(() => {
    logger.info('pool_stats', { pool: poolName, ...getMysqlPoolStats(dataPool) });
  }, 7000);
  intervalHandle.unref?.();

  return dataPool;
}
