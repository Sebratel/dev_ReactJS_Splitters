import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNC_STATUS,
  brazilNowNaive,
  buildClientReason,
  gmudWindow,
  inactiveReason,
  isNetworkGmud,
  planClientSync,
  readClientSyncConfig,
  toLocalDateTimeIso,
} from './gmudClientSync.js';

const gmud = (extra = {}) => ({
  voalleProtocol: 1000,
  assignmentId: 77,
  categoria: 'rede_externa',
  titulo: 'Troca de OLT',
  statusComite: 'aprovada',
  statusAreas: 'aprovada',
  statusExec: 'pendente',
  ellevenEncerradoEm: null,
  dataInicio: '2026-11-20',
  horaInicio: '02:00',
  dataFim: '2026-11-20',
  horaFim: '05:00',
  ...extra,
});

const DURANTE = '2026-11-20 03:00:00';

test('config: desligado por padrão e em simulação quando ligado', () => {
  const c = readClientSyncConfig({});
  assert.equal(c.enabled, false);
  assert.equal(c.dryRun, true);
  assert.equal(c.intervalMinutes, 5);
  const on = readClientSyncConfig({ GMUD_CLIENTES_SYNC_ENABLED: 'true', GMUD_CLIENTES_SYNC_DRY_RUN: 'false', GMUD_CLIENTES_SYNC_INTERVAL_MINUTES: '9999' });
  assert.equal(on.enabled, true);
  assert.equal(on.dryRun, false);
  assert.equal(on.intervalMinutes, 1440);
});

test('brazilNowNaive usa o horário de Brasília', () => {
  assert.equal(brazilNowNaive(new Date('2026-11-20T05:30:15Z')), '2026-11-20 02:30:15');
});

test('gmudWindow: início/fim com hora e fallback', () => {
  assert.deepEqual(gmudWindow(gmud()), { start: '2026-11-20 02:00:00', end: '2026-11-20 05:00:00' });
  assert.deepEqual(gmudWindow(gmud({ horaInicio: null, horaFim: null, dataFim: null })), { start: '2026-11-20 00:00:00', end: '2026-11-20 23:59:00' });
  assert.equal(gmudWindow(gmud({ dataInicio: null })), null);
});

test('isNetworkGmud: rede externa e legado sim; sistemas não', () => {
  assert.equal(isNetworkGmud(gmud()), true);
  assert.equal(isNetworkGmud(gmud({ categoria: null })), true);
  assert.equal(isNetworkGmud(gmud({ categoria: 'sistemas_internos' })), false);
});

test('inactiveReason cobre cada motivo', () => {
  assert.equal(inactiveReason(gmud(), DURANTE), null);
  assert.equal(inactiveReason(null, DURANTE), 'gmud_nao_encontrada');
  assert.equal(inactiveReason(gmud({ categoria: 'sistemas_externos' }), DURANTE), 'categoria_sem_clientes');
  assert.equal(inactiveReason(gmud({ statusAreas: 'negada' }), DURANTE), 'negada');
  assert.equal(inactiveReason(gmud({ ellevenEncerradoEm: '2026-11-20T04:00:00Z' }), DURANTE), 'encerrada');
  assert.equal(inactiveReason(gmud({ statusExec: 'concluida' }), DURANTE), 'encerrada');
  assert.equal(inactiveReason(gmud({ statusComite: 'pendente' }), DURANTE), 'nao_liberada');
  assert.equal(inactiveReason(gmud({ statusAreas: 'pendente' }), DURANTE), 'nao_liberada');
  assert.equal(inactiveReason(gmud(), '2026-11-20 01:59:59'), 'antes_da_janela');
  assert.equal(inactiveReason(gmud(), '2026-11-20 05:00:00'), 'fora_da_janela');
  assert.equal(inactiveReason(gmud({ assignmentId: null }), DURANTE), 'sem_assignment');
  assert.equal(inactiveReason(gmud({ dataInicio: null }), DURANTE), 'sem_janela');
});

