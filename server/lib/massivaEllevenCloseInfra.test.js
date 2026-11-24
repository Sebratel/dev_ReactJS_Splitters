import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelLinkedInfraProtocol } from './massivaEllevenClose.js';

const base = { protocol: 1888, description: 'Abertura equivocada' };

test('cancela o protocolo de infra aberto junto, com o mesmo modo de cancelamento', async () => {
  const calls = [];
  const out = await cancelLinkedInfraProtocol(base, {
    getLink: async () => ({ infraProtocol: 1900, infraAssignmentId: 555 }),
    finalize: async (x) => { calls.push(x); return { ok: true }; },
  });
  assert.deepEqual(out, { protocol: 1900, ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].assignmentId, 555);
  assert.equal(calls[0].mode, 'cancelar');
  assert.match(calls[0].description, /Cancelado junto com a massiva 1888: Abertura equivocada/);
});

test('massiva sem protocolo de infra: nada a cancelar', async () => {
  let called = false;
  const out = await cancelLinkedInfraProtocol(base, {
    getLink: async () => null,
    finalize: async () => { called = true; return { ok: true }; },
  });
  assert.equal(out, null);
  assert.equal(called, false);
});

test('vínculo sem assignment não cancela', async () => {
  const out = await cancelLinkedInfraProtocol(base, {
    getLink: async () => ({ infraProtocol: 1900, infraAssignmentId: null }),
    finalize: async () => { throw new Error('não devia chamar'); },
  });
  assert.equal(out, null);
});

test('o Elleven recusou o cancelamento do infra: vira aviso com o motivo (a massiva já foi cancelada)', async () => {
  const warns = [];
  const out = await cancelLinkedInfraProtocol(base, {
    getLink: async () => ({ infraProtocol: 1900, infraAssignmentId: 555 }),
    finalize: async () => ({ ok: false, reason: 'Elleven/gateway recusou (HTTP 409).' }),
    logger: { warn: (...a) => warns.push(a) },
  });
  assert.deepEqual(out, { protocol: 1900, ok: false, reason: 'Elleven/gateway recusou (HTTP 409).' });
  assert.equal(warns.length, 1);
});

test('erro ao ler o vínculo ou chamar o Elleven nunca lança', async () => {
  const out = await cancelLinkedInfraProtocol(base, {
    getLink: async () => { throw new Error('banco fora'); },
    finalize: async () => ({ ok: true }),
  });
  assert.deepEqual(out, { protocol: null, ok: false, reason: 'banco fora' });
});

test('descrição muito longa é cortada em 4000 caracteres', async () => {
  let sent = '';
  await cancelLinkedInfraProtocol({ protocol: 1, description: 'x'.repeat(5000) }, {
    getLink: async () => ({ infraProtocol: 2, infraAssignmentId: 3 }),
    finalize: async (x) => { sent = x.description; return { ok: true }; },
  });
  assert.equal(sent.length, 4000);
});
