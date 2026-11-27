import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeClientesLista } from './gmudClientesLista.js';

test('ordena por nome, marca corporativos e não vaza o PPPoE', () => {
  const r = serializeClientesLista([
    { contractId: 2, pppoe: 'segredo', nome: 'Zeca', corporate: false, pontoAcesso: 'CTO 1' },
    { contractId: 1, pppoe: 'segredo', nome: ' Ana ', corporate: true, pontoAcesso: '' },
  ]);
  assert.equal(r.total, 2);
  assert.equal(r.truncado, false);
  assert.deepEqual(r.clientes.map((c) => c.nome), ['Ana', 'Zeca']);
  assert.equal(r.clientes[0].corporativo, true);
  assert.equal('pppoe' in r.clientes[0], false);
});

test('corta no limite e avisa que truncou', () => {
  const clients = Array.from({ length: 5 }, (_, i) => ({ contractId: i + 1, nome: `C${i}` }));
  const r = serializeClientesLista(clients, 3);
  assert.equal(r.total, 5);
  assert.equal(r.truncado, true);
  assert.equal(r.clientes.length, 3);
});

test('entrada inválida vira lista vazia', () => {
  assert.deepEqual(serializeClientesLista(null), { total: 0, truncado: false, clientes: [] });
});
