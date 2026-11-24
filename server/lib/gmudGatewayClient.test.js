import test from 'node:test';
import assert from 'node:assert/strict';
import { POST_CHUNK, createGmudGatewayClient } from './gmudGatewayClient.js';

const ENV = { GATEWAY_ORIGIN: 'https://gw.test/', GATEWAY_BASIC_AUTH_USER: 'u', GATEWAY_BASIC_AUTH_PASSWORD: 'p' };

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function recorder(responder) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers.Authorization });
    return responder(calls.length, url, init);
  };
  return { calls, fetchImpl };
}

const clients = (n) => Array.from({ length: n }, (_, i) => ({ contractId: i + 1, pppoe: `c${i + 1}`, corporate: false }));
const base = { protocol: 1000, assignmentId: 77, reason: 'Manutenção', finishDateNaive: '2026-11-20 05:00:00', createdNaive: '2026-11-20 02:00:00' };

test('não configurado quando faltam as variáveis do gateway', () => {
  assert.equal(createGmudGatewayClient({ env: {} }).configured, false);
  assert.equal(createGmudGatewayClient({ env: ENV }).configured, true);
});

test('addClients envia origin GMUD, datas ISO e autenticação básica', async () => {
  const r = recorder(() => res(201, { success: true, data: { skippedContractIds: [2] } }));
  const gw = createGmudGatewayClient({ env: ENV, fetchImpl: r.fetchImpl });
  const out = await gw.addClients({ ...base, clients: clients(2) });
  assert.deepEqual(out, { ok: true, skippedContractIds: [2] });
  const c = r.calls[0];
  assert.equal(c.url, 'https://gw.test/api/v1/afetados');
  assert.equal(c.method, 'POST');
  assert.match(c.auth, /^Basic /);
  assert.equal(c.body.assignmentId, 77);
  assert.equal(c.body.usuarioAfetadoEntities[0].origin, 'GMUD');
  assert.equal(c.body.usuarioAfetadoEntities[0].finishDate, '2026-11-20T05:00:00');
  assert.equal(c.body.usuarioAfetadoEntities[0].createdBy, 'gmud');
  assert.equal(c.body.includeConflicting, undefined);
});

test('addClients divide em lotes e junta os contratos deixados de fora', async () => {
  const r = recorder((n) => res(201, { success: true, data: { skippedContractIds: [n] } }));
  const gw = createGmudGatewayClient({ env: ENV, fetchImpl: r.fetchImpl });
  const out = await gw.addClients({ ...base, clients: clients(POST_CHUNK + 5) });
  assert.equal(r.calls.length, 2);
  assert.deepEqual(out.skippedContractIds.sort(), [1, 2]);
});

test('se um lote falha, limpa o que já entrou e devolve erro', async () => {
  const r = recorder((n, url, init) => {
    if (init.method === 'DELETE') return res(200, { success: true });
    return n === 1 ? res(201, { success: true, data: {} }) : res(502, { success: false, message: 'Bad gateway' });
  });
  const gw = createGmudGatewayClient({ env: ENV, fetchImpl: r.fetchImpl });
  const out = await gw.addClients({ ...base, clients: clients(POST_CHUNK + 5) });
  assert.equal(out.ok, false);
  assert.match(out.reason, /502/);
  assert.equal(r.calls.at(-1).method, 'DELETE');
  assert.equal(r.calls.at(-1).url, 'https://gw.test/api/v1/afetados/protocol/1000');
});

test('erro de rede também limpa e devolve erro', async () => {
  let n = 0;
  const gw = createGmudGatewayClient({
    env: ENV,
    fetchImpl: async (url, init) => { n += 1; if (init.method === 'POST') throw new Error('timeout'); return res(200, {}); },
  });
  const out = await gw.addClients({ ...base, clients: clients(1) });
  assert.equal(out.ok, false);
  assert.match(out.reason, /timeout/);
  assert.equal(n, 2);
});

test('removeByProtocol e updateFinishDate', async () => {
  const r = recorder(() => res(200, { success: true }));
  const gw = createGmudGatewayClient({ env: ENV, fetchImpl: r.fetchImpl });
  assert.deepEqual(await gw.removeByProtocol(1000), { ok: true });
  assert.deepEqual(await gw.updateFinishDate(1000, '2026-11-20 06:00:00'), { ok: true });
  assert.equal(r.calls[0].method, 'DELETE');
  assert.equal(r.calls[1].method, 'PATCH');
  assert.equal(r.calls[1].url, 'https://gw.test/api/v1/afetados/protocol/1000?finishDate=2026-11-20T06%3A00%3A00');
});

test('removeByProtocol: recusa do gateway vira erro com o motivo', async () => {
  const r = recorder(() => res(404, { success: false, message: 'nada' }));
  const gw = createGmudGatewayClient({ env: ENV, fetchImpl: r.fetchImpl });
  const out = await gw.removeByProtocol(1000);
  assert.equal(out.ok, false);
  assert.match(out.reason, /404/);
});
