import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMassivaHistoryStore } from './massivaHistoryStore.js';

describe('createMassivaHistoryStore — sem MySQL configurado', () => {
  it('getStaleIncompleteHistory devolve lista vazia em vez de lançar', async () => {
    const store = createMassivaHistoryStore({ host: '', port: '', user: '', password: '', database: '' });
    assert.equal(store.configured, false);
    const stale = await store.getStaleIncompleteHistory(1);
    assert.deepEqual(stale, []);
  });
});
