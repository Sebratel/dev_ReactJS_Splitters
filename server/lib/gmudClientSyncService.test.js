import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmudClientSyncService, startGmudClientSyncScheduler } from './gmudClientSyncService.js';

const gmud = (extra = {}) => ({
  voalleProtocol: 1000, assignmentId: 77, categoria: 'rede_externa', titulo: 'Troca de OLT',
  statusComite: 'aprovada', statusAreas: 'aprovada', statusExec: 'pendente', ellevenEncerradoEm: null,
  dataInicio: '2026-11-20', horaInicio: '02:00', dataFim: '2026-11-20', horaFim: '05:00',
  popSite: 'SLESC', categoriaData: null, ...extra,
});

// 20/11/2026 03:00 em Brasília = 06:00 UTC
const DURANTE = () => new Date('2026-11-20T06:00:00Z');
const DEPOIS = () => new Date('2026-11-20T08:30:00Z');

function fakes({ states = new Map(), candidates = [gmud()], byProtocol = {}, clients, skipped = [], addResult, removeResult } = {}) {
  const calls = { add: [], remove: [], finish: [], included: [], removed: [], errors: [] };
  const store = {
    configured: true,
    isReady: async () => true,
    listStates: async () => states,
    markIncluded: async (x) => calls.included.push(x),
    markRemoved: async (x) => calls.removed.push(x),
    markWindowEnd: async () => {},
    recordError: async (x) => calls.errors.push(x),
    counts: async () => ({ incluidas: 0, clientesAtivos: 0 }),
  };
  const gateway = {
    configured: true,
    addClients: async (x) => { calls.add.push(x); return addResult ?? { ok: true, skippedContractIds: skipped }; },
    removeByProtocol: async (p) => { calls.remove.push(p); return removeResult ?? { ok: true }; },
    updateFinishDate: async (p, d) => { calls.finish.push([p, d]); return { ok: true }; },
  };
  const gmudSource = { listCandidates: async () => candidates, getByProtocol: async (p) => byProtocol[p] ?? null };
  const clientsSource = {
    listClients: async () => ({ ok: true, clients: clients ?? [{ contractId: 1, pppoe: 'ana', corporate: false }, { contractId: 2, pppoe: 'beto', corporate: true }] }),
  };
  return { store, gateway, gmudSource, clientsSource, calls };
}

const make = (f, env, nowFn = DURANTE) =>
  createGmudClientSyncService({ ...f, env: { GMUD_CLIENTES_SYNC_DRY_RUN: 'false', ...env }, logger: undefined, nowFn });

test('início da janela: inclui os clientes e grava o histórico', async () => {
  const f = fakes();
  const r = await make(f).runOnce();
  assert.equal(r.incluir.length, 1);
  assert.equal(f.calls.add.length, 1);
  assert.equal(f.calls.add[0].protocol, 1000);
  assert.equal(f.calls.add[0].assignmentId, 77);
  assert.equal(f.calls.add[0].finishDateNaive, '2026-11-20 05:00:00');
  assert.equal(f.calls.add[0].clients.length, 2);
  assert.equal(f.calls.included.length, 1);
  assert.equal(f.calls.included[0].windowEnd, '2026-11-20 05:00:00');
});

test('clientes que o gateway deixou de fora ficam marcados no histórico', async () => {
  const f = fakes({ skipped: [2] });
  await make(f).runOnce();
  assert.deepEqual(f.calls.included[0].skippedContractIds, [2]);
});

test('simulação (padrão): calcula mas não chama o gateway nem grava', async () => {
  const f = fakes();
  const svc = createGmudClientSyncService({ ...f, env: {}, nowFn: DURANTE });
  const r = await svc.runOnce();
  assert.equal(r.simulacao, true);
  assert.equal(r.incluir.length, 1);
  assert.equal(f.calls.add.length, 0);
  assert.equal(f.calls.included.length, 0);
});

test('já incluída e ainda na janela não repete a inclusão', async () => {
  const states = new Map([[1000, { status: 'incluida', windowEnd: '2026-11-20 05:00:00' }]]);
  const f = fakes({ states });
  await make(f).runOnce();
  assert.equal(f.calls.add.length, 0);
});

