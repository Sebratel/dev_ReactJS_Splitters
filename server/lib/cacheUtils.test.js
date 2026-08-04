import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pruneExpiredCacheEntries } from './cacheUtils.js';

describe('pruneExpiredCacheEntries', () => {
  it('remove entradas mais velhas que o TTL', () => {
    const now = 1_000_000;
    const map = new Map([
      ['expirada', { at: now - 20_000 }],
      ['recente', { at: now - 1_000 }],
    ]);

    pruneExpiredCacheEntries(map, 10_000, now);

    assert.equal(map.has('expirada'), false);
    assert.equal(map.has('recente'), true);
  });

  it('mantem entrada exatamente na borda do TTL como expirada (>=)', () => {
    const now = 1_000_000;
    const map = new Map([['borda', { at: now - 10_000 }]]);

    pruneExpiredCacheEntries(map, 10_000, now);

    assert.equal(map.has('borda'), false);
  });

  it('nao remove nada quando todas as entradas estao dentro do TTL', () => {
    const now = 1_000_000;
    const map = new Map([
      ['a', { at: now - 1 }],
      ['b', { at: now }],
    ]);

    pruneExpiredCacheEntries(map, 10_000, now);

    assert.equal(map.size, 2);
  });

  it('usa Date.now() quando `now` nao e informado', () => {
    const map = new Map([['antiga', { at: Date.now() - 100_000 }]]);

    pruneExpiredCacheEntries(map, 1_000);

    assert.equal(map.has('antiga'), false);
  });

  it('nao cresce sem limite: simula chaves de alta cardinalidade expirando', () => {
    const now = 1_000_000;
    const map = new Map();
    for (let i = 0; i < 500; i += 1) {
      map.set(`evento-${i}`, { at: now - 20_000 });
    }
    map.set('evento-novo', { at: now });

    pruneExpiredCacheEntries(map, 10_000, now);

    assert.equal(map.size, 1);
    assert.equal(map.has('evento-novo'), true);
  });
});
