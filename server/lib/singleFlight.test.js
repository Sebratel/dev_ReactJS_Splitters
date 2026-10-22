import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSingleFlight } from './singleFlight.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSingleFlight', () => {
  it('chamadas simultâneas compartilham UMA execução', async () => {
    const flight = createSingleFlight();
    const gate = deferred();
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return gate.promise;
    };

    const pending = [flight.run('k', loader), flight.run('k', loader), flight.run('k', loader)];
    assert.equal(flight.inflightCount(), 1);
    gate.resolve('resultado');
    const results = await Promise.all(pending);

    assert.equal(calls, 1);
    assert.deepEqual(results.map((r) => r.value), ['resultado', 'resultado', 'resultado']);
    assert.deepEqual(results.map((r) => r.shared).sort(), [false, true, true]);
    assert.equal(flight.inflightCount(), 0);
  });

  it('não guarda resultado: a chamada seguinte executa de novo', async () => {
    const flight = createSingleFlight();
    let calls = 0;
    const loader = async () => ++calls;

    const first = await flight.run('k', loader);
    const second = await flight.run('k', loader);

    assert.deepEqual([first.value, first.shared], [1, false]);
    assert.deepEqual([second.value, second.shared], [2, false]);
  });

  it('erro: quem esperava recebe o erro, nada fica preso e a próxima tenta de novo', async () => {
    const flight = createSingleFlight();
    const gate = deferred();
    let calls = 0;
    const failing = async () => {
      calls += 1;
      return gate.promise;
    };

    const a = flight.run('k', failing);
    const b = flight.run('k', failing);
    gate.reject(new Error('banco caiu'));
    await assert.rejects(a, /banco caiu/);
    await assert.rejects(b, /banco caiu/);
    assert.equal(calls, 1);
    assert.equal(flight.inflightCount(), 0);

    const retry = await flight.run('k', async () => 'ok');
    assert.deepEqual([retry.value, retry.shared], ['ok', false]);
  });

  it('loader que lança de forma síncrona vira rejeição e libera a chave', async () => {
    const flight = createSingleFlight();
    await assert.rejects(
      flight.run('k', () => {
        throw new Error('sync');
      }),
      /sync/,
    );
    assert.equal(flight.inflightCount(), 0);
  });

  it('chaves diferentes não se bloqueiam', async () => {
    const flight = createSingleFlight();
    const gateA = deferred();
    const a = flight.run('a', () => gateA.promise);
    const b = await flight.run('b', async () => 'B');
    assert.equal(b.value, 'B');
    assert.equal(flight.inflightCount(), 1);
    gateA.resolve('A');
    assert.equal((await a).value, 'A');
  });
});
