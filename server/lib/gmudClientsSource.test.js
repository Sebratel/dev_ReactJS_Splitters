import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmudClientsSource } from './gmudClientsSource.js';

const row = (contrato, pppoe, extra = {}) => ({ contrato, pppoe, corporativo: false, 'PONTO DE ACESSO CODE': 'AP1', ...extra });

function source(rows, { throws = false, match } = {}) {
  const queries = [];
  const pool = { query: async (sql, params) => { queries.push(params); if (throws) throw new Error('pg fora'); return { rows }; } };
  const s = createGmudClientsSource({
    pool,
    baseQuery: 'SELECT 1',
    normalizeEscopoRotas: (cd) => (Array.isArray(cd?.escopoRotas) ? cd.escopoRotas : cd?.escopoRede ? [cd.escopoRede] : []).map((r) => ({ apCode: 'AP1', ...r })),
    rowMatchesEscopoRotas: match ?? (() => true),
  });
  return { s, queries };
}

test('site inteiro: todos os clientes com PPPoE e contrato, sem repetir contrato', async () => {
  const { s, queries } = source([row('10', 'ana'), row('10', 'ana'), row('11', 'beto', { corporativo: true }), row('x', 'sem-contrato'), row('12', '')]);
  const out = await s.listClients({ popSite: 'SLESC', categoriaData: null });
  assert.equal(out.ok, true);
  assert.deepEqual(out.clients, [
    { contractId: 10, pppoe: 'ana', corporate: false },
    { contractId: 11, pppoe: 'beto', corporate: true },
  ]);
  assert.deepEqual(queries[0], ['SLESC']);
});

test('com afunilamento só ficam as linhas que batem com o escopo', async () => {
  const { s } = source([row('10', 'ana', { slot: 1 }), row('11', 'beto', { slot: 2 })], { match: (r) => r.slot === 2 });
  const out = await s.listClients({ popSite: 'SLESC', categoriaData: { escopoRede: { apCode: 'AP1', slot: 2 } } });
  assert.deepEqual(out.clients.map((c) => c.contractId), [11]);
});

test('várias rotas: entra quem bate com qualquer uma', async () => {
  const { s } = source([row('10', 'ana', { slot: 1 }), row('11', 'beto', { slot: 2 }), row('12', 'caio', { slot: 3 })], {
    match: (r, rotas) => rotas.some((x) => x.slot === r.slot),
  });
  const out = await s.listClients({ popSite: 'SLESC', categoriaData: { escopoRotas: [{ slot: 1 }, { slot: 3 }] } });
  assert.deepEqual(out.clients.map((c) => c.contractId), [10, 12]);
});

test('sem POP/Site não há como localizar os clientes', async () => {
  const { s } = source([]);
  const out = await s.listClients({ popSite: '  ' });
  assert.equal(out.ok, false);
});

test('falha do banco vira erro, sem lançar', async () => {
  const { s } = source([], { throws: true });
  const out = await s.listClients({ popSite: 'SLESC' });
  assert.equal(out.ok, false);
  assert.match(out.reason, /pg fora/);
});
