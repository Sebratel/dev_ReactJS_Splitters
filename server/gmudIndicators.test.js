import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregatePlatform, aggregateVoalle, median, monthsBetween } from './gmudIndicators.js';

const NOW = new Date(2026, 9, 9, 12, 0); // 09/10/2026 12:00

test('median e monthsBetween', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.deepEqual(monthsBetween('2025-11-15', '2026-02-01'), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('aggregateVoalle: foto de agora, fluxo do período e série mensal', () => {
  const rows = [
    // aberta há 120 dias, vencida
    { protocol: 1, title: 'A', requester: 'Ana', status: 'Abertura', openedAt: new Date(2026, 5, 11, 9), slaDate: new Date(2026, 5, 14), conclusionDate: null },
    // aberta há 3 dias, dentro do prazo
    { protocol: 2, title: 'B', requester: 'Ana', status: 'Abertura', openedAt: new Date(2026, 9, 6, 15), slaDate: new Date(2026, 9, 20), conclusionDate: null },
    // encerrada no prazo em setembro
    { protocol: 3, title: 'C', requester: 'Bia', status: 'Encerrado', openedAt: new Date(2026, 8, 1, 10), slaDate: new Date(2026, 8, 5), conclusionDate: new Date(2026, 8, 2, 10) },
    // encerrada fora do prazo em setembro
    { protocol: 4, title: 'D', requester: 'Bia', status: 'Encerrado', openedAt: new Date(2026, 8, 1, 10), slaDate: new Date(2026, 8, 2), conclusionDate: new Date(2026, 8, 30, 10) },
    // cancelada — não conta como aberta nem encerrada
    { protocol: 5, title: 'E', requester: 'Caio', status: 'Cancelado', openedAt: new Date(2026, 8, 3, 10), slaDate: null, conclusionDate: new Date(2026, 8, 4) },
  ];
  const r = aggregateVoalle(rows, { from: '2026-09-01', to: '2026-10-31', now: NOW });

  assert.equal(r.snapshot.openNow, 2);
  assert.equal(r.snapshot.overdueNow, 1);
  assert.deepEqual(r.snapshot.aging.map((a) => a.count), [1, 0, 0, 1]);
  assert.equal(r.snapshot.oldestOpen[0].protocol, 1);
  assert.ok(r.snapshot.oldestOpen[0].overdueDays > 100);

  assert.equal(r.period.opened, 4); // 2, 3, 4, 5 (1 foi aberta em junho)
  assert.equal(r.period.closed, 2);
  assert.equal(r.period.cancelled, 1);
  assert.equal(r.period.onTimeRate, 50);
  assert.deepEqual(r.period.monthly.map((m) => m.month), ['2026-09', '2026-10']);
  assert.deepEqual(r.period.monthly[0], { month: '2026-09', opened: 3, closed: 2, backlog: 1 });
  assert.equal(r.period.monthly[1].backlog, 2);
  assert.equal(r.period.heatmap[1][10], 0); // 01/09/2026 foi uma terça
  assert.equal(r.period.heatmap[2][10], 2);
  const bia = r.period.requesters.find((x) => x.requester === 'Bia');
  assert.equal(bia.closedRate, 100);
});

test('aggregatePlatform: comitê, perfil, reagendamentos e impacto', () => {
  const requests = [
    { voalleProtocol: 10, titulo: 'Troca de OLT', tipo: 'Programada', assunto: 'Rede externa', ambienteAfetado: ['Rede de acesso/OLTs'], popSite: 'NHOPN', impactoParada: 'Sim', comunicaCliente: 'Sim', statusComite: 'aprovada', statusExec: 'concluida', createdAt: '2026-10-01T10:00:00Z', decididoEm: '2026-10-01T14:00:00Z', dataInicio: '2026-10-05', horaInicio: '22:00', dataFim: '2026-10-06', ellevenEncerradoEm: '2026-10-06T03:00:00Z', ellevenEncerradoStatus: 'concluida', rnc: null },
    { voalleProtocol: 11, titulo: 'Upgrade Voalle', tipo: 'Emergencial', assunto: 'Sistemas internos', ambienteAfetado: ['Serviço: Voalle/upgrade/update de base', 'Rede de acesso/OLTs'], popSite: 'NHOPN', impactoParada: 'Não', comunicaCliente: 'Não', statusComite: 'aprovada', statusExec: 'pendente', createdAt: '2026-10-02T10:00:00Z', decididoEm: '2026-10-02T12:00:00Z', dataInicio: '2026-10-07', horaInicio: '23:00', dataFim: null, ellevenEncerradoEm: null, rnc: 'RNC-1' },
    { voalleProtocol: 12, titulo: 'Negada', tipo: 'Programada', statusComite: 'negada', createdAt: '2026-10-03T10:00:00Z', decididoEm: '2026-10-04T10:00:00Z', ellevenEncerradoStatus: 'negada' },
    { voalleProtocol: 13, titulo: 'Pendente', tipo: 'Programada', statusComite: 'pendente', createdAt: '2026-10-08T10:00:00Z' },
  ];
  const events = [
    { type: 'reagendada', voalleProtocol: 11 },
    { type: 'reagendada', voalleProtocol: 11 },
    { type: 'comite_aprovada', voalleProtocol: 10 },
  ];
  const links = [
    { gmudProtocol: 10, massivaProtocol: 900, affectedClients: 120 },
    { gmudProtocol: 10, massivaProtocol: 901, affectedClients: 30 },
    { gmudProtocol: 99, massivaProtocol: 902, affectedClients: 999 }, // GMUD fora do período
  ];
  const r = aggregatePlatform(requests, events, links, { now: NOW });

  assert.equal(r.total, 4);
  assert.deepEqual(r.comite, { pendente: 1, aprovada: 2, negada: 1 });
  assert.equal(r.approvalRate, 66.7);
  assert.equal(r.medianHoursToDecision, 4);
  assert.deepEqual(r.tipos[0], { key: 'Programada', count: 3 });
  assert.deepEqual(r.ambientes[0], { key: 'Rede de acesso/OLTs', count: 2 });
  assert.deepEqual(r.pops[0], { key: 'NHOPN', count: 2 });
  assert.equal(r.rnc, 1);
  assert.deepEqual(r.encerradas, { concluida: 1, negada: 1 });
  assert.deepEqual(r.reagendamentos, { total: 2, gmuds: 1 });
  assert.deepEqual(r.pastWindowNotClosed.map((p) => p.voalleProtocol), [11]);
  assert.equal(r.windowHeatmap[1][22], 1); // 05/10/2026 = segunda
  assert.equal(r.impacto.clientesAfetados, 150);
  assert.equal(r.impacto.massivasVinculadas, 2);
  assert.equal(r.impacto.topImpact[0].title, 'Troca de OLT');
});
