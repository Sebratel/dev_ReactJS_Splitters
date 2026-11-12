import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmudClientSyncService } from './gmudClientSyncService.js';

const gmud = () => ({
  voalleProtocol: 1000, assignmentId: 77, categoria: 'rede_externa', titulo: 'Troca de OLT',
  statusComite: 'aprovada', statusAreas: 'aprovada', statusExec: 'pendente', ellevenEncerradoEm: null,
  dataInicio: '2026-11-20', horaInicio: '02:00', dataFim: '2026-11-20', horaFim: '05:00', popSite: 'SLESC', categoriaData: null,
});
const DURANTE = () => new Date('2026-11-20T06:00:00Z');

function build({ skipped, suppressed }) {
  const included = [];
  const svc = createGmudClientSyncService({
    store: {
      configured: true, isReady: async () => true, listStates: async () => new Map(),
      markIncluded: async (x) => included.push(x), markRemoved: async () => {}, markWindowEnd: async () => {}, recordError: async () => {}, counts: async () => ({}),
    },
    gateway: { configured: true, addClients: async () => ({ ok: true, skippedContractIds: skipped }), removeByProtocol: async () => ({ ok: true }), updateFinishDate: async () => ({ ok: true }) },
    gmudSource: { listCandidates: async () => [gmud()], getByProtocol: async () => null },
    clientsSource: { listClients: async () => ({ ok: true, clients: [{ contractId: 1, pppoe: 'ana', corporate: false }, { contractId: 2, pppoe: 'beto', corporate: true }] }) },
    suppressed, env: { GMUD_CLIENTES_SYNC_DRY_RUN: 'false' }, nowFn: DURANTE,
  });
  return { svc, included };
}

test('quem o gateway deixou de fora vai para a fila de reinclusão', async () => {
  const added = [];
  const { svc } = build({ skipped: [2], suppressed: { add: async (x) => added.push(x) } });
  await svc.runOnce();
  assert.equal(added.length, 1);
  assert.equal(added[0].eventType, 'gmud');
  assert.equal(added[0].eventProtocol, 1000);
  assert.equal(added[0].assignmentId, 77);
  assert.deepEqual(added[0].clients.map((c) => c.contractId), [2]);
  assert.equal(added[0].finishDateNaive, '2026-11-20 05:00:00');
});

test('ninguém ficou de fora: nada vai para a fila', async () => {
  const added = [];
  const { svc } = build({ skipped: [], suppressed: { add: async (x) => added.push(x) } });
  await svc.runOnce();
  assert.equal(added.length, 0);
});

test('falha ao registrar a fila não derruba a inclusão', async () => {
  const { svc, included } = build({ skipped: [2], suppressed: { add: async () => { throw new Error('tabela ausente'); } } });
  const r = await svc.runOnce();
  assert.equal(included.length, 1);
  assert.equal(r.erros, 0);
});
