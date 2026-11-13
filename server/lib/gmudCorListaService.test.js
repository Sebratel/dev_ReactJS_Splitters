import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorListaSender, createGmudCorListaService } from './gmudCorListaService.js';
import { COR_EVENT_LISTA } from './gmudCorLista.js';

const gmud = (over = {}) => ({
  voalleProtocol: 100, categoria: 'rede_externa', statusComite: 'aprovada', statusAreas: 'aprovada', statusExec: 'pendente',
  popSite: 'NHOCE', dataInicio: '2099-12-10', horaInicio: '02:00', dataFim: '2099-12-10', horaFim: '05:00',
  titulo: 'T', categoriaData: { clientesSemSplitter: [{ contractId: 9, nome: 'Fibra', tipo: 'fibra_apagada' }] }, ...over,
});

function build({ env = {}, candidates = [gmud()], last = new Map(), destinatarios = [{ email: 'cor@x.com' }], sendOk = true } = {}) {
  const sent = [];
  const logged = [];
  const service = createGmudCorListaService({
    gmudSource: { listCandidates: async () => candidates },
    eventsSource: { latestByTypes: async () => last, log: async (e) => void logged.push(e) },
    clientsSource: { listClients: async () => ({ ok: true, clients: [{ contractId: 1, nome: 'Corp', pppoe: 'p', pontoAcesso: 'OLT', corporate: true }, { contractId: 2, nome: 'Resid', pppoe: 'r', corporate: false }] }) },
    recipientsSource: { list: async () => destinatarios },
    sender: { send: async (url, payload) => { sent.push({ url, payload }); return sendOk ? { ok: true } : { ok: false, reason: 'webhook fora' }; } },
    env,
  });
  return { service, sent, logged };
}

test('simulação: calcula, não envia nem grava evento', async () => {
  const { service, sent, logged } = build({ env: { GMUD_COR_LISTA_ENABLED: 'true' } });
  const r = await service.runOnce();
  assert.equal(r.simulacao, true);
  assert.deepEqual(r.enviar.map((e) => [e.protocol, e.kind, e.total]), [[100, 'liberacao', 2]]); // só o corporativo + o escolhido à mão
  assert.equal(sent.length, 0);
  assert.equal(logged.length, 0);
});

test('envio de verdade: manda só corporativos + escolhidos, registra o evento com a assinatura', async () => {
  const { service, sent, logged } = build({ env: { GMUD_COR_LISTA_ENABLED: 'true', GMUD_COR_LISTA_DRY_RUN: 'false', N8N_GMUD_COR_LISTA_WEBHOOK_URL: 'https://n8n/x' } });
  await service.runOnce();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://n8n/x');
  assert.deepEqual(sent[0].payload.clientes.map((c) => [c.contrato, c.tipo]), [[1, 'corporativo'], [9, 'fibra_apagada']]);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].type, COR_EVENT_LISTA);
  assert.equal(typeof logged[0].payload.signature, 'string');
});

test('sem destinatários não envia e avisa', async () => {
  const { service, sent } = build({ env: { GMUD_COR_LISTA_ENABLED: 'true', GMUD_COR_LISTA_DRY_RUN: 'false', N8N_GMUD_COR_LISTA_WEBHOOK_URL: 'https://n8n/x' }, destinatarios: [] });
  const r = await service.runOnce();
  assert.equal(r.skipped, 'sem_destinatarios');
  assert.equal(sent.length, 0);
  assert.match((await service.getStatus()).lastError, /destinatários/);
});

test('webhook com falha: não registra o evento (tenta de novo no próximo ciclo)', async () => {
  const { service, logged } = build({ env: { GMUD_COR_LISTA_ENABLED: 'true', GMUD_COR_LISTA_DRY_RUN: 'false', N8N_GMUD_COR_LISTA_WEBHOOK_URL: 'https://n8n/x' }, sendOk: false });
  const r = await service.runOnce();
  assert.equal(r.erros, 1);
  assert.equal(logged.length, 0);
});

test('sem webhook configurado não envia', async () => {
  const { service, sent } = build({ env: { GMUD_COR_LISTA_ENABLED: 'true', GMUD_COR_LISTA_DRY_RUN: 'false' } });
  const r = await service.runOnce();
  assert.equal(r.erros, 1);
  assert.equal(sent.length, 0);
});

test('sender: resposta de erro e exceção viram motivo, sem lançar', async () => {
  const r1 = await createCorListaSender({ fetchFn: async () => ({ ok: false, status: 500 }) }).send('u', {});
  assert.deepEqual(r1, { ok: false, reason: 'Webhook respondeu 500.' });
  const r2 = await createCorListaSender({ fetchFn: async () => { throw new Error('rede'); } }).send('u', {});
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /rede/);
  assert.deepEqual(await createCorListaSender({ fetchFn: async () => ({ ok: true }) }).send('u', {}), { ok: true });
});
