import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withRowLock } from './rowLock.js';

/** Simula select-depois-insert: lê o estado, espera um pouco (I/O), decide e grava. */
function makeFindThenInsert(store) {
  return async (key) => {
    const existing = store.get(key);
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (existing === undefined) {
      store.set(key, 1);
      return 'inserted';
    }
    store.set(key, existing + 1);
    return 'updated';
  };
}

describe('withRowLock', () => {
  it('serializa duas chamadas concorrentes para a MESMA chave — só uma insere', async () => {
    const store = new Map();
    const findThenInsert = makeFindThenInsert(store);

    const [first, second] = await Promise.all([
      withRowLock('assignment:2001', () => findThenInsert('assignment:2001')),
      withRowLock('assignment:2001', () => findThenInsert('assignment:2001')),
    ]);

    // Sem a trava, as duas rodam em paralelo, acham `existing === undefined` nas
    // duas e as duas retornam 'inserted' — duplicando a linha no histórico.
    assert.deepEqual([first, second].sort(), ['inserted', 'updated']);
    assert.equal(store.get('assignment:2001'), 2);
  });

  it('chaves diferentes não se bloqueiam entre si', async () => {
    const store = new Map();
    const findThenInsert = makeFindThenInsert(store);

    const results = await Promise.all([
      withRowLock('assignment:3001', () => findThenInsert('assignment:3001')),
      withRowLock('assignment:3002', () => findThenInsert('assignment:3002')),
    ]);

    assert.deepEqual(results, ['inserted', 'inserted']);
  });

  it('uma falha numa chamada não trava as próximas chamadas da mesma chave', async () => {
    await assert.rejects(
      withRowLock('assignment:4001', async () => {
        throw new Error('MySQL fora');
      }),
      /MySQL fora/,
    );

    const result = await withRowLock('assignment:4001', async () => 'ok-depois-da-falha');
    assert.equal(result, 'ok-depois-da-falha');
  });
});
