import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONFERENCIA_SOURCE,
  buildConferenciaStatus,
  computeDivergencias,
  createConferenciaService,
  fetchEllevenMassivas,
  isGatewayConfigured,
  mapEllevenItemToRow,
  naiveToEpochMs,
  planConferencia,
  readConferenciaConfig,
  startConferenciaScheduler,
  toMysqlNaive,
} from './massivaConferenciaElleven.js';

const ENV = {
  GATEWAY_ORIGIN: 'https://gw.example/',
  GATEWAY_BASIC_AUTH_USER: 'u',
  GATEWAY_BASIC_AUTH_PASSWORD: 'p',
};
// "Agora" = 12/11/2026 12:00 em Brasília
const NOW = new Date('2026-11-12T12:00:00-03:00');

function item(protocolo, over = {}) {
  return {
    protocolo: String(protocolo),
    id: Number(protocolo) + 1_000_000,
    criacao: '2026-11-12T08:00:00.123456', // 4 h atrás
    finalizado: null,
    status: 'Abertura',
    tituloIncidente: 'Registro Incidente de Rede',
    pontoDeAcesso: 'OLT 03 - SLEFT',
    ...over,
  };
}

/** Banco falso em memória que imita os índices únicos de protocol e assignment_id. */
function fakeStore({ rows = [], failFor = new Set(), configured = true } = {}) {
  const byProtocol = new Map(rows.map((r) => [Number(r.protocol), { ...r }]));
  const inserts = [];
  return {
    configured,
    byProtocol,
    inserts,
    async getLocalStatusByProtocols(protocols) {
      const out = new Map();
      for (const p of protocols) if (byProtocol.has(Number(p))) out.set(Number(p), byProtocol.get(Number(p)).status);
      return out;
    },
    async insertRecovered(row) {
      if (failFor.has(row.protocol)) throw new Error('Lock wait timeout exceeded');
      if (byProtocol.has(row.protocol)) return { duplicate: true };
      if ([...byProtocol.values()].some((r) => r.assignment_id === row.assignmentId)) {
        return { conflict: 'assignment_id já existe na plataforma com outro protocolo' };
      }
      byProtocol.set(row.protocol, { protocol: row.protocol, assignment_id: row.assignmentId, status: row.status });
      inserts.push(row);
      return { inserted: true };
    },
    async countRecovered() {
      return inserts.length;
    },
  };
}

function okFetch(items) {
  return async () => ({ ok: true, status: 200, json: async () => items });
}

function silentLogger() {
  const lines = [];
  return { lines, info: (m) => lines.push(m), warn: (m) => lines.push(m), error: (m) => lines.push(m) };
}

function newService({ store, items, env = ENV, nowRef = { t: NOW }, fetchImpl, notify } = {}) {
  const alerts = [];
  const service = createConferenciaService({
    store,
    env,
    fetchImpl: fetchImpl ?? okFetch(items ?? []),
    logger: silentLogger(),
    nowFn: () => nowRef.t,
    notify: notify ?? (async (p) => { alerts.push(p); return { sent: true }; }),
  });
  return { service, alerts, nowRef };
}

describe('datas e configuração', () => {
  it('toMysqlNaive corta frações e normaliza o separador', () => {
    assert.equal(toMysqlNaive('2026-11-11T16:21:24.091575'), '2026-11-11 16:21:24');
    assert.equal(toMysqlNaive('2026-11-11 16:21'), '2026-11-11 16:21:00');
    assert.equal(toMysqlNaive(''), null);
    assert.equal(toMysqlNaive(null), null);
    assert.equal(toMysqlNaive('lixo'), null);
  });

  it('naiveToEpochMs trata o horário de parede como Brasília (-03:00)', () => {
    assert.equal(naiveToEpochMs('2026-11-12 12:00:00'), NOW.getTime());
  });

  it('readConferenciaConfig: padrões e limites', () => {
    const d = readConferenciaConfig({});
    assert.deepEqual({ ...d }, { enabled: false, dryRun: false, intervalMinutes: 5, janelaDias: 30, carenciaMinutos: 10, alertUrl: '' });
    const c = readConferenciaConfig({
      MASSIVA_CONFERENCIA_ENABLED: 'TRUE',
      MASSIVA_CONFERENCIA_DRY_RUN: 'true',
      MASSIVA_CONFERENCIA_INTERVAL_MINUTES: '0',
      MASSIVA_CONFERENCIA_JANELA_DIAS: '7',
      MASSIVA_CONFERENCIA_ALERT_WEBHOOK_URL: ' https://n8n.example/hook ',
    });
    assert.equal(c.enabled, true);
    assert.equal(c.dryRun, true);
    assert.equal(c.intervalMinutes, 1, 'mínimo de 1 minuto');
    assert.equal(c.janelaDias, 7);
    assert.equal(c.alertUrl, 'https://n8n.example/hook');
  });

  it('isGatewayConfigured exige origem, usuário e senha', () => {
    assert.equal(isGatewayConfigured(ENV), true);
    assert.equal(isGatewayConfigured({ ...ENV, GATEWAY_BASIC_AUTH_PASSWORD: '' }), false);
    assert.equal(isGatewayConfigured({}), false);
  });
});

