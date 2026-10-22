import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROUTE_LOOKUP_COLUMNS,
  ROUTE_LOOKUP_MAX_USERNAMES,
  buildRouteLookupQuery,
  parseRouteLookupBody,
  pppoeLookupKeys,
} from './autoIspRouteLookup.js';

describe('pppoeLookupKeys', () => {
  it('normaliza caixa/espacos e gera a variante sem dominio', () => {
    assert.deepEqual(pppoeLookupKeys('  Fulano@Provedor.com '), ['fulano@provedor.com', 'fulano']);
  });

  it('sem dominio gera uma chave so', () => {
    assert.deepEqual(pppoeLookupKeys('FULANO'), ['fulano']);
  });

  it('vazio, nulo e "@x" (arroba na primeira posicao)', () => {
    assert.deepEqual(pppoeLookupKeys(''), []);
    assert.deepEqual(pppoeLookupKeys(null), []);
    assert.deepEqual(pppoeLookupKeys('@x'), ['@x']);
  });
});

describe('parseRouteLookupBody', () => {
  it('devolve chaves unicas e ordenadas, incluindo a variante sem dominio', () => {
    const out = parseRouteLookupBody({ pppoeUsernames: ['b@x.com', 'A', 'a', ' ', 'b@x.com'] });
    assert.deepEqual(out, { ok: true, keys: ['a', 'b', 'b@x.com'] });
  });

  it('lista vazia e valida (nada a consultar)', () => {
    assert.deepEqual(parseRouteLookupBody({ pppoeUsernames: [] }), { ok: true, keys: [] });
  });

  it('rejeita corpo sem array', () => {
    assert.equal(parseRouteLookupBody({}).ok, false);
    assert.equal(parseRouteLookupBody(undefined).ok, false);
    assert.equal(parseRouteLookupBody({ pppoeUsernames: 'a' }).ok, false);
  });

  it('rejeita itens que nao sao string', () => {
    const out = parseRouteLookupBody({ pppoeUsernames: ['a', 1] });
    assert.equal(out.ok, false);
    assert.match(out.error, /strings/);
  });

  it('rejeita acima do limite, aceita no limite', () => {
    const at = Array.from({ length: ROUTE_LOOKUP_MAX_USERNAMES }, (_, i) => `u${i}`);
    assert.equal(parseRouteLookupBody({ pppoeUsernames: at }).ok, true);
    const over = parseRouteLookupBody({ pppoeUsernames: [...at, 'extra'] });
    assert.equal(over.ok, false);
    assert.match(over.error, /Máximo/);
  });
});

describe('buildRouteLookupQuery', () => {
  const sql = buildRouteLookupQuery('SELECT 1 AS x');

  it('seleciona só colunas de rota (nada de dados pessoais)', () => {
    for (const personal of ['NOME CLIENTE', 'CELULAR', 'EMAIL', 'RUA', 'BAIRRO', 'LATITUDE']) {
      assert.ok(!sql.includes(personal), `não deveria selecionar ${personal}`);
    }
    assert.ok(!/base\.\*/.test(sql));
    for (const column of ROUTE_LOOKUP_COLUMNS) assert.ok(sql.includes(`base."${column}"`), column);
  });

  it('filtra por usuario parametrizado (sem interpolar valores) e exige conexao', () => {
    assert.match(sql, /LOWER\(TRIM\(base\."USUÁRIO\[CLIENTE\]"::text\)\) = ANY\(\$1::text\[\]\)/);
    assert.match(sql, /"ID CONEXAO\[CLIENTE\]" IS NOT NULL/);
    assert.match(sql, /FROM \(SELECT 1 AS x\) base/);
  });
});
