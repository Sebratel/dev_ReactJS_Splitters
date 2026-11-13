import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COR_EVENT_LEMBRETE,
  COR_EVENT_LISTA,
  buildCorClientes,
  buildCorCsv,
  buildCorPayload,
  corInputsSignature,
  minusHoursNaive,
  planCorLista,
  readCorListaConfig,
} from './gmudCorLista.js';

const gmud = (over = {}) => ({
  voalleProtocol: 100,
  categoria: 'rede_externa',
  statusComite: 'aprovada',
  statusAreas: 'aprovada',
  statusExec: 'pendente',
  popSite: 'NHOCE',
  dataInicio: '2026-12-10',
  horaInicio: '02:00',
  dataFim: '2026-12-10',
  horaFim: '05:00',
  categoriaData: null,
  ...over,
});
const NOW = '2026-12-01 10:00:00';

test('config: desligada e em simulação por padrão', () => {
  const c = readCorListaConfig({});
  assert.equal(c.enabled, false);
  assert.equal(c.dryRun, true);
  assert.equal(c.lembreteHoras, 24);
  assert.equal(readCorListaConfig({ GMUD_COR_LISTA_ENABLED: 'true', GMUD_COR_LISTA_DRY_RUN: 'false', GMUD_COR_LISTA_LEMBRETE_HORAS: '48' }).lembreteHoras, 48);
});

test('minusHoursNaive', () => {
  assert.equal(minusHoursNaive('2026-12-10 02:00:00', 24), '2026-12-09 02:00:00');
  assert.equal(minusHoursNaive('2026-12-01 01:00:00', 2), '2026-11-30 23:00:00');
});

test('assinatura muda com a janela, as rotas e os clientes escolhidos, e ignora o resto', () => {
  const base = corInputsSignature(gmud());
  assert.equal(corInputsSignature(gmud({ titulo: 'outro título' })), base);
  assert.notEqual(corInputsSignature(gmud({ horaFim: '06:00' })), base);
  assert.notEqual(corInputsSignature(gmud({ categoriaData: { escopoRotas: [{ apCode: 'AP-1' }] } })), base);
  assert.notEqual(corInputsSignature(gmud({ categoriaData: { clientesSemSplitter: [{ contractId: 5, tipo: 'fibra_apagada' }] } })), base);
});

test('plano: GMUD liberada sem envio anterior → liberação', () => {
  const plan = planCorLista({ candidates: [gmud()], nowNaive: NOW });
  assert.deepEqual(plan.map((p) => [p.gmud.voalleProtocol, p.kind]), [[100, 'liberacao']]);
});

test('plano: não liberada, encerrada, de sistemas ou com janela passada não envia', () => {
  const nao = [
    gmud({ statusComite: 'pendente' }),
    gmud({ statusAreas: 'pendente' }),
    gmud({ ellevenEncerradoEm: '2026-11-30T10:00:00Z' }),
    gmud({ categoria: 'sistemas_internos' }),
    gmud({ dataInicio: '2026-11-01', dataFim: '2026-11-01' }),
    gmud({ dataInicio: '' }),
  ];
  assert.deepEqual(planCorLista({ candidates: nao, nowNaive: NOW }), []);
});

test('plano: já enviado com a mesma assinatura não repete; mudou → atualização', () => {
  const g = gmud();
  const sig = corInputsSignature(g);
  const last = new Map([[100, { [COR_EVENT_LISTA]: { payload: { signature: sig } } }]]);
  assert.deepEqual(planCorLista({ candidates: [g], nowNaive: NOW, lastByProtocol: last }), []);
  const mudou = gmud({ horaFim: '07:00' });
  assert.deepEqual(planCorLista({ candidates: [mudou], nowNaive: NOW, lastByProtocol: last }).map((p) => p.kind), ['atualizacao']);
});

test('plano: lembrete só dentro das horas antes do início e uma vez por assinatura', () => {
  const g = gmud();
  const sig = corInputsSignature(g);
  const last = new Map([[100, { [COR_EVENT_LISTA]: { payload: { signature: sig } } }]]);
  assert.deepEqual(planCorLista({ candidates: [g], nowNaive: '2026-12-08 10:00:00', lastByProtocol: last }), []); // cedo demais
  assert.deepEqual(planCorLista({ candidates: [g], nowNaive: '2026-12-09 03:00:00', lastByProtocol: last }).map((p) => p.kind), ['lembrete']);
  last.get(100)[COR_EVENT_LEMBRETE] = { payload: { signature: sig } };
  assert.deepEqual(planCorLista({ candidates: [g], nowNaive: '2026-12-09 03:00:00', lastByProtocol: last }), []);
  assert.deepEqual(planCorLista({ candidates: [g], nowNaive: '2026-12-10 03:00:00', lastByProtocol: new Map([[100, { [COR_EVENT_LISTA]: { payload: { signature: sig } } }]]) }), []); // já começou
});

test('clientes: os escolhidos têm prioridade, sem repetir contrato, ordenados por nome', () => {
  const clientes = buildCorClientes({
    corporativos: [{ contractId: 2, nome: 'Zeta', pppoe: 'z', pontoAcesso: 'OLT 01' }, { contractId: 3, nome: 'Alfa', pppoe: 'a', pontoAcesso: 'OLT 02' }],
    semSplitter: [{ contractId: 3, nome: 'Alfa PTP', pppoe: '', tipo: 'fibra_apagada' }],
  });
  assert.deepEqual(clientes.map((c) => [c.contrato, c.tipo]), [[3, 'fibra_apagada'], [2, 'corporativo']]);
});

test('csv e payload', () => {
  const clientes = buildCorClientes({ corporativos: [{ contractId: 2, nome: 'A; "B"', pppoe: 'u', pontoAcesso: 'OLT' }], semSplitter: [{ contractId: 9, nome: 'Fibra', pppoe: '', tipo: 'fibra_apagada' }] });
  const csv = buildCorCsv(clientes);
  assert.ok(csv.startsWith('contrato;cliente;usuario_conexao;ponto_de_acesso;tipo'));
  assert.ok(csv.includes('"A; ""B"""'));
  const p = buildCorPayload({ gmud: gmud({ titulo: 'T' }), kind: 'liberacao', signature: 'abc', clientes, destinatarios: [{ email: 'cor@x.com' }], abrangencia: 'OLT 01', appBaseUrl: 'https://app' });
  assert.equal(p.evento, 'gmud_lista_cor');
  assert.equal(p.link, 'https://app/gmud/100');
  assert.deepEqual(p.resumo, { total: 2, corporativos: 1, pontoAPonto: 0, fibraApagada: 1 });
  assert.deepEqual(p.janela, { inicio: '2026-12-10 02:00:00', fim: '2026-12-10 05:00:00' });
});