describe('mapEllevenItemToRow (mapeamento de campos)', () => {
  it('protocolo aberto: título = ponto de acesso, sem dados de encerramento', () => {
    const row = mapEllevenItemToRow(item(1886910));
    assert.deepEqual(row, {
      protocol: 1886910,
      assignmentId: 2886910,
      title: 'OLT 03 - SLEFT',
      status: 'aberta',
      openedAt: '2026-11-12 08:00:00',
      closedAt: null,
      closedBy: null,
      closeDescription: null,
      source: CONFERENCIA_SOURCE,
    });
  });

  it('protocolo finalizado: encerrada com closed_at, closed_by e descrição', () => {
    const row = mapEllevenItemToRow(item(1, { finalizado: '2026-11-12T09:30:15.5', status: 'Encerrado' }));
    assert.equal(row.status, 'encerrada');
    assert.equal(row.closedAt, '2026-11-12 09:30:15');
    assert.equal(row.closedBy, 'conferencia-elleven');
    assert.match(row.closeDescription, /Recuperada pela conferência com o Elleven/);
  });

  it('finalizado com status Cancelado vira cancelada', () => {
    assert.equal(mapEllevenItemToRow(item(1, { finalizado: '2026-11-12T09:00:00', status: 'Cancelado' })).status, 'cancelada');
  });

  it('sem ponto de acesso usa o título do incidente; não inventa operador nem código', () => {
    const row = mapEllevenItemToRow(item(1, { pontoDeAcesso: '  ' }));
    assert.equal(row.title, 'Registro Incidente de Rede');
    assert.equal('operatorEmail' in row, false);
    assert.equal('accessPointCode' in row, false);
  });
});

describe('planConferencia', () => {
  const local = (...p) => new Set(p);

  it('cria só o que falta; não recria protocolo que já existe', () => {
    const plano = planConferencia({ ellevenItems: [item(1), item(2)], localProtocols: local(1), now: NOW });
    assert.deepEqual(plano.criar.map((r) => r.protocol), [2]);
    assert.equal(plano.jaExistem, 1);
  });

  it('respeita a janela de dias', () => {
    const velho = item(3, { criacao: '2026-09-01T10:00:00' });
    const plano = planConferencia({ ellevenItems: [velho, item(4)], localProtocols: local(), now: NOW, janelaDias: 30 });
    assert.deepEqual(plano.criar.map((r) => r.protocol), [4]);
    assert.equal(plano.foraDaJanela, 1);
  });

  it('respeita a carência (protocolo muito recente ainda pode estar sendo gravado)', () => {
    const recente = item(5, { criacao: '2026-11-12T11:55:00' }); // 5 min atrás
    const plano = planConferencia({ ellevenItems: [recente], localProtocols: local(), now: NOW, carenciaMinutos: 10 });
    assert.equal(plano.criar.length, 0);
    assert.equal(plano.naCarencia, 1);
    const sem = planConferencia({ ellevenItems: [recente], localProtocols: local(), now: NOW, carenciaMinutos: 0 });
    assert.equal(sem.criar.length, 1);
  });

  it('protocolo sem assignment (id) não é criado; item inválido é contado', () => {
    const plano = planConferencia({
      ellevenItems: [item(6, { id: null }), { protocolo: 'abc', criacao: 'x' }, item(7, { criacao: 'data ruim' })],
      localProtocols: local(),
      now: NOW,
    });
    assert.equal(plano.criar.length, 0);
    assert.deepEqual(plano.semAssignment, [{ protocolo: 6 }]);
    assert.equal(plano.invalidas, 2);
  });

  it('ignora protocolo repetido na lista', () => {
    const plano = planConferencia({ ellevenItems: [item(8), item(8)], localProtocols: local(), now: NOW });
    assert.equal(plano.criar.length, 1);
  });
});

