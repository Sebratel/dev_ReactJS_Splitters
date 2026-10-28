import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA_STATUS,
  buildApprovalUrl,
  computeAreasStatus,
  createRateLimiter,
  deriveApprovalAreas,
  generateApprovalToken,
  hashApprovalToken,
  isValidApprovalTokenShape,
} from './gmudAreaApproval.js';
import { buildAreaDenialDescription, cancelGmudInElleven } from './gmudEllevenCancel.js';

test('deriveApprovalAreas: emergencial não tem aprovação por área', () => {
  const areas = deriveApprovalAreas({
    tipo: 'Emergencial',
    categoria: 'sistemas_internos',
    categoriaData: { areasImpactadas: ['Comercial'] },
  });
  assert.deepEqual(areas, []);
});

test('deriveApprovalAreas: sistemas internos usa áreas impactadas, sem repetir', () => {
  const areas = deriveApprovalAreas({
    tipo: 'Programada',
    categoria: 'sistemas_internos',
    categoriaData: { areasImpactadas: ['Comercial', ' Comercial ', 'RH', ''] },
  });
  assert.deepEqual(areas, ['Comercial', 'RH']);
});

test('deriveApprovalAreas: sistemas externos usa áreas afetadas', () => {
  const areas = deriveApprovalAreas({
    tipo: 'Programada',
    categoria: 'sistemas_externos',
    categoriaData: { areasAfetadas: ['Atendimento'], areasImpactadas: ['Ignorada'] },
  });
  assert.deepEqual(areas, ['Atendimento']);
});

test('deriveApprovalAreas: rede externa usa só Executor e Validador da matriz', () => {
  const areas = deriveApprovalAreas({
    tipo: 'Programada',
    categoria: 'rede_externa',
    recursosAdministrativos: {
      'Oper/Infra': 'executor',
      'T&TI/CGR': 'validador',
      'T&TI/COR': 'na',
    },
  });
  assert.deepEqual(areas, ['Oper/Infra', 'T&TI/CGR']);
});

test('deriveApprovalAreas: sem dados devolve lista vazia', () => {
  assert.deepEqual(deriveApprovalAreas({}), []);
  assert.deepEqual(deriveApprovalAreas(), []);
});

test('computeAreasStatus', () => {
  assert.equal(computeAreasStatus([]), AREA_STATUS.NAO_APLICAVEL);
  assert.equal(computeAreasStatus(['aprovada', 'aprovada']), AREA_STATUS.APROVADA);
  assert.equal(computeAreasStatus(['aprovada', 'pendente']), AREA_STATUS.PENDENTE);
  assert.equal(computeAreasStatus(['pendente', 'negada', 'aprovada']), AREA_STATUS.NEGADA);
});

test('token: formato válido, único e só o hash é derivável', () => {
  const a = generateApprovalToken();
  const b = generateApprovalToken();
  assert.ok(isValidApprovalTokenShape(a.token));
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashApprovalToken(a.token));
  assert.equal(a.hash.length, 64);
  assert.notEqual(a.hash, a.token);
});

test('token: rejeita formato inválido', () => {
  for (const bad of ['', 'abc', null, undefined, 123, 'x'.repeat(44), `${'a'.repeat(42)}!`]) {
    assert.equal(isValidApprovalTokenShape(bad), false);
  }
});

test('buildApprovalUrl coloca o código no fragmento', () => {
  const url = buildApprovalUrl('https://app.exemplo.com/', 'TOKEN');
  assert.equal(url, 'https://app.exemplo.com/gmud/aprovar-area#t=TOKEN');
  assert.ok(!new URL(url).search.includes('TOKEN'));
  assert.ok(!new URL(url).pathname.includes('TOKEN'));
  assert.equal(buildApprovalUrl('', 'T'), 'http://localhost:5173/gmud/aprovar-area#t=T');
});

test('rate limiter respeita limite e janela', () => {
  let t = 0;
  const allow = createRateLimiter({ windowMs: 1000, max: 2, now: () => t });
  assert.equal(allow('ip'), true);
  assert.equal(allow('ip'), true);
  assert.equal(allow('ip'), false);
  assert.equal(allow('outro'), true);
  t = 1500;
  assert.equal(allow('ip'), true);
});

test('cancelGmudInElleven: sem configuração do gateway não chama a rede', async () => {
  let chamou = false;
  const r = await cancelGmudInElleven(
    { assignmentId: 10, description: 'x' },
    { env: {}, fetchImpl: async () => { chamou = true; } },
  );
  assert.equal(r.ok, false);
  assert.equal(r.skipped, true);
  assert.equal(chamou, false);
});

test('cancelGmudInElleven: sem assignmentId não chama a rede', async () => {
  let chamou = false;
  const env = { GATEWAY_ORIGIN: 'https://gw.exemplo', GATEWAY_BASIC_AUTH_USER: 'u', GATEWAY_BASIC_AUTH_PASSWORD: 'p' };
  const r = await cancelGmudInElleven({ assignmentId: null, description: 'x' }, { env, fetchImpl: async () => { chamou = true; } });
  assert.equal(r.skipped, true);
  assert.equal(chamou, false);
});

test('cancelGmudInElleven: envia DELETE com Basic e status 8, e não vaza a senha no retorno', async () => {
  let captured;
  const env = { GATEWAY_ORIGIN: 'https://gw.exemplo/', GATEWAY_BASIC_AUTH_USER: 'usuario', GATEWAY_BASIC_AUTH_PASSWORD: 'segredo' };
  const r = await cancelGmudInElleven(
    { assignmentId: 123, description: 'motivo' },
    { env, fetchImpl: async (url, init) => { captured = { url, init }; return { ok: true, status: 200 }; } },
  );
  assert.deepEqual(r, { ok: true });
  assert.equal(captured.url, 'https://gw.exemplo/api/v1/gmud/encerrar-via-api');
  assert.equal(captured.init.method, 'DELETE');
  assert.equal(
    captured.init.headers.Authorization,
    `Basic ${Buffer.from('usuario:segredo').toString('base64')}`,
  );
  const body = JSON.parse(captured.init.body);
  assert.equal(body.assignmentId, '123');
  assert.equal(body.incidentStatusId, '8');
  assert.equal(body.description, 'motivo');
});

test('cancelGmudInElleven: resposta de erro e falha de rede viram ok:false com motivo', async () => {
  const env = { GATEWAY_ORIGIN: 'https://gw.exemplo', GATEWAY_BASIC_AUTH_USER: 'u', GATEWAY_BASIC_AUTH_PASSWORD: 'p' };
  const erroHttp = await cancelGmudInElleven({ assignmentId: 1, description: 'x' }, { env, fetchImpl: async () => ({ ok: false, status: 502 }) });
  assert.equal(erroHttp.ok, false);
  assert.match(erroHttp.reason, /502/);
  const erroRede = await cancelGmudInElleven({ assignmentId: 1, description: 'x' }, { env, fetchImpl: async () => { throw new Error('timeout'); } });
  assert.equal(erroRede.ok, false);
  assert.match(erroRede.reason, /timeout/);
  assert.ok(!JSON.stringify(erroRede).includes('p'.repeat(5)));
});

test('buildAreaDenialDescription cita a área e quem negou', () => {
  const texto = buildAreaDenialDescription({ areaLabel: 'Comercial', byName: 'Fulano', at: new Date(2026, 9, 28, 14, 5) });
  assert.match(texto, /área Comercial \(Fulano\)/);
  assert.match(texto, /28\/10\/2026 14:05/);
});
