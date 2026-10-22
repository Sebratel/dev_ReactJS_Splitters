import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGmudDateWindow,
  canEditGmudRequest,
  safeErrorMessage,
} from './gmudValidation.js';

// ── validateGmudDateWindow ──────────────────────────────────────────────────

describe('validateGmudDateWindow', () => {
  it('retorna null quando os campos estão ausentes (opcionais)', () => {
    assert.equal(validateGmudDateWindow('', '', '', ''), null);
    assert.equal(validateGmudDateWindow(null, null), null);
  });

  it('retorna null para janela válida (datas diferentes)', () => {
    assert.equal(validateGmudDateWindow('2026-11-01', '2026-11-02', '22:00', '04:00'), null);
  });

  it('retorna null para janela válida no mesmo dia (hora fim > hora início)', () => {
    assert.equal(validateGmudDateWindow('2026-11-01', '2026-11-01', '08:00', '10:00'), null);
  });

  it('retorna erro quando dataFim < dataInicio', () => {
    const msg = validateGmudDateWindow('2026-11-05', '2026-11-04', '08:00', '10:00');
    assert.ok(msg?.includes('anterior'), `esperado "anterior" em: ${msg}`);
  });

  it('retorna erro quando no mesmo dia horaFim <= horaInicio', () => {
    const igual = validateGmudDateWindow('2026-11-01', '2026-11-01', '10:00', '10:00');
    assert.ok(igual?.includes('posterior'), `esperado "posterior" (horas iguais): ${igual}`);

    const menor = validateGmudDateWindow('2026-11-01', '2026-11-01', '10:00', '09:00');
    assert.ok(menor?.includes('posterior'), `esperado "posterior" (hora menor): ${menor}`);
  });
});

// ── canEditGmudRequest ──────────────────────────────────────────────────────

describe('canEditGmudRequest', () => {
  it('permite criar quando não existe registro (new)', () => {
    assert.equal(canEditGmudRequest(null, 'alice@ex.com', false), true);
  });

  it('permite editar quando o registro não tem criador registrado', () => {
    assert.equal(canEditGmudRequest({ createdByEmail: null }, 'alice@ex.com', false), true);
    assert.equal(canEditGmudRequest({ createdByEmail: '' }, 'alice@ex.com', false), true);
  });

  it('permite editar quando o ator é o próprio criador', () => {
    assert.equal(canEditGmudRequest({ createdByEmail: 'alice@ex.com' }, 'alice@ex.com', false), true);
  });

  it('permite editar quando o ator tem canApproveGmud (mesmo que não seja o criador)', () => {
    assert.equal(canEditGmudRequest({ createdByEmail: 'alice@ex.com' }, 'bob@ex.com', true), true);
  });

  it('bloqueia edição quando o ator não é criador e não tem canApproveGmud (F-01)', () => {
    assert.equal(canEditGmudRequest({ createdByEmail: 'alice@ex.com' }, 'bob@ex.com', false), false);
  });
});

// ── safeErrorMessage ────────────────────────────────────────────────────────

describe('safeErrorMessage', () => {
  const prod = true;
  const dev = false;

  it('em produção, erro 5xx retorna o fallback (não expõe detalhes)', () => {
    const err = Object.assign(new Error('detalhe interno do banco'), { statusCode: 500 });
    assert.equal(safeErrorMessage(err, 'Erro interno.', prod), 'Erro interno.');
  });

  it('em produção, erro 4xx retorna a mensagem original (operacional)', () => {
    const err = Object.assign(new Error('Protocolo não encontrado.'), { statusCode: 404 });
    assert.equal(safeErrorMessage(err, 'Erro.', prod), 'Protocolo não encontrado.');
  });

  it('em produção, erro 403 retorna a mensagem original', () => {
    const err = Object.assign(new Error('Sem permissão.'), { statusCode: 403 });
    assert.equal(safeErrorMessage(err, 'Erro.', prod), 'Sem permissão.');
  });

  it('fora de produção, sempre retorna a mensagem original independente do status', () => {
    const err = Object.assign(new Error('detalhe interno do banco'), { statusCode: 500 });
    assert.equal(safeErrorMessage(err, 'Erro interno.', dev), 'detalhe interno do banco');
  });

  it('quando error não é instância de Error, retorna o fallback', () => {
    assert.equal(safeErrorMessage('string pura', 'Fallback.', prod), 'Fallback.');
    assert.equal(safeErrorMessage(null, 'Fallback.', prod), 'Fallback.');
  });
});