describe('computeDivergencias (somente leitura)', () => {
  it('detecta aberta local x finalizada no Elleven e fechada local x aberta no Elleven', () => {
    const itens = [
      item(1, { finalizado: '2026-11-12T10:00:00', status: 'Encerrado' }),
      item(2),
      item(3),
      item(4, { finalizado: '2026-11-12T10:00:00', status: 'Encerrado' }),
    ];
    const localStatus = new Map([[1, 'aberta'], [2, 'encerrada'], [3, 'aberta'], [4, 'encerrada']]);
    const d = computeDivergencias({ ellevenItems: itens, localStatus, now: NOW });
    assert.deepEqual(d.abertaLocalFinalizadaElleven.map((x) => x.protocolo), [1]);
    assert.deepEqual(d.fechadaLocalAbertaElleven.map((x) => x.protocolo), [2]);
  });
});

describe('fetchEllevenMassivas', () => {
  it('aceita array puro e { data: [...] }; usa Basic auth; nunca lança', async () => {
    const calls = [];
    const f = (items) => async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => items };
    };
    const a = await fetchEllevenMassivas({ env: ENV, fetchImpl: f([{ protocolo: '1' }]) });
    const b = await fetchEllevenMassivas({ env: ENV, fetchImpl: f({ data: [{ protocolo: '2' }] }) });
    assert.equal(a.ok, true);
    assert.equal(a.items.length, 1);
    assert.equal(b.items[0].protocolo, '2');
    assert.equal(calls[0].url, 'https://gw.example/api/v1/massivas/recuperar-pelo-banco');
    assert.match(calls[0].init.headers.Authorization, /^Basic /);
  });

  it('falhas viram { ok:false, reason }', async () => {
    const r1 = await fetchEllevenMassivas({ env: {}, fetchImpl: okFetch([]) });
    const r2 = await fetchEllevenMassivas({ env: ENV, fetchImpl: async () => ({ ok: false, status: 502 }) });
    const r3 = await fetchEllevenMassivas({ env: ENV, fetchImpl: async () => { throw new Error('timeout'); } });
    const r4 = await fetchEllevenMassivas({ env: ENV, fetchImpl: async () => ({ ok: true, json: async () => ({ x: 1 }) }) });
    assert.equal(r1.ok, false);
    assert.match(r2.reason, /502/);
    assert.match(r3.reason, /timeout/);
    assert.match(r4.reason, /inesperada/);
  });
});

