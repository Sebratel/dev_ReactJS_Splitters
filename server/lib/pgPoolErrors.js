import defaultLogger from '../logger.js';

/**
 * `pg.Pool` é um EventEmitter: quando um client OCIOSO do pool sofre erro (rede caiu,
 * `terminating connection due to administrator command`, reset de TCP...) o pool emite
 * 'error'. Sem listener, o Node trata como exceção não capturada e o processo inteiro cai
 * (aqui via `uncaughtException` -> `process.exit(1)`). Este helper registra o listener que
 * o `pg` documenta como obrigatório: loga o erro (com o estado do pool) e deixa o pool
 * descartar o client quebrado e abrir outro sob demanda.
 */
export function attachPgPoolErrorHandler(
  pgPool,
  poolName,
  { getPoolStats = () => undefined, logger = defaultLogger } = {},
) {
  if (!pgPool || typeof pgPool.on !== 'function') return pgPool;

  pgPool.on('error', (error) => {
    logger.error('pg_pool_idle_client_error', {
      pool: poolName,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, code: error.code }
          : error,
      poolStats: getPoolStats(pgPool),
    });
  });
  return pgPool;
}
