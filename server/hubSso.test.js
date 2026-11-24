import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  __resetHubReplayForTest,
  hubOnlyActive,
  hubSsoConfigured,
  isHubOnlyBypassEmail,
  verifyHubLaunchToken,
} from './hubSso.js';
import { assertHubOnlyAllows } from './firebaseAdminAuth.js';

const SECRET = 'segredo-de-teste-do-hub-0123456789abcdef';
const APP_ID = 'app-splitters-sebratel';
const ENV_KEYS = ['HUB_SSO_SECRET', 'HUB_APP_ID', 'HUB_ONLY', 'HUB_ONLY_BYPASS_EMAILS'];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Mesmo formato do jwt.sign do hub-api (HS256, { sub, email, name, appId, iat, exp }). */
function hubToken(overrides = {}, { secret = SECRET, header = { alg: 'HS256', typ: 'JWT' } } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'uid-1',
    email: 'pessoa@sebratel.com.br',
    name: 'Pessoa Teste',
    appId: APP_ID,
    iat: now,
    exp: now + 300,
    ...overrides,
  };
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

let saved;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.HUB_SSO_SECRET = SECRET;
  process.env.HUB_APP_ID = APP_ID;
  delete process.env.HUB_ONLY;
  delete process.env.HUB_ONLY_BYPASS_EMAILS;
  __resetHubReplayForTest();
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('verifyHubLaunchToken', () => {
  it('aceita o token do Hub e devolve e-mail e nome', () => {
    const r = verifyHubLaunchToken(hubToken({ email: ' Pessoa@Sebratel.com.br ' }));
    assert.deepEqual(r, { ok: true, email: 'pessoa@sebratel.com.br', name: 'Pessoa Teste' });
  });

  it('recusa o mesmo token na segunda vez (uso único)', () => {
    const t = hubToken();
    assert.equal(verifyHubLaunchToken(t).ok, true);
    const again = verifyHubLaunchToken(t);
    assert.equal(again.ok, false);
    assert.equal(again.status, 401);
    assert.match(again.error, /já foi usado/);
  });

  it('recusa token emitido para outro app com 403', () => {
    const r = verifyHubLaunchToken(hubToken({ appId: 'outro-app' }));
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });

  it('recusa token assinado com outro segredo', () => {
    const r = verifyHubLaunchToken(hubToken({}, { secret: 'outro-segredo' }));
    assert.equal(r.ok, false);
    assert.equal(r.status, 401);
  });

  it('recusa alg none mesmo com assinatura vazia', () => {
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ email: 'pessoa@sebratel.com.br', appId: APP_ID, exp: 9999999999 })}.`;
    assert.equal(verifyHubLaunchToken(token).ok, false);
  });

  it('recusa token vencido', () => {
    const now = Math.floor(Date.now() / 1000);
    const r = verifyHubLaunchToken(hubToken({ iat: now - 600, exp: now - 1 }));
    assert.equal(r.ok, false);
    assert.match(r.error, /venceu/);
  });

  it('recusa e-mail fora do domínio com 403', () => {
    const r = verifyHubLaunchToken(hubToken({ email: 'alguem@gmail.com' }));
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });

  it('responde 503 quando falta HUB_SSO_SECRET ou HUB_APP_ID', () => {
    delete process.env.HUB_APP_ID;
    const r = verifyHubLaunchToken(hubToken());
    assert.equal(r.ok, false);
    assert.equal(r.status, 503);
  });

  it('recusa lixo sem lançar exceção', () => {
    for (const t of [undefined, null, '', 'a.b', 'a.b.c', 42]) {
      assert.equal(verifyHubLaunchToken(t).ok, false);
    }
  });
});

describe('HUB_ONLY', () => {
  it('só vale com HUB_SSO_SECRET e HUB_APP_ID preenchidos', () => {
    process.env.HUB_ONLY = 'true';
    assert.equal(hubOnlyActive(), true);
    delete process.env.HUB_SSO_SECRET;
    assert.equal(hubSsoConfigured(), false);
    assert.equal(hubOnlyActive(), false);
  });

  it('tira aspas coladas no painel da stack', () => {
    process.env.HUB_ONLY = '"true"';
    process.env.HUB_APP_ID = `"${APP_ID}"`;
    assert.equal(hubOnlyActive(), true);
    assert.equal(verifyHubLaunchToken(hubToken()).ok, true);
  });

  it('lista de emergência ignora caixa e espaços', () => {
    process.env.HUB_ONLY_BYPASS_EMAILS = ' Master@Sebratel.com.br , outro@sebratel.com.br';
    assert.equal(isHubOnlyBypassEmail('master@sebratel.com.br'), true);
    assert.equal(isHubOnlyBypassEmail('ninguem@sebratel.com.br'), false);
    assert.equal(isHubOnlyBypassEmail(''), false);
  });

  it('desligado: login direto passa', () => {
    assert.doesNotThrow(() => assertHubOnlyAllows({ email: 'pessoa@sebratel.com.br', viaHub: false }));
  });

  it('ligado: sessão do Hub passa, login direto recebe 403 HUB_ONLY', () => {
    process.env.HUB_ONLY = 'true';
    assert.doesNotThrow(() => assertHubOnlyAllows({ email: 'pessoa@sebratel.com.br', viaHub: true }));
    assert.throws(
      () => assertHubOnlyAllows({ email: 'pessoa@sebratel.com.br', viaHub: false }),
      (error) => error.statusCode === 403 && error.code === 'HUB_ONLY',
    );
  });

  it('ligado: e-mail de emergência entra direto', () => {
    process.env.HUB_ONLY = 'true';
    process.env.HUB_ONLY_BYPASS_EMAILS = 'master@sebratel.com.br';
    assert.doesNotThrow(() => assertHubOnlyAllows({ email: 'master@sebratel.com.br', viaHub: false }));
  });
});