test('fim da janela: remove no gateway e marca a saída', async () => {
  const states = new Map([[1000, { status: 'incluida', windowEnd: '2026-11-20 05:00:00' }]]);
  const f = fakes({ states, candidates: [], byProtocol: { 1000: gmud() } });
  await make(f, {}, DEPOIS).runOnce();
  assert.deepEqual(f.calls.remove, [1000]);
  assert.equal(f.calls.removed[0].reason, 'fora_da_janela');
});

test('falha ao remover não marca como removida (tenta no próximo ciclo)', async () => {
  const states = new Map([[1000, { status: 'incluida', windowEnd: '2026-11-20 05:00:00' }]]);
  const f = fakes({ states, candidates: [], byProtocol: { 1000: gmud() }, removeResult: { ok: false, reason: 'HTTP 500' } });
  const r = await make(f, {}, DEPOIS).runOnce();
  assert.equal(f.calls.removed.length, 0);
  assert.equal(r.erros, 1);
  assert.equal(f.calls.errors.length, 1);
});

test('falha ao incluir registra o erro e não marca como incluída', async () => {
  const f = fakes({ addResult: { ok: false, reason: 'HTTP 502' } });
  const r = await make(f).runOnce();
  assert.equal(f.calls.included.length, 0);
  assert.equal(r.erros, 1);
});

test('escopo maior que o limite não inclui nada', async () => {
  const f = fakes({ clients: Array.from({ length: 5 }, (_, i) => ({ contractId: i + 1, pppoe: `c${i}`, corporate: false })) });
  const r = await make(f, { GMUD_CLIENTES_SYNC_MAX_CLIENTES: '3' }).runOnce();
  assert.equal(f.calls.add.length, 0);
  assert.equal(r.erros, 1);
});

test('GMUD sem clientes no escopo: registra a inclusão sem chamar o gateway', async () => {
  const f = fakes({ clients: [] });
  await make(f).runOnce();
  assert.equal(f.calls.add.length, 0);
  assert.equal(f.calls.included.length, 1);
});

test('tabelas ausentes: não faz nada e avisa', async () => {
  const f = fakes();
  f.store.isReady = async () => false;
  const r = await make(f).runOnce();
  assert.equal(r.skipped, 'tabelas_ausentes');
  assert.equal(f.calls.add.length, 0);
});

test('não roda duas vezes ao mesmo tempo', async () => {
  const f = fakes();
  let release;
  f.gmudSource.listCandidates = () => new Promise((resolve) => { release = () => resolve([]); });
  const svc = make(f);
  const first = svc.runOnce();
  const second = await svc.runOnce();
  assert.equal(second.skipped, 'ja_em_execucao');
  await new Promise((resolve) => setImmediate(resolve)); // deixa o 1º ciclo chegar em listCandidates
  release();
  await first;
});

test('scheduler: desligado por padrão e só liga com gateway e MySQL', () => {
  const f = fakes();
  const svc = make(f);
  assert.equal(startGmudClientSyncScheduler({ service: svc, store: f.store, gateway: f.gateway, env: {} }).started, false);
  assert.equal(startGmudClientSyncScheduler({ service: svc, store: { configured: false }, gateway: f.gateway, env: { GMUD_CLIENTES_SYNC_ENABLED: 'true' } }).motivo, 'mysql_nao_configurado');
  assert.equal(startGmudClientSyncScheduler({ service: svc, store: f.store, gateway: { configured: false }, env: { GMUD_CLIENTES_SYNC_ENABLED: 'true' } }).motivo, 'gateway_nao_configurado');
  let scheduled = 0;
  const r = startGmudClientSyncScheduler({
    service: svc, store: f.store, gateway: f.gateway, env: { GMUD_CLIENTES_SYNC_ENABLED: 'true' },
    setTimeoutFn: () => { scheduled += 1; return { unref() {} }; }, setIntervalFn: () => { scheduled += 1; return { unref() {} }; },
  });
  assert.equal(r.started, true);
  assert.equal(r.dryRun, true);
  assert.equal(scheduled, 2);
});

test('status mostra a configuração e os totais', async () => {
  const f = fakes();
  const svc = make(f, { GMUD_CLIENTES_SYNC_ENABLED: 'true' });
  await svc.runOnce();
  const s = await svc.getStatus();
  assert.equal(s.enabled, true);
  assert.equal(s.dryRun, false);
  assert.equal(s.totals.incluidas, 1);
  assert.equal(s.totals.clientesIncluidos, 2);
  assert.ok(s.lastRunAt);
});