describe('runOnce (serviço)', () => {
  it('cria o que falta e dispara alerta de massivas recuperadas', async () => {
    const store = fakeStore({ rows: [{ protocol: 1, assignment_id: 1_000_001, status: 'aberta' }] });
    const { service, alerts } = newService({ store, items: [item(1), item(2), item(3)] });
    const r = await service.runOnce();
    assert.equal(r.ok, true);
    assert.deepEqual(r.criadas.map((c) => c.protocolo), [2, 3]);
    assert.equal(store.inserts.length, 2);
    assert.equal(r.elleven.total, 3);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].tipo, 'massivas_recuperadas');
    assert.equal(alerts[0].criadas.length, 2);
    assert.ok(alerts[0].quando && alerts[0].quandoBrasilia && alerts[0].assunto);
  });

  it('idempotência: rodar duas vezes cria uma vez só', async () => {
    const store = fakeStore();
    const { service, alerts } = newService({ store, items: [item(10)] });
    const r1 = await service.runOnce();
    const r2 = await service.runOnce();
    assert.equal(r1.criadas.length, 1);
    assert.equal(r2.criadas.length, 0);
    assert.equal(r2.plano.jaExistem, 1);
    assert.equal(store.inserts.length, 1);
    assert.equal(alerts.length, 1, 'só alerta quando criou');
  });

  it('dryRun não escreve nada e informa o que seria criado', async () => {
    const store = fakeStore();
    const { service, alerts } = newService({ store, items: [item(20), item(21)] });
    const r = await service.runOnce({ dryRun: true });
    assert.equal(r.ok, true);
    assert.equal(r.dryRun, true);
    assert.equal(store.inserts.length, 0);
    assert.equal(r.criadas.length, 0);
    assert.deepEqual(r.criariam.map((c) => c.protocolo), [20, 21]);
    assert.equal(alerts[0].tipo, 'massivas_faltando_simulacao');
  });

  it('dryRun também vem da env MASSIVA_CONFERENCIA_DRY_RUN', async () => {
    const store = fakeStore();
    const { service } = newService({ store, items: [item(22)], env: { ...ENV, MASSIVA_CONFERENCIA_DRY_RUN: 'true' } });
    const r = await service.runOnce();
    assert.equal(r.dryRun, true);
    assert.equal(store.inserts.length, 0);
  });

  it('falha do gateway não lança e vira resultado com erro', async () => {
    const store = fakeStore();
    const { service } = newService({ store, fetchImpl: async () => { throw new Error('ECONNRESET'); } });
    const r = await service.runOnce();
    assert.equal(r.ok, false);
    assert.match(r.erro, /ECONNRESET/);
    assert.equal(service.getUltimoResultado().ok, false);
  });

  it('sem gateway ou sem MySQL configurado: erro claro, sem lançar', async () => {
    const a = await newService({ store: fakeStore(), items: [], env: {} }).service.runOnce();
    const b = await newService({ store: fakeStore({ configured: false }), items: [] }).service.runOnce();
    assert.match(a.erro, /Gateway não configurado/);
    assert.match(b.erro, /MySQL de massivas/);
  });

  it('erro de gravação em uma linha não impede as outras, e alerta a falha', async () => {
    const store = fakeStore({ failFor: new Set([31]) });
    const { service, alerts } = newService({ store, items: [item(30), item(31), item(32)] });
    const r = await service.runOnce();
    assert.deepEqual(r.criadas.map((c) => c.protocolo), [30, 32]);
    assert.equal(r.falhas.length, 1);
    assert.equal(r.falhas[0].protocolo, 31);
    assert.match(r.falhas[0].erro, /Lock wait/);
    assert.deepEqual(alerts.map((a) => a.tipo).sort(), ['falha_gravacao', 'massivas_recuperadas']);
  });

  it('conflito de assignment é reportado e não vira erro', async () => {
    const store = fakeStore({ rows: [{ protocol: 999, assignment_id: 1_000_040, status: 'encerrada' }] });
    const { service, alerts } = newService({ store, items: [item(40)] });
    const r = await service.runOnce();
    assert.equal(r.criadas.length, 0);
    assert.equal(r.conflitos.length, 1);
    assert.equal(alerts[0].tipo, 'conflito_protocolo');
  });

  it('não roda duas execuções ao mesmo tempo', async () => {
    let liberar;
    const trava = new Promise((resolve) => { liberar = resolve; });
    const store = fakeStore();
    const { service } = newService({ store, fetchImpl: async () => { await trava; return { ok: true, json: async () => [] }; } });
    const p1 = service.runOnce();
    const r2 = await service.runOnce();
    assert.equal(r2.skipped, true);
    liberar();
    const r1 = await p1;
    assert.equal(r1.ok, true);
    assert.equal(service.isRunning(), false);
  });
});

