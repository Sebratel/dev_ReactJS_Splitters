import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventReinclusionService, startEventReinclusionScheduler } from './eventReinclusionService.js';

const row = (id, eventType, eventProtocol, contractId, extra = {}) => ({
  id, eventType, eventProtocol, contractId, pppoe: `c${contractId}`, corporate: false, reason: 'motivo', finishDate: '2026-11-20 18:00:00', ...extra,
});

function setup({ pending, info, conflicts = [], addResult } = {}) {
  const calls = { add: [], reincluded: [], resolved: [], follow: [], conflictChecks: [] };
  const store = {
    configured: true,
    isReady: async () => true,
    listPending: async () => pending,
    markReincluded: async (ids) => calls.reincluded.push(ids),
    markResolved: async (ids, reason) => calls.resolved.push([ids, reason]),
  };
  const conflictsStore = {
    findOpenEventConflicts: async (ids, opts) => { calls.conflictChecks.push([ids, opts]); return { events: [], contractIds: conflicts }; },
  };
  const gateway = { configured: true, addClients: async (x) => { calls.add.push(x); return addResult ?? { ok: true, skippedContractIds: [] }; } };
  const eventInfo = { get: async () => info ?? { open: true, assignmentId: 77, finishDateNaive: '2026-11-20 19:00:00' } };
  const followUp = { massiva: async (x) => calls.follow.push(['massiva', x]), gmud: async (x) => calls.follow.push(['gmud', x]) };
  return { calls, store, conflictsStore, gateway, eventInfo, followUp };
}

const make = (f, env = {}) => createEventReinclusionService({ ...f, env: { EVENT_REINCLUSION_DRY_RUN: 'false', ...env } });

test('o outro evento fechou e o meu segue aberto: reinclui e registra no histórico local da massiva', async () => {
  const f = setup({ pending: [row(1, 'massiva', 1888, 10), row(2, 'massiva', 1888, 11)] });
  const r = await make(f).runOnce();
  assert.equal(r.reincluir.length, 1);
  assert.equal(f.calls.add.length, 1);
  assert.equal(f.calls.add[0].origin, 'MASSIVA');
  assert.equal(f.calls.add[0].createdBy, 'reinclusao');
  assert.equal(f.calls.add[0].protocol, 1888);
  assert.equal(f.calls.add[0].assignmentId, 77);
  assert.equal(f.calls.add[0].finishDateNaive, '2026-11-20 19:00:00');
  assert.deepEqual(f.calls.reincluded, [[1, 2]]);
  assert.equal(f.calls.follow[0][0], 'massiva');
  assert.deepEqual(f.calls.follow[0][1].clients.map((c) => c.contractId), [10, 11]);
  assert.deepEqual(f.calls.conflictChecks[0][1], { excludeProtocol: 1888 });
});

test('GMUD: reinclui com origin GMUD e atualiza o histórico da GMUD', async () => {
  const f = setup({ pending: [row(1, 'gmud', 1000, 10)] });
  await make(f).runOnce();
  assert.equal(f.calls.add[0].origin, 'GMUD');
  assert.equal(f.calls.follow[0][0], 'gmud');
  assert.deepEqual(f.calls.follow[0][1], { protocol: 1000, contractIds: [10] });
});

test('quem ainda está em outro evento espera; os livres voltam', async () => {
  const f = setup({ pending: [row(1, 'massiva', 1888, 10), row(2, 'massiva', 1888, 11)], conflicts: [11] });
  await make(f).runOnce();
  assert.deepEqual(f.calls.add[0].clients.map((c) => c.contractId), [10]);
  assert.deepEqual(f.calls.reincluded, [[1]]);
});

test('o gateway deixou alguns de fora de novo: só os gravados contam como reincluídos', async () => {
  const f = setup({ pending: [row(1, 'massiva', 1888, 10), row(2, 'massiva', 1888, 11)], addResult: { ok: true, skippedContractIds: [11] } });
  await make(f).runOnce();
  assert.deepEqual(f.calls.reincluded, [[1]]);
  assert.deepEqual(f.calls.follow[0][1].clients.map((c) => c.contractId), [10]);
});

test('evento encerrado: resolve sem reincluir', async () => {
  const f = setup({ pending: [row(1, 'massiva', 1888, 10)], info: { open: false } });
  const r = await make(f).runOnce();
  assert.equal(f.calls.add.length, 0);
  assert.deepEqual(f.calls.resolved, [[[1], 'evento_encerrado']]);
  assert.equal(r.resolver.length, 1);
  assert.equal(f.calls.conflictChecks.length, 0);
});

test('simulação (padrão): não chama o gateway nem grava', async () => {
  const f = setup({ pending: [row(1, 'massiva', 1888, 10)] });
  const r = await createEventReinclusionService({ ...f, env: {} }).runOnce();
  assert.equal(r.simulacao, true);
  assert.equal(r.reincluir.length, 1);
  assert.equal(f.calls.add.length, 0);
  assert.equal(f.calls.reincluded.length, 0);
});

test('falha do gateway não marca como reincluído', async () => {
  const f = setup({ pending: [row(1, 'massiva', 1888, 10)], addResult: { ok: false, reason: 'HTTP 502' } });
  const r = await make(f).runOnce();
  assert.equal(r.erros, 1);
  assert.equal(f.calls.reincluded.length, 0);
});

test('falha ao conferir conflitos pula o evento (tenta de novo no próximo ciclo)', async () => {
  const f = setup({ pending: [row(1, 'massiva', 1888, 10)] });
  f.conflictsStore.findOpenEventConflicts = async () => { throw new Error('banco fora'); };
  const r = await make(f).runOnce();
  assert.equal(r.erros, 1);
  assert.equal(f.calls.add.length, 0);
});

test('tabela ausente: não faz nada', async () => {
  const f = setup({ pending: [] });
  f.store.isReady = async () => false;
  assert.equal((await make(f).runOnce()).skipped, 'tabela_ausente');
});

test('scheduler: desligado por padrão e começa em simulação quando ligado', () => {
  const f = setup({ pending: [] });
  const svc = make(f);
  assert.equal(startEventReinclusionScheduler({ service: svc, store: f.store, gateway: f.gateway, env: {} }).started, false);
  const r = startEventReinclusionScheduler({
    service: svc, store: f.store, gateway: f.gateway, env: { EVENT_REINCLUSION_ENABLED: 'true' },
    setTimeoutFn: () => ({ unref() {} }), setIntervalFn: () => ({ unref() {} }),
  });
  assert.deepEqual(r, { started: true, dryRun: true });
});