test('plan: GMUD ativa e ainda não incluída entra', () => {
  const g = gmud();
  const plan = planClientSync({ candidates: [g], states: new Map(), nowNaive: DURANTE });
  assert.deepEqual(plan.include.map((x) => x.voalleProtocol), [1000]);
  assert.equal(plan.remove.length, 0);
});

test('plan: já incluída e ainda ativa não faz nada', () => {
  const g = gmud();
  const states = new Map([[1000, { status: SYNC_STATUS.INCLUIDA, windowEnd: '2026-11-20 05:00:00' }]]);
  const plan = planClientSync({ candidates: [g], states, nowNaive: DURANTE });
  assert.equal(plan.include.length, 0);
  assert.equal(plan.remove.length, 0);
  assert.equal(plan.updateFinish.length, 0);
});

test('plan: fim da janela remove os clientes', () => {
  const g = gmud();
  const states = new Map([[1000, { status: SYNC_STATUS.INCLUIDA, windowEnd: '2026-11-20 05:00:00' }]]);
  const plan = planClientSync({ candidates: [], gmudByProtocol: new Map([[1000, g]]), states, nowNaive: '2026-11-20 05:00:00' });
  assert.deepEqual(plan.remove, [{ protocol: 1000, reason: 'fora_da_janela' }]);
});

test('plan: encerrada/negada/reprovada depois da inclusão também remove', () => {
  const states = new Map([[1000, { status: SYNC_STATUS.INCLUIDA, windowEnd: '2026-11-20 05:00:00' }]]);
  for (const [extra, reason] of [
    [{ ellevenEncerradoEm: 'x' }, 'encerrada'],
    [{ statusAreas: 'negada' }, 'negada'],
    [{ statusComite: 'pendente' }, 'nao_liberada'],
  ]) {
    const plan = planClientSync({ gmudByProtocol: new Map([[1000, gmud(extra)]]), states, nowNaive: DURANTE });
    assert.deepEqual(plan.remove, [{ protocol: 1000, reason }]);
  }
});

test('plan: incluída cuja GMUD sumiu é removida', () => {
  const states = new Map([[1000, { status: SYNC_STATUS.INCLUIDA, windowEnd: '2026-11-20 05:00:00' }]]);
  const plan = planClientSync({ states, nowNaive: DURANTE });
  assert.deepEqual(plan.remove, [{ protocol: 1000, reason: 'gmud_nao_encontrada' }]);
});

test('plan: previsão de fim mudou com a GMUD incluída -> atualiza o fim', () => {
  const g = gmud({ horaFim: '06:00' });
  const states = new Map([[1000, { status: SYNC_STATUS.INCLUIDA, windowEnd: '2026-11-20 05:00:00' }]]);
  const plan = planClientSync({ candidates: [g], states, nowNaive: DURANTE });
  assert.equal(plan.updateFinish.length, 1);
  assert.equal(plan.updateFinish[0].windowEnd, '2026-11-20 06:00:00');
});

test('plan: removida antes e ativa de novo (reagendada) entra de novo', () => {
  const g = gmud();
  const states = new Map([[1000, { status: SYNC_STATUS.REMOVIDA, windowEnd: '2026-11-19 05:00:00' }]]);
  const plan = planClientSync({ candidates: [g], states, nowNaive: DURANTE });
  assert.equal(plan.include.length, 1);
});

test('plan: GMUD futura ou de sistemas não entra', () => {
  const plan = planClientSync({
    candidates: [gmud({ voalleProtocol: 1, dataInicio: '2026-12-01', dataFim: '2026-12-01' }), gmud({ voalleProtocol: 2, categoria: 'sistemas_internos' })],
    nowNaive: DURANTE,
  });
  assert.equal(plan.include.length, 0);
});

test('motivo e data para o gateway', () => {
  assert.equal(buildClientReason(gmud()), 'Manutenção programada (GMUD 1000): Troca de OLT');
  assert.equal(buildClientReason(gmud({ titulo: '' })), 'Manutenção programada (GMUD 1000)');
  assert.equal(toLocalDateTimeIso('2026-11-20 05:00:00'), '2026-11-20T05:00:00');
});