describe('antirrepetição de alertas', () => {
  it('divergência igual não repete a cada execução; muda ou passa de 6 h, repete', async () => {
    const store = fakeStore({ rows: [{ protocol: 50, assignment_id: 1_000_050, status: 'aberta' }] });
    const itens = [item(50, { finalizado: '2026-11-12T10:00:00', status: 'Encerrado' })];
    const { service, alerts, nowRef } = newService({ store, items: itens });
    await service.runOnce();
    await service.runOnce();
    await service.runOnce();
    assert.equal(alerts.filter((a) => a.tipo === 'divergencia_status').length, 1, 'três execuções, um alerta');

    nowRef.t = new Date(NOW.getTime() + 6 * 3600_000 + 1000);
    await service.runOnce();
    assert.equal(alerts.filter((a) => a.tipo === 'divergencia_status').length, 2, 'depois de 6 h reenvia');
  });

  it('assinatura diferente alerta de novo; sumir e voltar também', async () => {
    const store = fakeStore({
      rows: [
        { protocol: 60, assignment_id: 1_000_060, status: 'aberta' },
        { protocol: 61, assignment_id: 1_000_061, status: 'aberta' },
      ],
    });
    const fim = { finalizado: '2026-11-12T10:00:00', status: 'Encerrado' };
    let lista = [item(60, fim)];
    const { service, alerts } = newService({ store, fetchImpl: async () => ({ ok: true, json: async () => lista }) });
    await service.runOnce();
    lista = [item(60, fim), item(61, fim)];
    await service.runOnce();
    assert.equal(alerts.filter((a) => a.tipo === 'divergencia_status').length, 2);
    lista = []; // resolveu
    await service.runOnce();
    lista = [item(60, fim)];
    await service.runOnce();
    assert.equal(alerts.filter((a) => a.tipo === 'divergencia_status').length, 3);
  });

  it('3 falhas seguidas geram um único aviso até voltar a funcionar', async () => {
    let falhar = true;
    const store = fakeStore();
    const { service, alerts } = newService({
      store,
      fetchImpl: async () => { if (falhar) throw new Error('gateway fora'); return { ok: true, json: async () => [] }; },
    });
    for (let i = 0; i < 5; i += 1) await service.runOnce();
    assert.equal(alerts.filter((a) => a.tipo === 'execucao_falhou').length, 1);
    assert.equal(service.getFalhasSeguidas(), 5);
    falhar = false;
    await service.runOnce();
    assert.equal(service.getFalhasSeguidas(), 0);
    falhar = true;
    for (let i = 0; i < 3; i += 1) await service.runOnce();
    assert.equal(alerts.filter((a) => a.tipo === 'execucao_falhou').length, 2, 'depois de voltar, um novo ciclo de 3 avisa de novo');
  });

  it('o alerta nunca carrega credenciais nem a URL do webhook', async () => {
    const store = fakeStore();
    const { service, alerts } = newService({
      store,
      items: [item(70)],
      env: { ...ENV, MASSIVA_CONFERENCIA_ALERT_WEBHOOK_URL: 'https://n8n.example/hook/segredo' },
    });
    await service.runOnce();
    const json = JSON.stringify(alerts);
    assert.equal(json.includes('segredo'), false);
    assert.equal(json.includes('GATEWAY'), false);
    assert.equal(json.includes('Basic '), false);
  });
});

describe('webhook de alerta (notifier padrão)', () => {
  it('sem URL só registra em log; com URL faz POST JSON', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, body: JSON.parse(init.body), method: init.method }); return { ok: true }; };
    const store = fakeStore();
    const logger = silentLogger();
    const sem = createConferenciaService({ store, env: ENV, fetchImpl: async (u, i) => (String(u).includes('hook') ? fetchImpl(u, i) : okFetch([item(80)])()), logger, nowFn: () => NOW });
    await sem.runOnce();
    assert.equal(calls.length, 0);
    assert.ok(logger.lines.some((l) => /sem webhook configurado/.test(l)));

    const store2 = fakeStore();
    const com = createConferenciaService({
      store: store2,
      env: { ...ENV, MASSIVA_CONFERENCIA_ALERT_WEBHOOK_URL: 'https://n8n.example/hook' },
      fetchImpl: async (u, i) => (String(u).includes('hook') ? fetchImpl(u, i) : okFetch([item(81)])()),
      logger: silentLogger(),
      nowFn: () => NOW,
    });
    await com.runOnce();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://n8n.example/hook');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.tipo, 'massivas_recuperadas');
  });

  it('falha do webhook não derruba a execução', async () => {
    const store = fakeStore();
    const service = createConferenciaService({
      store,
      env: { ...ENV, MASSIVA_CONFERENCIA_ALERT_WEBHOOK_URL: 'https://n8n.example/hook' },
      fetchImpl: async (u) => { if (String(u).includes('hook')) throw new Error('n8n fora'); return okFetch([item(90)])(); },
      logger: silentLogger(),
      nowFn: () => NOW,
    });
    const r = await service.runOnce();
    assert.equal(r.ok, true);
    assert.equal(r.criadas.length, 1);
  });
});

