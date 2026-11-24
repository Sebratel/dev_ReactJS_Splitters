import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupMassivaAffected,
  finalizeMassivaInElleven,
  isMassivaGatewayConfigured,
  nowBrazilIsoLike,
} from './massivaEllevenClose.js';

const ENV = { GATEWAY_ORIGIN: 'https://gw.example/', GATEWAY_BASIC_AUTH_USER: 'u', GATEWAY_BASIC_AUTH_PASSWORD: 'p' };
const okFetch = (calls) => async (url, init) => {
  calls.push({ url, init });
  return { ok: true, status: 200 };
};

test('sem gateway configurado: notConfigured e nenhuma chamada', async () => {
  const calls = [];
  const r = await finalizeMassivaInElleven(
    { assignmentId: 1, description: 'x', mode: 'encerrar' },
    { env: {}, fetchImpl: okFetch(calls) },
  );
  assert.equal(r.ok, false);
  assert.equal(r.notConfigured, true);
  assert.equal(calls.length, 0);
  assert.equal(isMassivaGatewayConfigured({}), false);
  assert.equal(isMassivaGatewayConfigured(ENV), true);
});

test('encerrar usa status 4 e o caminho padrão; cancelar usa 8', async () => {
  const calls = [];
  await finalizeMassivaInElleven({ assignmentId: 123, description: 'fim', mode: 'encerrar' }, { env: ENV, fetchImpl: okFetch(calls) });
  await finalizeMassivaInElleven({ assignmentId: 123, description: 'erro', mode: 'cancelar' }, { env: ENV, fetchImpl: okFetch(calls) });
  assert.equal(calls[0].url, 'https://gw.example/api/v1/massivas/finalizar-chamado-via-api');
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(JSON.parse(calls[0].init.body).incidentStatusId, '4');
  assert.equal(JSON.parse(calls[1].init.body).incidentStatusId, '8');
  assert.equal(JSON.parse(calls[0].init.body).assignmentId, '123');
  assert.match(calls[0].init.headers.Authorization, /^Basic /);
});

test('recusa do gateway e erro de rede viram ok:false com motivo', async () => {
  const r1 = await finalizeMassivaInElleven(
    { assignmentId: 1, description: 'x', mode: 'encerrar' },
    { env: ENV, fetchImpl: async () => ({ ok: false, status: 502 }) },
  );
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /502/);
  const r2 = await finalizeMassivaInElleven(
    { assignmentId: 1, description: 'x', mode: 'encerrar' },
    { env: ENV, fetchImpl: async () => { throw new Error('timeout'); } },
  );
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /timeout/);
});

test('assignmentId inválido não chama o gateway', async () => {
  const calls = [];
  const r = await finalizeMassivaInElleven({ assignmentId: 0, description: 'x', mode: 'encerrar' }, { env: ENV, fetchImpl: okFetch(calls) });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('limpeza de afetados: monta a URL do protocolo e nunca lança', async () => {
  const calls = [];
  const r = await cleanupMassivaAffected({ protocol: 1873598 }, { env: ENV, fetchImpl: okFetch(calls) });
  assert.equal(r.ok, true);
  assert.equal(calls[0].url, 'https://gw.example/api/v1/afetados/protocol/1873598');
  const f = await cleanupMassivaAffected({ protocol: 1 }, { env: ENV, fetchImpl: async () => { throw new Error('x'); } });
  assert.equal(f.ok, false);
});

test('nowBrazilIsoLike: formato yyyy-MM-ddTHH:mm:ss em Brasília', () => {
  assert.equal(nowBrazilIsoLike(new Date('2026-11-06T15:30:05Z')), '2026-11-06T12:30:05');
  assert.match(nowBrazilIsoLike(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
});
