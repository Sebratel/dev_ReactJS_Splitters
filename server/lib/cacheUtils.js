/**
 * Remove do cache entradas mais velhas que `ttlMs`. Sem isso, caches cuja chave inclui
 * um valor de alta cardinalidade (ex.: timestamp de evento) crescem sem limite — cada
 * chave nova nunca e removida, so fica "obsoleta" e ignorada na leitura, mas continua
 * ocupando memoria para sempre. Rodar antes de cada `.set()` mantem o cache limitado ao
 * que ainda esta dentro do TTL.
 * @param {Map<string, { at: number }>} map
 * @param {number} ttlMs
 * @param {number} [now]
 */
export function pruneExpiredCacheEntries(map, ttlMs, now = Date.now()) {
  for (const [key, entry] of map) {
    if (now - entry.at >= ttlMs) map.delete(key);
  }
}