describe('contrato de GET /api/massiva/conferencia/status', () => {
  it('devolve configuração, última execução resumida e recuperadas dos últimos 30 dias', async () => {
    const store = fakeStore();
    const itens = Array.from({ length: 25 }, (_, i) => item(100 + i));
    const env = { ...ENV, MASSIVA_CONFERENCIA_ENABLED: 'true', MASSIVA_CONFERENCIA_INTERVAL_MINUTES: '7' };
    const { service } = newService({ store, items: itens, env });
    await service.runOnce();
    const s = await buildConferenciaStatus({ service, store, env });
    assert.deepEqual(Object.keys(s).sort(), [
      'dryRun', 'emExecucao', 'gatewayConfigurado', 'habilitada', 'intervaloMinutos', 'janelaDias', 'recuperadasUltimos30Dias', 'ultimaExecucao',
    ]);
    assert.equal(s.habilitada, true);
    assert.equal(s.intervaloMinutos, 7);
    assert.equal(s.gatewayConfigurado, true);
    assert.equal(s.recuperadasUltimos30Dias, 25);
    assert.equal(s.ultimaExecucao.criadasTotal, 25);
    assert.equal(s.ultimaExecucao.criadas.length, 10, 'lista cortada para não pesar');
    assert.equal(s.ultimaExecucao.ok, true);
    assert.equal(s.ultimaExecucao.elleven.total, 25);
    assert.ok(s.ultimaExecucao.divergencias.abertaLocalFinalizadaElleven);
  });

  it('sem execução ainda: ultimaExecucao nula; sem MySQL: recuperadas nula', async () => {
    const store = fakeStore({ configured: false });
    const { service } = newService({ store, items: [] });
    const s = await buildConferenciaStatus({ service, store, env: {} });
    assert.equal(s.ultimaExecucao, null);
    assert.equal(s.recuperadasUltimos30Dias, null);
    assert.equal(s.habilitada, false);
    assert.equal(s.gatewayConfigurado, false);
  });

  it('erro na consulta de contagem não derruba o status', async () => {
    const store = { ...fakeStore(), async countRecovered() { throw new Error('db fora'); } };
    const { service } = newService({ store, items: [] });
    const s = await buildConferenciaStatus({ service, store, env: ENV });
    assert.equal(s.recuperadasUltimos30Dias, null);
  });
});

describe('startConferenciaScheduler', () => {
  function fakeTimers() {
    const timers = { timeouts: [], intervals: [] };
    return {
      timers,
      setTimeoutFn: (fn, ms) => { const t = { fn, ms, unref() {} }; timers.timeouts.push(t); return t; },
      setIntervalFn: (fn, ms) => { const t = { fn, ms, unref() {} }; timers.intervals.push(t); return t; },
    };
  }

  it('desligado por padrão: não agenda nada', () => {
    const { timers, setTimeoutFn, setIntervalFn } = fakeTimers();
    const r = startConferenciaScheduler({ service: {}, store: fakeStore(), env: ENV, logger: silentLogger(), setTimeoutFn, setIntervalFn });
    assert.equal(r.started, false);
    assert.equal(r.motivo, 'desativada');
    assert.equal(timers.intervals.length, 0);
  });

  it('ligado: primeira execução em 30 s e depois a cada N minutos', async () => {
    const { timers, setTimeoutFn, setIntervalFn } = fakeTimers();
    let execs = 0;
    const service = { runOnce: async () => { execs += 1; return {}; } };
    const env = { ...ENV, MASSIVA_CONFERENCIA_ENABLED: 'true', MASSIVA_CONFERENCIA_INTERVAL_MINUTES: '3' };
    const r = startConferenciaScheduler({ service, store: fakeStore(), env, logger: silentLogger(), setTimeoutFn, setIntervalFn });
    assert.equal(r.started, true);
    assert.equal(timers.timeouts[0].ms, 30_000);
    assert.equal(timers.intervals[0].ms, 3 * 60_000);
    timers.timeouts[0].fn();
    timers.intervals[0].fn();
    await Promise.resolve();
    assert.equal(execs, 2);
  });

  it('ligado mas sem gateway ou sem MySQL: não inicia', () => {
    const { setTimeoutFn, setIntervalFn } = fakeTimers();
    const base = { service: {}, logger: silentLogger(), setTimeoutFn, setIntervalFn };
    const semGw = startConferenciaScheduler({ ...base, store: fakeStore(), env: { MASSIVA_CONFERENCIA_ENABLED: 'true' } });
    const semDb = startConferenciaScheduler({ ...base, store: fakeStore({ configured: false }), env: { ...ENV, MASSIVA_CONFERENCIA_ENABLED: 'true' } });
    assert.equal(semGw.motivo, 'gateway_nao_configurado');
    assert.equal(semDb.motivo, 'mysql_nao_configurado');
  });
});
