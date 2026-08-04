import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractBearerToken,
  normalizeEmail,
  toCleanString,
  stripWrappingQuotes,
  isFirebaseAdminAccessConfigured,
} from './firebaseAdminAuth.js';

describe('extractBearerToken', () => {
  it('extrai o token de um header Authorization Bearer valido', () => {
    const req = { headers: { authorization: 'Bearer abc.def.ghi' } };
    assert.equal(extractBearerToken(req), 'abc.def.ghi');
  });

  it('e case-insensitive para o prefixo Bearer', () => {
    const req = { headers: { authorization: 'bearer abc.def.ghi' } };
    assert.equal(extractBearerToken(req), 'abc.def.ghi');
  });

  it('remove espacos em volta do token', () => {
    const req = { headers: { authorization: 'Bearer   abc.def.ghi   ' } };
    assert.equal(extractBearerToken(req), 'abc.def.ghi');
  });

  it('lanca 401 "Sessao expirada ou nao autorizada" quando nao ha header Authorization', () => {
    const req = { headers: {} };
    assert.throws(
      () => extractBearerToken(req),
      (error) => error.statusCode === 401 && error.message === 'Sessao expirada ou nao autorizada.',
    );
  });

  it('lanca 401 quando o header nao segue o formato Bearer', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    assert.throws(
      () => extractBearerToken(req),
      (error) => error.statusCode === 401,
    );
  });

  it('lanca 401 quando req.headers esta ausente', () => {
    assert.throws(
      () => extractBearerToken({}),
      (error) => error.statusCode === 401,
    );
  });
});

describe('normalizeEmail', () => {
  it('normaliza para minusculas e remove espacos', () => {
    assert.equal(normalizeEmail('  Usuario@Sebratel.com.br  '), 'usuario@sebratel.com.br');
  });

  it('retorna string vazia para valores nulos/indefinidos', () => {
    assert.equal(normalizeEmail(null), '');
    assert.equal(normalizeEmail(undefined), '');
  });
});

describe('toCleanString', () => {
  it('converte numero para string', () => {
    assert.equal(toCleanString(123), '123');
  });

  it('remove espacos nas bordas', () => {
    assert.equal(toCleanString('  valor  '), 'valor');
  });
});

describe('stripWrappingQuotes', () => {
  it('remove aspas duplas envolventes', () => {
    assert.equal(stripWrappingQuotes('"valor"'), 'valor');
  });

  it('remove aspas simples envolventes', () => {
    assert.equal(stripWrappingQuotes("'valor'"), 'valor');
  });

  it('remove aspas envolvendo uma chave PEM multi-linha (caso real do Portainer)', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----';
    assert.equal(stripWrappingQuotes(`"${pem}\n"`), pem);
  });

  it('nao altera valor sem aspas', () => {
    assert.equal(stripWrappingQuotes('valor sem aspas'), 'valor sem aspas');
  });

  it('nao remove aspa unica no meio do valor', () => {
    assert.equal(stripWrappingQuotes('valor "com aspas" no meio'), 'valor "com aspas" no meio');
  });

  it('nao remove quando so um lado tem aspa', () => {
    assert.equal(stripWrappingQuotes('"valor incompleto'), '"valor incompleto');
  });
});

describe('isFirebaseAdminAccessConfigured', () => {
  it('retorna boolean sem lancar excecao mesmo sem env vars configuradas', () => {
    assert.equal(typeof isFirebaseAdminAccessConfigured(), 'boolean');
  });
});
