import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackReason, groupPendingByEvent, planGroup, readReinclusionConfig } from './eventReinclusion.js';

const row = (eventType, eventProtocol, contractId) => ({ eventType, eventProtocol, contractId });

test('config: desligada por padrão e em simulação', () => {
  const c = readReinclusionConfig({});
  assert.equal(c.enabled, false);
  assert.equal(c.dryRun, true);
  assert.equal(c.intervalMinutes, 5);
  assert.equal(readReinclusionConfig({ EVENT_REINCLUSION_ENABLED: 'true', EVENT_REINCLUSION_DRY_RUN: 'false', EVENT_REINCLUSION_INTERVAL_MINUTES: '0' }).intervalMinutes, 1);
});

test('agrupa por evento e ignora linhas inválidas', () => {
  const groups = groupPendingByEvent([
    row('massiva', 1888, 1), row('massiva', 1888, 2), row('gmud', 1000, 3),
    row('outro', 5, 1), row('massiva', 0, 1), row('massiva', 1888, 0), null,
  ]);
  assert.deepEqual(groups.map((g) => [g.key, g.rows.length]), [['massiva:1888', 2], ['gmud:1000', 1]]);
});

test('evento encerrado: resolve sem reincluir', () => {
  const [g] = groupPendingByEvent([row('massiva', 1888, 1)]);
  assert.deepEqual(planGroup({ group: g, info: { open: false } }), { action: 'resolver', reason: 'evento_encerrado' });
  assert.equal(planGroup({ group: g, info: null }).action, 'resolver');
});

test('o outro evento fechou e o meu segue aberto: reinclui', () => {
  const [g] = groupPendingByEvent([row('massiva', 1888, 1), row('massiva', 1888, 2)]);
  const plan = planGroup({ group: g, info: { open: true, assignmentId: 77 }, blockedContractIds: new Set() });
  assert.equal(plan.action, 'reincluir');
  assert.equal(plan.free.length, 2);
});

test('quem ainda está em outro evento espera; os livres voltam', () => {
  const [g] = groupPendingByEvent([row('massiva', 1888, 1), row('massiva', 1888, 2)]);
  const plan = planGroup({ group: g, info: { open: true, assignmentId: 77 }, blockedContractIds: new Set([2]) });
  assert.equal(plan.action, 'reincluir');
  assert.deepEqual(plan.free.map((r) => r.contractId), [1]);
  assert.deepEqual(plan.waiting.map((r) => r.contractId), [2]);
});

test('todos ainda bloqueados: espera', () => {
  const [g] = groupPendingByEvent([row('gmud', 1000, 1)]);
  assert.equal(planGroup({ group: g, info: { open: true, assignmentId: 5 }, blockedContractIds: new Set([1]) }).action, 'esperar');
});

test('sem assignment não dá para reincluir: espera', () => {
  const [g] = groupPendingByEvent([row('massiva', 1888, 1)]);
  const plan = planGroup({ group: g, info: { open: true, assignmentId: null } });
  assert.equal(plan.action, 'esperar');
  assert.equal(plan.reason, 'sem_assignment');
});

test('motivo padrão por tipo de evento', () => {
  assert.match(fallbackReason('gmud', 1000), /GMUD 1000/);
  assert.match(fallbackReason('massiva', 1888), /1888/);
});
