import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROTA_POR_PPPOE_MAX,
  ROTA_POR_PPPOE_SQL,
  normalizarPppoes,
  parseRotaPorPppoeBody,
} from './rotaPorPppoe.js';

describe('normalizarPppoes', () => {
  it('minúsculas, trim e variante sem domínio, sem duplicar', () => {
    assert.deepEqual(normalizarPppoes([' Fulano@Prov ', 'fulano', 'Beltrano']), [
      'fulano@prov',
      'fulano',
      'beltrano',
    ]);
  });

  it('ignora vazios e não-strings', () => {
    assert.deepEqual(normalizarPppoes(['', '  ', null, 7, '@x']), ['@x']);
  });
});

describe('parseRotaPorPppoeBody', () => {
  it('exige array "pppoes"', () => {
    assert.equal(parseRotaPorPppoeBody({}).ok, false);
    assert.equal(parseRotaPorPppoeBody(undefined).ok, false);
  });

  it('rejeita itens que não são string', () => {
    assert.equal(parseRotaPorPppoeBody({ pppoes: ['a', 1] }).ok, false);
  });

  it('limita a 500 por chamada', () => {
    const many = Array.from({ length: ROTA_POR_PPPOE_MAX + 1 }, (_, i) => `u${i}`);
    assert.equal(parseRotaPorPppoeBody({ pppoes: many }).ok, false);
    assert.equal(parseRotaPorPppoeBody({ pppoes: many.slice(0, ROTA_POR_PPPOE_MAX) }).ok, true);
  });

  it('devolve as chaves normalizadas', () => {
    assert.deepEqual(parseRotaPorPppoeBody({ pppoes: ['A@b'] }), { ok: true, keys: ['a@b', 'a'] });
  });
});

describe('ROTA_POR_PPPOE_SQL', () => {
  it('parte do PPPoE (sem base inteira) e não traz dados do cliente', () => {
    assert.match(ROTA_POR_PPPOE_SQL, /ANY\(\$1::text\[\]\)/);
    assert.doesNotMatch(ROTA_POR_PPPOE_SQL, /people|cell_phone|email|primary_splitters/i);
  });
});
